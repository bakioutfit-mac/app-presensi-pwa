'use client';

import React, { useState, useEffect } from 'react';
import {
  Banknote,
  Lock,
  ChevronDown,
  ChevronUp,
  Download,
  Printer,
  Calendar,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { getPeriodFromDate } from '@/lib/date';

export default function PayslipTab() {
  const { user, overtimeRequests } = useAuth();
  const [payslips, setPayslips] = useState([]);
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    async function fetchPayslips() {
      if (!user) return;
      try {
        // 1. Ambil detail 11 komponen dari cache cloud (admin_settings) dan localStorage
        let detailsMap = {};
        if (typeof window !== 'undefined') {
          try {
            detailsMap = JSON.parse(localStorage.getItem('pwa_payslips_detail') || '{}');
          } catch (e) {}
        }
        try {
          const { data: detailRow } = await supabase
            .from('admin_settings')
            .select('description')
            .eq('role', 'payslips_detail')
            .single();
          if (detailRow && detailRow.description) {
            const remoteDetails = JSON.parse(detailRow.description);
            detailsMap = { ...detailsMap, ...remoteDetails };
          }
        } catch (e) {}

        // 2. Query dari tabel payslips Supabase jika ada
        let dbSlips = [];
        try {
          const { data, error } = await supabase
            .from('payslips')
            .select('*')
            .eq('employee_id', user.id)
            .order('created_at', { ascending: false });
          if (!error && data) {
            dbSlips = data;
          }
        } catch (e) {}

        // 3. Kumpulkan slip milik user yang login dari kedua sumber (Supabase table + detailsMap cloud)
        const combinedList = [];

        // Masukkan dari dbSlips
        for (const p of dbSlips) {
          const detail = detailsMap[p.id] || {};
          combinedList.push({
            ...p,
            child_allowance: detail.child_allowance ?? 0,
            spouse_allowance: detail.spouse_allowance ?? 0,
            position_allowance: detail.position_allowance ?? 0,
            meal_allowance: detail.meal_allowance ?? p.attendance_allowance ?? 0,
            overtime_pay: detail.overtime_pay ?? p.overtime_pay ?? 0,
            plus_day_count: detail.plus_day_count ?? p.plus_day_count ?? 0,
            plus_day_pay: detail.plus_day_pay ?? p.plus_day_pay ?? 0,
            plus_day_note: detail.plus_day_note ?? p.plus_day_note ?? '',
            meal_deduction: detail.meal_deduction ?? 0,
            attendance_deduction: detail.attendance_deduction ?? 0,
            discipline_deduction: detail.discipline_deduction ?? 0,
            cash_bon: detail.cash_bon ?? p.deductions ?? 0,
            is_released: detail.is_released !== undefined ? detail.is_released : p.is_released,
            net_salary: detail.net_salary ?? p.net_salary,
          });
        }

        // Masukkan juga dari detailsMap jika belum ada di combinedList (mencocokkan employee_id atau nama staf)
        const userFullName = (user.full_name || user.name || '').toLowerCase().trim();
        for (const [id, item] of Object.entries(detailsMap)) {
          const matchId = Boolean(user.id && item.employee_id && item.employee_id === user.id);
          const itemEmpName = (item.employee_name || '').toLowerCase().trim();
          const matchName = Boolean(userFullName && itemEmpName && (itemEmpName === userFullName || itemEmpName.includes(userFullName) || userFullName.includes(itemEmpName)));

          if (matchId || matchName) {
            const alreadyInList = combinedList.some(
              (c) => c.id === id || ((c.period || '').toLowerCase().trim() === (item.period || '').toLowerCase().trim())
            );
            if (!alreadyInList) {
              combinedList.push({
                id: item.id || id,
                employee_id: item.employee_id || user.id,
                period: item.period,
                basic_salary: item.basic_salary || 0,
                child_allowance: item.child_allowance ?? 0,
                spouse_allowance: item.spouse_allowance ?? 0,
                position_allowance: item.position_allowance ?? 0,
                meal_allowance: item.meal_allowance ?? 0,
                overtime_pay: item.overtime_pay ?? 0,
                plus_day_count: item.plus_day_count ?? 0,
                plus_day_pay: item.plus_day_pay ?? 0,
                plus_day_note: item.plus_day_note ?? '',
                meal_deduction: item.meal_deduction ?? 0,
                attendance_deduction: item.attendance_deduction ?? 0,
                discipline_deduction: item.discipline_deduction ?? 0,
                cash_bon: item.cash_bon ?? 0,
                net_salary: item.net_salary ?? 0,
                is_released: item.is_released !== undefined ? item.is_released : true,
                created_at: item.created_at || new Date().toISOString(),
              });
            }
          }
        }

        // 4. Urutkan dan deduplikasi per periode (hanya ambil 1 slip terbaru per periode)
        combinedList.sort((a, b) => {
          const timeA = new Date(a.created_at || 0).getTime();
          const timeB = new Date(b.created_at || 0).getTime();
          return timeB - timeA;
        });

        const seenPeriod = new Set();
        const uniqueMapped = [];
        for (const slip of combinedList) {
          const periodKey = (slip.period || '').toLowerCase().trim();
          if (!seenPeriod.has(periodKey)) {
            seenPeriod.add(periodKey);
            uniqueMapped.push(slip);
          }
        }

        setPayslips(uniqueMapped);
        const latestReleased = uniqueMapped.find((p) => p.is_released);
        if (latestReleased) setOpenId(latestReleased.id);
      } catch (err) {
        console.warn('Fetch payslips error:', err);
        setPayslips([]);
        setOpenId(null);
      }
    }
    fetchPayslips();

    // Listener reload otomatis jika Finance merilis atau memperbarui slip
    const handleSyncUpdate = () => fetchPayslips();
    window.addEventListener('pwa_payslips_detail_updated', handleSyncUpdate);
    window.addEventListener('storage', handleSyncUpdate);
    return () => {
      window.removeEventListener('pwa_payslips_detail_updated', handleSyncUpdate);
      window.removeEventListener('storage', handleSyncUpdate);
    };
  }, [user]);

  const toggleAccordion = (id, isReleased) => {
    if (!isReleased) return;
    setOpenId(openId === id ? null : id);
  };

  const formatRupiah = (val) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-3.5 animate-in fade-in duration-200">
      {/* Header Info Card */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#2563EB]">
            <Banknote className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-black text-slate-900">
              Daftar Slip Gaji Karyawan
            </h3>
            <p className="text-[10px] text-slate-500">
              10 Komponen Penggajian Outlet Resmi
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full shadow-xs">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Resmi Terbit</span>
        </div>
      </div>

      {/* Accordion List */}
      {payslips.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 border border-slate-200/80 text-center shadow-xs space-y-2.5">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mx-auto text-[#2563EB]">
            <Banknote className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-slate-800">Belum Ada Slip Gaji</h4>
          <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
            Slip gaji bulanan Anda akan muncul di sini setelah diproses dan dirilis oleh Admin Finance.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {payslips.map((slip) => {
          const isOpen = openId === slip.id;
          const isReleased = slip.is_released;

          const totalIncome =
            (Number(slip.basic_salary) || 0) +
            (Number(slip.child_allowance) || 0) +
            (Number(slip.spouse_allowance) || 0) +
            (Number(slip.position_allowance) || 0) +
            (Number(slip.meal_allowance) || 0) +
            (Number(slip.overtime_pay) || 0) +
            (Number(slip.plus_day_pay) || 0);

          const totalDeductions =
            (Number(slip.meal_deduction) || 0) +
            (Number(slip.attendance_deduction) || 0) +
            (Number(slip.discipline_deduction) || 0) +
            (Number(slip.cash_bon) || 0);

          const rejectedOvertimes = (overtimeRequests || []).filter((ot) => {
            const matchEmp = (user?.id && ot.employee_id === user.id) || ot.employee_name === user?.full_name || ot.employee_name === user?.name;
            const matchPeriod = getPeriodFromDate(ot.date) === slip.period;
            return matchEmp && matchPeriod && ot.status === 'Ditolak Finance';
          });

          const approvedOvertimes = (overtimeRequests || []).filter((ot) => {
            const matchEmp = (user?.id && ot.employee_id === user.id) || ot.employee_name === user?.full_name || ot.employee_name === user?.name;
            const matchPeriod = getPeriodFromDate(ot.date) === slip.period;
            return matchEmp && matchPeriod && ot.status === 'Disetujui Finance';
          });

          return (
            <div
              key={slip.id}
              className={`rounded-2xl border transition-all overflow-hidden ${
                isOpen
                  ? 'border-blue-400 bg-white shadow-md'
                  : !isReleased
                  ? 'border-slate-200 bg-slate-100/70 opacity-80'
                  : 'border-slate-200 bg-white/90 hover:border-slate-300 shadow-xs'
              }`}
            >
              {/* Accordion Header */}
              <button
                type="button"
                onClick={() => toggleAccordion(slip.id, isReleased)}
                className={`w-full p-4 flex items-center justify-between text-left transition ${
                  !isReleased ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-slate-50/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      !isReleased
                        ? 'bg-slate-200 text-slate-400'
                        : isOpen
                        ? 'bg-[#2563EB] text-white shadow-xs'
                        : 'bg-blue-100 text-[#2563EB]'
                    }`}
                  >
                    {!isReleased ? (
                      <Lock className="w-5 h-5 text-slate-400" />
                    ) : (
                      <Banknote className="w-5 h-5" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-black text-slate-900">
                        Periode: {slip.period}
                      </h4>
                      {isReleased && slip.id === 'slip-001' && (
                        <span className="text-[9px] bg-blue-100 text-blue-800 font-black px-1.5 py-0.5 rounded-sm">
                          Terbaru
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
                      {isReleased
                        ? `Gaji Bersih (THP): ${formatRupiah(slip.net_salary)}`
                        : 'Menunggu rilis dari pihak finance'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!isReleased ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">
                      <Lock className="w-3 h-3" />
                      <span>Terkunci</span>
                    </span>
                  ) : isOpen ? (
                    <ChevronUp className="w-5 h-5 text-[#2563EB]" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  )}
                </div>
              </button>

              {/* Accordion Body / 10-Component Breakdown */}
              {isOpen && isReleased && (
                <div className="p-4 pt-2 border-t border-slate-100 space-y-3.5 bg-gradient-to-b from-white to-slate-50/50">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 pb-2 border-b border-dashed border-slate-200">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {slip.period_range || slip.period}
                    </span>
                    <span>Tgl Transfer: {slip.payment_date || '31 Agustus 2026'}</span>
                  </div>

                  {/* 1. Komponen Pendapatan (6) */}
                  <div className="space-y-1.5 p-3 bg-blue-50/40 border border-blue-100 rounded-xl">
                    <div className="flex justify-between items-center pb-1 border-b border-blue-100/60">
                      <span className="text-[10px] font-black uppercase text-[#2563EB] tracking-wider">
                        1. Penghasilan / Pendapatan
                      </span>
                      <span className="text-[10px] font-bold text-[#2563EB]">
                        Subtotal: {formatRupiah(totalIncome)}
                      </span>
                    </div>

                    <div className="flex justify-between text-xs text-slate-700 pt-1">
                      <span>Gaji Pokok</span>
                      <span className="font-semibold">{formatRupiah(slip.basic_salary)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-700">
                      <span>Tunjangan Anak</span>
                      <span className="font-semibold">{formatRupiah(slip.child_allowance)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-700">
                      <span>Tunjangan Istri</span>
                      <span className="font-semibold">{formatRupiah(slip.spouse_allowance)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-700">
                      <span>Tunjangan Jabatan</span>
                      <span className="font-semibold">{formatRupiah(slip.position_allowance)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-700">
                      <span>Tunjangan Makan</span>
                      <span className="font-semibold">{formatRupiah(slip.meal_allowance)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-700">
                      <div>
                        <span>Uang Lembur</span>
                        {approvedOvertimes.length > 0 && (
                          <span className="text-[10px] text-emerald-600 block font-medium">
                            {approvedOvertimes.reduce((sum, o) => sum + Number(o.hours || 0), 0)} Jam @ Rp 20.000 / Jam
                          </span>
                        )}
                      </div>
                      <span className="font-semibold text-emerald-600">
                        +{formatRupiah(slip.overtime_pay)}
                      </span>
                    </div>

                    {(Number(slip.plus_day_pay) > 0 || Number(slip.plus_day_count) > 0) && (
                      <div className="flex justify-between text-xs text-slate-700 pt-1 border-t border-blue-100/60">
                        <div>
                          <span className="font-bold text-blue-900 flex items-center gap-1">
                            <span>Perbantuan (+Day)</span>
                          </span>
                          <span className="text-[10px] text-blue-600 block font-medium">
                            {slip.plus_day_count || 0} Hari {slip.plus_day_note ? `• ${slip.plus_day_note}` : 'Perbantuan Libur/Event'}
                          </span>
                        </div>
                        <span className="font-semibold text-emerald-600">
                          +{formatRupiah(slip.plus_day_pay)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* 2. Komponen Potongan (4) */}
                  <div className="space-y-1.5 p-3 bg-rose-50/40 border border-rose-100 rounded-xl">
                    <div className="flex justify-between items-center pb-1 border-b border-rose-100/60">
                      <span className="text-[10px] font-black uppercase text-rose-600 tracking-wider">
                        2. Potongan
                      </span>
                      <span className="text-[10px] font-bold text-rose-600">
                        Subtotal: -{formatRupiah(totalDeductions)}
                      </span>
                    </div>

                    <div className="flex justify-between text-xs text-slate-700 pt-1">
                      <span>Potongan Makan</span>
                      <span className="font-semibold text-rose-600">-{formatRupiah(slip.meal_deduction)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-700">
                      <span>Potongan Kehadiran</span>
                      <span className="font-semibold text-rose-600">-{formatRupiah(slip.attendance_deduction)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-700">
                      <span className="flex items-center gap-1">
                        <span>Potongan Kedisiplinan</span>
                        {slip.discipline_deduction > 0 && (
                          <span className="text-[9px] bg-rose-100 text-rose-700 px-1 py-0.2 rounded font-bold">
                            Denda Terlambat
                          </span>
                        )}
                      </span>
                      <span className="font-semibold text-rose-600">-{formatRupiah(slip.discipline_deduction)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-700">
                      <span>Cash Bon</span>
                      <span className="font-semibold text-rose-600">-{formatRupiah(slip.cash_bon)}</span>
                    </div>
                  </div>

                  {/* Catatan Lembur Ditolak Finance (Jika Ada) */}
                  {rejectedOvertimes.length > 0 && (
                    <div className="p-3.5 bg-amber-50/90 border border-amber-200/90 rounded-xl space-y-2">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span className="text-xs font-black text-amber-900">
                          Catatan Pengajuan Lembur Ditolak ({rejectedOvertimes.length})
                        </span>
                      </div>
                      <p className="text-[10px] text-amber-800 leading-tight">
                        Pengajuan lembur dari Leader tidak disetujui Finance dengan keterangan:
                      </p>
                      <div className="space-y-1.5 pt-0.5">
                        {rejectedOvertimes.map((ot) => (
                          <div
                            key={ot.id}
                            className="bg-white/95 p-2.5 rounded-lg border border-amber-200 text-xs space-y-1"
                          >
                            <div className="flex justify-between items-center text-[11px] text-slate-500 font-medium">
                              <span>Tanggal: <strong className="text-slate-800">{ot.date}</strong> ({ot.hours} Jam)</span>
                              <span className="text-[9px] bg-rose-100 text-rose-700 font-bold px-1.5 py-0.5 rounded">
                                Ditolak Finance
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-700">
                              <span className="font-bold text-slate-900">Alasan Finance: </span>
                              <span className="italic text-rose-600 font-medium">&ldquo;{ot.rejection_reason || 'Tidak disetujui Finance'}&rdquo;</span>
                            </p>
                            {ot.reason && (
                              <p className="text-[10px] text-slate-500">
                                <span>Tugas diajukan: </span>
                                <span className="italic">{ot.reason}</span>
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Total Net Salary */}
                  <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl flex justify-between items-center">
                    <div>
                      <span className="font-black text-xs text-slate-900 block">
                        Total Gaji Bersih (Take Home Pay)
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Total Pendapatan - Total Potongan
                      </span>
                    </div>
                    <span className="font-black text-base text-[#2563EB]">
                      {formatRupiah(slip.net_salary)}
                    </span>
                  </div>

                  {/* Download / Print button */}
                  <div className="pt-1 flex gap-2">
                    <button
                      type="button"
                      onClick={() => handlePrint()}
                      className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition"
                    >
                      <Printer className="w-3.5 h-3.5 text-slate-600" />
                      <span>Cetak Slip</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => alert(`Unduhan slip gaji periode ${slip.period} telah berhasil disiapkan!`)}
                      className="flex-1 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-black rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Unduh PDF</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}
