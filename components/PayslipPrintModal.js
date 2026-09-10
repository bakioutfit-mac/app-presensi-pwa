'use client';

import React, { useRef } from 'react';
import { X, Printer, Download, ShieldCheck, Building2, Phone, MapPin } from 'lucide-react';
import { formatIndonesianDate, getLocalDateString } from '@/lib/date';

/**
 * Format mata uang Rupiah
 */
const formatRupiah = (val) => {
  const num = Number(val) || 0;
  return `Rp ${num.toLocaleString('id-ID')}`;
};

export default function PayslipPrintModal({
  isOpen,
  onClose,
  slip,
  user,
  approvedOvertimes = [],
  rejectedOvertimes = [],
}) {
  const printAreaRef = useRef(null);

  if (!isOpen || !slip) return null;

  const empName = slip.employee_name || user?.full_name || user?.name || 'Karyawan';
  const empId = slip.employee_id || user?.employee_id || user?.id || '-';
  const empBranch = slip.branch || user?.branch || 'LazyBloom';
  const empPosition = user?.position || 'Staf Operasional';
  const period = slip.period || 'September 2026';
  const todayFormatted = formatIndonesianDate(getLocalDateString());

  // Kalkulasi Pendapatan
  const basicSalary = Number(slip.basic_salary) || 0;
  const childAllowance = Number(slip.child_allowance) || 0;
  const spouseAllowance = Number(slip.spouse_allowance) || 0;
  const positionAllowance = Number(slip.position_allowance) || 0;
  const mealAllowance = Number(slip.meal_allowance) || 0;
  const overtimePay = Number(slip.overtime_pay) || 0;
  const plusDayPay = Number(slip.plus_day_pay) || 0;
  const plusDayCount = Number(slip.plus_day_count) || 0;
  const plusDayNote = slip.plus_day_note || '';

  const totalIncome =
    basicSalary +
    childAllowance +
    spouseAllowance +
    positionAllowance +
    mealAllowance +
    overtimePay +
    plusDayPay;

  // Kalkulasi Potongan
  const mealDeduction = Number(slip.meal_deduction) || 0;
  const attendanceDeduction = Number(slip.attendance_deduction) || 0;
  const disciplineDeduction = Number(slip.discipline_deduction) || 0;
  const cashBon = Number(slip.cash_bon) || 0;

  const totalDeductions =
    mealDeduction +
    attendanceDeduction +
    disciplineDeduction +
    cashBon;

  const netSalary = Number(slip.net_salary) || (totalIncome - totalDeductions);

  // Total jam lembur disetujui
  const approvedHours = approvedOvertimes.reduce((sum, o) => sum + Number(o.hours || 0), 0);

  const handleTriggerPrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      {/* Container Modal */}
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* Modal Top Bar (Screen Only - No Print) */}
        <div className="no-print px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider">
                Pratinjau Dokumen Slip Gaji Resmi
              </h3>
              <p className="text-[10px] text-slate-300">
                Siap disimpan sebagai PDF atau dicetak
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
            title="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Buttons Toolbar (Screen Only - No Print) */}
        <div className="no-print p-3.5 bg-blue-50/70 border-b border-blue-100 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 text-xs text-blue-900 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Kop Surat 3 Pillar &bull; Batang, Jawa Tengah</span>
          </div>
          <button
            type="button"
            onClick={handleTriggerPrint}
            className="py-2.5 px-4 bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] hover:from-[#1D4ED8] hover:to-[#1E40AF] text-white text-xs font-black rounded-xl flex items-center gap-2 shadow-md shadow-blue-500/20 active:scale-98 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Simpan sebagai PDF / Cetak</span>
          </button>
        </div>

        {/* Printable Document Body */}
        <div className="p-4 sm:p-8 overflow-y-auto bg-slate-100/60 print:bg-white print:p-0">
          <div
            ref={printAreaRef}
            id="printable-payslip-doc"
            className="print-document-only bg-white border border-slate-200 print:border-none p-6 sm:p-8 rounded-2xl shadow-sm print:shadow-none max-w-full text-slate-900 font-sans mx-auto"
            style={{ width: '100%', maxWidth: '210mm' }}
          >
            {/* ================= KOP SURAT RESMI 3 PILLAR ================= */}
            <div className="border-b-4 border-double border-slate-900 pb-3 mb-4">
              <div className="flex items-center justify-between gap-4">
                {/* Logo & Nama Perusahaan */}
                <div className="flex items-center gap-3.5">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden border border-slate-200 p-1 bg-white shrink-0 shadow-xs">
                    <img
                      src="/logo.png"
                      alt="Logo 3 Pillar Management"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div>
                    <h1 className="text-lg sm:text-xl font-black tracking-tight text-slate-900 uppercase">
                      3 PILLAR MANAGEMENT
                    </h1>
                    <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                      LazyBloom &bull; Deru Ombak &bull; Sea Cafe
                    </p>
                    <p className="text-[10px] text-slate-500 leading-tight mt-0.5">
                      Jl. Pantai Sigandu, Depok Kec. Kandeman Kab. Batang, Jawa Tengah 51261
                    </p>
                    <p className="text-[10px] text-slate-600 font-medium">
                      WhatsApp / CS Finance: <span className="font-bold">+62 857-3104-4332</span>
                    </p>
                  </div>
                </div>

                {/* Badge Bukti Resmi */}
                <div className="hidden sm:flex flex-col items-end text-right">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                    Dokumen Resmi
                  </span>
                  <span className="text-xs font-extrabold text-blue-900 mt-0.5">
                    BUKTI PENGGAJIAN
                  </span>
                  <span className="text-[9px] text-slate-400">
                    Tercatat Sistem Cloud
                  </span>
                </div>
              </div>
            </div>

            {/* ================= JUDUL DOKUMEN & PERIODE ================= */}
            <div className="text-center my-3">
              <h2 className="text-sm sm:text-base font-black uppercase tracking-wider text-slate-900 underline decoration-2 underline-offset-4">
                SLIP GAJI KARYAWAN
              </h2>
              <p className="text-[11px] font-bold text-slate-600 mt-1">
                Periode: <span className="text-slate-900 uppercase">{period}</span>
              </p>
            </div>

            {/* ================= IDENTITAS KARYAWAN ================= */}
            <div className="bg-slate-50 print:bg-slate-50/70 border border-slate-200 rounded-xl p-3 my-3 text-xs grid grid-cols-2 gap-x-4 gap-y-1.5">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Nama Karyawan:</span>
                <span className="font-black text-slate-900 text-xs sm:text-sm">{empName}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Unit / Cabang:</span>
                <span className="font-bold text-slate-800">{empBranch}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Jabatan:</span>
                <span className="font-semibold text-slate-800">{empPosition}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Tanggal Terbit:</span>
                <span className="font-semibold text-slate-800">{todayFormatted}</span>
              </div>
            </div>

            {/* ================= TABEL 2 KOLOM (PENDAPATAN & POTONGAN) ================= */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-3 text-xs">
              {/* Kolom Kiri: I. Pendapatan */}
              <div className="border border-slate-200 rounded-xl overflow-hidden flex flex-col">
                <div className="bg-emerald-50 print:bg-slate-100 px-3 py-1.5 border-b border-slate-200">
                  <h4 className="font-black text-[11px] text-emerald-900 print:text-slate-900 uppercase tracking-wider">
                    I. Komponen Penghasilan
                  </h4>
                </div>
                <div className="p-3 space-y-1.5 flex-1 text-[11px]">
                  <div className="flex justify-between text-slate-700">
                    <span>Gaji Pokok</span>
                    <span className="font-semibold">{formatRupiah(basicSalary)}</span>
                  </div>
                  {childAllowance > 0 && (
                    <div className="flex justify-between text-slate-700">
                      <span>Tunjangan Anak</span>
                      <span className="font-semibold">{formatRupiah(childAllowance)}</span>
                    </div>
                  )}
                  {spouseAllowance > 0 && (
                    <div className="flex justify-between text-slate-700">
                      <span>Tunjangan Istri</span>
                      <span className="font-semibold">{formatRupiah(spouseAllowance)}</span>
                    </div>
                  )}
                  {positionAllowance > 0 && (
                    <div className="flex justify-between text-slate-700">
                      <span>Tunjangan Jabatan</span>
                      <span className="font-semibold">{formatRupiah(positionAllowance)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-700">
                    <span>Tunjangan Makan</span>
                    <span className="font-semibold">{formatRupiah(mealAllowance)}</span>
                  </div>
                  <div className="flex justify-between text-slate-700">
                    <div>
                      <span>Uang Lembur</span>
                      {approvedHours > 0 && (
                        <span className="text-[10px] text-slate-500 block">
                          ({approvedHours} Jam @ Rp 20.000)
                        </span>
                      )}
                    </div>
                    <span className="font-semibold text-slate-900">
                      +{formatRupiah(overtimePay)}
                    </span>
                  </div>
                  {(plusDayPay > 0 || plusDayCount > 0) && (
                    <div className="flex justify-between text-slate-700 pt-1 border-t border-slate-100">
                      <div>
                        <span className="font-bold text-slate-900">Perbantuan (+Day)</span>
                        <span className="text-[10px] text-slate-500 block">
                          {plusDayCount} Hari {plusDayNote ? `(${plusDayNote})` : ''}
                        </span>
                      </div>
                      <span className="font-semibold text-slate-900">
                        +{formatRupiah(plusDayPay)}
                      </span>
                    </div>
                  )}
                </div>
                <div className="bg-slate-50 print:bg-slate-100/80 px-3 py-2 border-t border-slate-200 flex justify-between items-center text-[11px] font-black">
                  <span>Subtotal Penghasilan (A)</span>
                  <span className="text-emerald-800 print:text-slate-900">{formatRupiah(totalIncome)}</span>
                </div>
              </div>

              {/* Kolom Kanan: II. Potongan */}
              <div className="border border-slate-200 rounded-xl overflow-hidden flex flex-col">
                <div className="bg-rose-50 print:bg-slate-100 px-3 py-1.5 border-b border-slate-200">
                  <h4 className="font-black text-[11px] text-rose-900 print:text-slate-900 uppercase tracking-wider">
                    II. Komponen Potongan
                  </h4>
                </div>
                <div className="p-3 space-y-1.5 flex-1 text-[11px]">
                  <div className="flex justify-between text-slate-700">
                    <span>Potongan Makan</span>
                    <span className="font-semibold">{formatRupiah(mealDeduction)}</span>
                  </div>
                  <div className="flex justify-between text-slate-700">
                    <span>Potongan Kehadiran</span>
                    <span className="font-semibold">{formatRupiah(attendanceDeduction)}</span>
                  </div>
                  <div className="flex justify-between text-slate-700">
                    <span>Potongan Kedisiplinan</span>
                    <span className="font-semibold">{formatRupiah(disciplineDeduction)}</span>
                  </div>
                  <div className="flex justify-between text-slate-700">
                    <span>Cash Bon / Kasbon</span>
                    <span className="font-semibold">{formatRupiah(cashBon)}</span>
                  </div>
                </div>
                <div className="bg-slate-50 print:bg-slate-100/80 px-3 py-2 border-t border-slate-200 flex justify-between items-center text-[11px] font-black">
                  <span>Subtotal Potongan (B)</span>
                  <span className="text-rose-800 print:text-slate-900">{formatRupiah(totalDeductions)}</span>
                </div>
              </div>
            </div>

            {/* ================= KOTAK TOTAL GAJI BERSIH (TAKE HOME PAY) ================= */}
            <div className="bg-slate-900 text-white print:bg-slate-100 print:text-slate-900 print:border print:border-slate-300 rounded-xl p-3.5 my-3 flex justify-between items-center">
              <div>
                <span className="text-[10px] uppercase tracking-wider font-bold text-slate-300 print:text-slate-600 block">
                  Total Gaji Bersih Diterima
                </span>
                <span className="text-xs font-black uppercase text-white print:text-slate-900">
                  TAKE HOME PAY ( A - B )
                </span>
              </div>
              <span className="text-base sm:text-lg font-black tracking-tight text-white print:text-slate-900">
                {formatRupiah(netSalary)}
              </span>
            </div>

            {/* Catatan Transparansi Lembur Ditolak (Jika Ada) */}
            {rejectedOvertimes.length > 0 && (
              <div className="border border-amber-200 bg-amber-50/60 rounded-xl p-2.5 my-2 text-[10px] space-y-1">
                <span className="font-bold text-amber-900 block uppercase">
                  Catatan Pengajuan Lembur Ditolak Finance:
                </span>
                {rejectedOvertimes.map((ot) => (
                  <p key={ot.id} className="text-amber-800">
                    &bull; Tanggal {ot.date} ({ot.hours} Jam): Alasan: &ldquo;{ot.rejection_reason || 'Tidak disetujui Finance'}&rdquo;
                  </p>
                ))}
              </div>
            )}

            {/* ================= PENGESAHAN DOKUMEN ================= */}
            <div className="mt-6 pt-3 border-t border-slate-200 text-xs">
              <div className="flex justify-between items-start text-center">
                {/* Kolom Karyawan */}
                <div className="w-40 sm:w-48">
                  <p className="text-[10px] text-slate-500 font-bold uppercase mb-12">
                    Diterima Oleh,
                  </p>
                  <p className="font-black text-slate-900 border-b border-slate-400 pb-1 text-xs">
                    {empName}
                  </p>
                  <p className="text-[9px] text-slate-500 mt-0.5">Karyawan</p>
                </div>

                {/* Kolom Finance Department & Batang */}
                <div className="w-44 sm:w-56 text-center relative">
                  <p className="text-[10px] text-slate-500 font-medium mb-1">
                    Batang, {todayFormatted}
                  </p>
                  <p className="text-[10px] text-slate-700 font-bold uppercase mb-4">
                    Disahkan Oleh,
                  </p>

                  {/* Stempel Resmi Digital 3 Pillar */}
                  <div className="w-20 h-20 mx-auto rounded-full border-2 border-dashed border-blue-600/40 flex flex-col items-center justify-center rotate-[-8deg] my-1 p-1 select-none">
                    <span className="text-[8px] font-black text-blue-700 tracking-tighter uppercase leading-none">
                      3 PILLAR
                    </span>
                    <span className="text-[6px] font-bold text-emerald-700 uppercase tracking-widest my-0.5">
                      VERIFIED
                    </span>
                    <span className="text-[7px] font-bold text-blue-800 leading-none">
                      FINANCE
                    </span>
                  </div>

                  <p className="font-black text-slate-900 border-b border-slate-400 pb-1 text-xs mt-1">
                    Finance Department
                  </p>
                  <p className="text-[9px] text-slate-500 mt-0.5">
                    3 Pillar Management
                  </p>
                </div>
              </div>
            </div>

            {/* Catatan Kaki Otentikasi Dokumen */}
            <div className="mt-4 pt-2 border-t border-slate-100 flex items-center justify-between text-[8px] text-slate-400 select-none">
              <span>Dokumen resmi diterbitkan otomatis oleh Sistem Presensi &amp; Payroll PWA 3 Pillar Management</span>
              <span>Halaman 1/1</span>
            </div>
          </div>
        </div>

        {/* Modal Bottom Bar (Screen Only - No Print) */}
        <div className="no-print p-4 bg-white border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <p className="text-[11px] text-slate-500 leading-tight">
            💡 Pada HP Android/iPhone, pilih opsi <strong className="text-slate-800">"Simpan sebagai PDF"</strong> pada menu cetak untuk mengunduh ke folder Download.
          </p>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={handleTriggerPrint}
              className="py-2.5 px-4 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-black rounded-xl flex items-center gap-2 shadow-xs transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Simpan PDF Sekarang</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
