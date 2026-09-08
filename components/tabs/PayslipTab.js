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
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export default function PayslipTab() {
  const { user } = useAuth();
  const [payslips, setPayslips] = useState([]);
  const [openId, setOpenId] = useState(null);

  const defaultPayslips = [
    {
      id: 'slip-001',
      period: 'Agustus 2026',
      period_range: '01 Ags 2026 - 31 Ags 2026',
      payment_date: '31 Agustus 2026',
      is_released: true,
      basic_salary: 3500000,
      attendance_allowance: 500000,
      transport_allowance: 300000,
      overtime_pay: 250000,
      deductions: 100000,
      net_salary: 4450000,
    },
    {
      id: 'slip-002',
      period: 'Juli 2026',
      period_range: '01 Jul 2026 - 31 Jul 2026',
      payment_date: '31 Juli 2026',
      is_released: true,
      basic_salary: 3500000,
      attendance_allowance: 500000,
      transport_allowance: 300000,
      overtime_pay: 150000,
      deductions: 50000,
      net_salary: 4400000,
    },
    {
      id: 'slip-003',
      period: 'September 2026',
      period_range: '01 Sep 2026 - 30 Sep 2026',
      payment_date: 'Dalam Proses Payroll',
      is_released: false, // Bergembok
      basic_salary: 3500000,
      attendance_allowance: 500000,
      transport_allowance: 300000,
      overtime_pay: 0,
      deductions: 0,
      net_salary: 4300000,
    },
  ];

  useEffect(() => {
    async function fetchPayslips() {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from('payslips')
          .select('*')
          .eq('employee_id', user.id)
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          setPayslips(data);
          // Automatically open latest released payslip
          const latestReleased = data.find((p) => p.is_released);
          if (latestReleased) setOpenId(latestReleased.id);
        } else {
          setPayslips(defaultPayslips);
          setOpenId('slip-001'); // Auto-open latest released
        }
      } catch (err) {
        setPayslips(defaultPayslips);
        setOpenId('slip-001');
      }
    }
    fetchPayslips();
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

  const handlePrint = (slip) => {
    window.print();
  };

  return (
    <div className="space-y-3.5 animate-in fade-in duration-200">
      {/* Header Info Card */}
      <div className="bg-[#CACFD6] rounded-2xl p-4 border border-white/60 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Banknote className="w-5 h-5 text-[#2563EB]" />
          <div>
            <h3 className="text-xs font-bold text-[#1E293B]">
              Daftar Slip Gaji Karyawan
            </h3>
            <p className="text-[10px] text-gray-600">
              Informasi gaji dan tunjangan transparan
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Terverifikasi</span>
        </div>
      </div>

      {/* Accordion List */}
      <div className="space-y-2.5">
        {payslips.map((slip) => {
          const isOpen = openId === slip.id;
          const isReleased = slip.is_released;

          return (
            <div
              key={slip.id}
              className={`rounded-2xl border transition-all overflow-hidden ${
                isOpen
                  ? 'border-[#F97316] bg-white shadow-md'
                  : !isReleased
                  ? 'border-gray-300 bg-gray-100/80 opacity-80'
                  : 'border-gray-200 bg-white/90 hover:border-gray-300'
              }`}
            >
              {/* Accordion Header */}
              <button
                type="button"
                onClick={() => toggleAccordion(slip.id, isReleased)}
                className={`w-full p-4 flex items-center justify-between text-left transition ${
                  !isReleased ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      !isReleased
                        ? 'bg-gray-200 text-gray-400'
                        : isOpen
                        ? 'bg-[#F97316] text-white shadow-sm'
                        : 'bg-orange-100 text-[#EA580C]'
                    }`}
                  >
                    {!isReleased ? (
                      <Lock className="w-5 h-5 text-gray-500" />
                    ) : (
                      <Banknote className="w-5 h-5" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-gray-800">
                        Periode: {slip.period}
                      </h4>
                      {isReleased && slip.id === 'slip-001' && (
                        <span className="text-[9px] bg-orange-100 text-[#EA580C] font-extrabold px-1.5 py-0.2 rounded-sm">
                          Terbaru
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {isReleased
                        ? `Gaji Bersih: ${formatRupiah(slip.net_salary)}`
                        : 'Menunggu rilis dari pihak finance'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!isReleased ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                      <Lock className="w-3 h-3" />
                      <span>Terkunci</span>
                    </span>
                  ) : isOpen ? (
                    <ChevronUp className="w-5 h-5 text-[#F97316]" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </button>

              {/* Accordion Body / Breakdown */}
              {isOpen && isReleased && (
                <div className="p-4 pt-1 border-t border-gray-100 space-y-3 bg-gradient-to-b from-white to-gray-50/50">
                  <div className="flex items-center justify-between text-[11px] text-gray-500 pb-2 border-b border-dashed border-gray-200">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {slip.period_range || slip.period}
                    </span>
                    <span>Tgl Transfer: {slip.payment_date || '31 Agustus 2026'}</span>
                  </div>

                  {/* Pendapatan */}
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-extrabold uppercase text-[#2563EB] tracking-wider">
                      Penghasilan
                    </p>
                    <div className="flex justify-between text-xs text-gray-700">
                      <span>Gaji Pokok</span>
                      <span className="font-semibold">{formatRupiah(slip.basic_salary)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-700">
                      <span>Tunjangan Kehadiran</span>
                      <span className="font-semibold">{formatRupiah(slip.attendance_allowance)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-700">
                      <span>Tunjangan Transport</span>
                      <span className="font-semibold">{formatRupiah(slip.transport_allowance)}</span>
                    </div>
                    {slip.overtime_pay > 0 && (
                      <div className="flex justify-between text-xs text-gray-700">
                        <span>Uang Lembur (Overtime)</span>
                        <span className="font-semibold text-emerald-600">
                          +{formatRupiah(slip.overtime_pay)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Potongan */}
                  <div className="space-y-1.5 pt-1">
                    <p className="text-[10px] font-extrabold uppercase text-rose-600 tracking-wider">
                      Potongan
                    </p>
                    <div className="flex justify-between text-xs text-gray-700">
                      <span>BPJS &amp; Keterlambatan</span>
                      <span className="font-semibold text-rose-600">
                        -{formatRupiah(slip.deductions)}
                      </span>
                    </div>
                  </div>

                  {/* Total Net Salary */}
                  <div className="pt-2 border-t border-gray-200 flex justify-between items-center">
                    <span className="font-extrabold text-xs text-gray-900">
                      Total Gaji Bersih (Take Home Pay)
                    </span>
                    <span className="font-black text-sm text-[#F97316]">
                      {formatRupiah(slip.net_salary)}
                    </span>
                  </div>

                  {/* Download / Print button */}
                  <div className="pt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => handlePrint(slip)}
                      className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Cetak Slip</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => alert(`Unduhan slip gaji ${slip.period} sedang diproses...`)}
                      className="flex-1 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition"
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
    </div>
  );
}
