'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Banknote,
  DollarSign,
  Receipt,
  PlusCircle,
  MinusCircle,
  AlertCircle,
  CheckCircle2,
  Clock,
  Calendar,
  Store,
  FileText,
  Send,
  Loader2,
  RefreshCw,
  Sparkles,
  Calculator,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Archive,
  MessageCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { CurrencyInput, formatRupiah } from '@/lib/currency';
import { getLocalDateString } from '@/lib/date';

// Helper format tanggal laporan ke bahasa Indonesia (contoh: "Selasa, 06-10-2026")
const formatReportDateIndo = (dateStr) => {
  if (!dateStr) return '-';
  try {
    const raw = String(dateStr).includes('T') ? String(dateStr).substring(0, 10) : String(dateStr);
    const parts = raw.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const dayName = dayNames[d.getDay()] || '';
      const dd = String(day).padStart(2, '0');
      const mm = String(month + 1).padStart(2, '0');
      const yyyy = String(year);
      return `${dayName ? `${dayName}, ` : ''}${dd}-${mm}-${yyyy}`;
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const dayName = dayNames[d.getDay()] || '';
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${dayName ? `${dayName}, ` : ''}${dd}-${mm}-${yyyy}`;
    }
    return dateStr;
  } catch (e) {
    return dateStr;
  }
};

export default function CashierReportTab() {
  const { user, userOutlet, currentOutlet, outlets } = useAuth();
  const outlet = userOutlet || currentOutlet || outlets?.[0];
  const outletName = user?.branch || outlet?.name || 'LazyBloom';

  const todayStr = getLocalDateString();

  // Form State
  const [reportDate, setReportDate] = useState(todayStr);
  const [shiftName, setShiftName] = useState('Shift Pagi');
  const [startingCash, setStartingCash] = useState(0); // Modal Awal Laci
  const [incomeCash, setIncomeCash] = useState(0); // Penjualan Cash
  const [incomeQris, setIncomeQris] = useState(0); // Penjualan QRIS/Non-tunai

  // Pengeluaran Kas Kecil Multi-Item Dinamis
  const [expenseItems, setExpenseItems] = useState([
    { id: 1, note: '', amount: 0 },
  ]);

  const [actualCashCounted, setActualCashCounted] = useState(0); // Kas fisik di laci
  const [notes, setNotes] = useState(''); // Catatan kasir

  const [loading, setLoading] = useState(false);
  const [submitMsg, setSubmitMsg] = useState({ type: '', text: '' });
  const [historyReports, setHistoryReports] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [archivingId, setArchivingId] = useState(null);

  // Accordion Bulan State
  const [expandedMonths, setExpandedMonths] = useState({});

  // Helper Pengeluaran Multi-Item
  const handleAddExpenseItem = () => {
    setExpenseItems((prev) => [
      ...prev,
      { id: Date.now(), note: '', amount: 0 },
    ]);
  };

  const handleRemoveExpenseItem = (id) => {
    setExpenseItems((prev) => {
      const filtered = prev.filter((item) => item.id !== id);
      return filtered.length > 0 ? filtered : [{ id: Date.now(), note: '', amount: 0 }];
    });
  };

  const handleUpdateExpenseItem = (id, field, value) => {
    setExpenseItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  // Kalkulasi Otomatis
  const totalExpense = expenseItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const totalIncome = (Number(incomeCash) || 0) + (Number(incomeQris) || 0);
  const expectedCash = (Number(startingCash) || 0) + (Number(incomeCash) || 0) - totalExpense;
  const cashDifference = (Number(actualCashCounted) || 0) - expectedCash;

  // Muat riwayat laporan kasir (khusus outlet kasir yang sedang bertugas)
  const fetchReports = async () => {
    setLoadingHistory(true);
    try {
      let query = supabase
        .from('outlet_cash_reports')
        .select('*')
        .order('report_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (outletName && outletName !== 'all') {
        const cleanName = outletName.trim();
        query = query.ilike('branch', `%${cleanName}%`);
      }

      const { data, error } = await query;
      let remoteReports = [];
      if (!error && Array.isArray(data)) {
        remoteReports = data;
      }

      // Ambil juga dari local storage fallback jika ada
      let localReports = [];
      if (typeof window !== 'undefined') {
        try {
          localReports = JSON.parse(localStorage.getItem('pwa_outlet_cash_reports') || '[]');
        } catch (e) {}
      }

      // Gabungkan & deduplikasi berdasarkan id, strictly filter berdasarkan outletName
      const combined = [...remoteReports];
      if (Array.isArray(localReports)) {
        localReports.forEach((loc) => {
          const locBranch = (loc.branch || '').toLowerCase().replace(/\s/g, '');
          const curBranch = (outletName || '').toLowerCase().replace(/\s/g, '');
          const matchBranch = !curBranch || locBranch.includes(curBranch) || curBranch.includes(locBranch);
          if (matchBranch && !combined.some((r) => r.id === loc.id)) {
            combined.push(loc);
          }
        });
      }

      combined.sort(
        (a, b) =>
          new Date(b.report_date || b.created_at) - new Date(a.report_date || a.created_at)
      );
      setHistoryReports(combined);
    } catch (err) {
      console.warn('Fetch cashier reports error:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [outletName]);

  // Handler Arsip Laporan oleh Kasir (karena salah input, otomatis sync ke dashboard owner)
  const handleArchiveReport = async (report) => {
    if (!report?.id) return;
    const confirmMsg = `Yakin ingin mengarsipkan laporan kasir tanggal ${report.report_date} (${report.shift_name || 'Shift'}) ini?\n\nLaporan ini ditandai salah input dan otomatis tidak dihitung pada omset dashboard Owner. Hanya Owner yang dapat memulihkannya.`;
    if (!window.confirm(confirmMsg)) return;

    setArchivingId(report.id);
    try {
      // 1. Update ke Supabase
      const { error } = await supabase
        .from('outlet_cash_reports')
        .update({ is_archived: true })
        .eq('id', report.id);

      if (error) console.warn('Supabase archive cashier report error:', error);

      // 2. Update persistent cache local storage
      try {
        const local = JSON.parse(localStorage.getItem('pwa_outlet_cash_reports') || '[]');
        const updated = local.map((r) => (r.id === report.id ? { ...r, is_archived: true } : r));
        localStorage.setItem('pwa_outlet_cash_reports', JSON.stringify(updated));
      } catch (e) {}

      // 3. Update state lokal
      setHistoryReports((prev) =>
        prev.map((r) => (r.id === report.id ? { ...r, is_archived: true } : r))
      );

      setSubmitMsg({
        type: 'success',
        text: `Laporan kasir tanggal ${report.report_date} (${report.shift_name}) berhasil diarsipkan dan disinkronkan ke Owner.`,
      });
    } catch (err) {
      console.error('Archive error:', err);
      setSubmitMsg({
        type: 'error',
        text: `Gagal mengarsipkan laporan: ${err.message}`,
      });
    } finally {
      setArchivingId(null);
    }
  };

  // Pengelompokan riwayat laporan kasir ke Accordion Berdasarkan Bulan
  const monthlyGroupedReports = useMemo(() => {
    const groups = {};
    const MONTH_NAMES = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];

    historyReports.forEach((item) => {
      const dateVal = item.report_date || (item.created_at ? item.created_at.substring(0, 10) : '');
      let monthKey = 'Lainnya';
      let monthLabel = 'Periode Lainnya';

      if (dateVal && dateVal.length >= 7) {
        const yearPart = dateVal.substring(0, 4);
        const monthNum = parseInt(dateVal.substring(5, 7), 10);
        if (!isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
          monthKey = `${yearPart}-${String(monthNum).padStart(2, '0')}`;
          monthLabel = `${MONTH_NAMES[monthNum - 1]} ${yearPart}`;
        }
      }

      if (!groups[monthKey]) {
        groups[monthKey] = {
          key: monthKey,
          label: monthLabel,
          reports: [],
          totalOmset: 0,
        };
      }

      groups[monthKey].reports.push(item);

      // Omzet valid (hanya yang tidak diarsipkan)
      if (!item.is_archived) {
        const income =
          Number(item.total_income) ||
          (Number(item.income_cash) || 0) + (Number(item.income_qris) || 0);
        groups[monthKey].totalOmset += income;
      }
    });

    // Urutkan bulan terbaru paling atas
    const sortedKeys = Object.keys(groups).sort().reverse();
    return sortedKeys.map((k) => groups[k]);
  }, [historyReports]);

  // Buka bulan terbaru secara default saat data dimuat
  useEffect(() => {
    if (monthlyGroupedReports.length > 0) {
      const latestKey = monthlyGroupedReports[0].key;
      setExpandedMonths((prev) => {
        if (Object.keys(prev).length === 0) {
          return { [latestKey]: true };
        }
        return prev;
      });
    }
  }, [monthlyGroupedReports]);

  const toggleMonth = (key) => {
    setExpandedMonths((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitMsg({ type: '', text: '' });

    if (totalIncome === 0 && totalExpense === 0 && actualCashCounted === 0) {
      setSubmitMsg({
        type: 'error',
        text: 'Harap isi nominal pemasukan, pengeluaran, atau kas akhir sebelum mengirim laporan.',
      });
      return;
    }

    setLoading(true);

    const formattedExpenseNotes = expenseItems
      .filter((item) => item.note.trim() || Number(item.amount) > 0)
      .map((item, idx) => `${idx + 1}. ${item.note.trim() || 'Pengeluaran'}: ${formatRupiah(item.amount)}`)
      .join('\n');

    const payload = {
      branch: outletName,
      report_date: reportDate,
      shift_name: shiftName,
      cashier_id: user?.id || null,
      cashier_name: user?.full_name || 'Kasir Outlet',
      starting_cash: Number(startingCash) || 0,
      income_cash: Number(incomeCash) || 0,
      income_qris: Number(incomeQris) || 0,
      total_income: totalIncome,
      expense_amount: totalExpense,
      expense_notes: formattedExpenseNotes,
      actual_cash_counted: Number(actualCashCounted) || 0,
      expected_cash: expectedCash,
      cash_difference: cashDifference,
      notes: notes.trim(),
      status: 'Terkirim',
    };

    try {
      let savedId = `csh_${Date.now()}`;
      let insertedRow = null;

      // 1. Simpan ke Supabase
      const { data, error } = await supabase
        .from('outlet_cash_reports')
        .insert(payload)
        .select('*')
        .single();

      if (!error && data) {
        insertedRow = data;
        savedId = data.id;
      } else if (error) {
        console.warn('Supabase cashier report insert warning:', error);
      }

      // 2. Simpan backup lokal & cache
      const itemToSave = insertedRow || {
        ...payload,
        id: savedId,
        created_at: new Date().toISOString(),
      };

      try {
        const saved = JSON.parse(localStorage.getItem('pwa_outlet_cash_reports') || '[]');
        const updated = [itemToSave, ...saved.filter((r) => r.id !== savedId)];
        localStorage.setItem('pwa_outlet_cash_reports', JSON.stringify(updated.slice(0, 30)));
      } catch (e) {}

      setHistoryReports((prev) => [itemToSave, ...prev.filter((r) => r.id !== savedId)]);

      setSubmitMsg({
        type: 'success',
        text: `Laporan Kasir ${outletName} (${shiftName}) berhasil dikirim ke Admin Finance!`,
      });

      // Reset input form
      setExpenseItems([{ id: Date.now(), note: '', amount: 0 }]);
      setNotes('');
    } catch (err) {
      console.error('Submit cashier report error:', err);
      setSubmitMsg({
        type: 'error',
        text: `Terjadi kendala saat menyimpan laporan: ${err.message}`,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Header Info Kasir */}
      <div className="bg-gradient-to-r from-emerald-800 via-teal-900 to-slate-900 text-white rounded-3xl p-4 shadow-sm border border-emerald-700/50 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-emerald-300 shadow-inner">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-black tracking-wide">Laporan Kasir Harian</h3>
                <span className="text-[9px] bg-emerald-500/30 text-emerald-300 border border-emerald-400/30 font-black px-2 py-0.5 rounded-full">
                  Closing Shift
                </span>
              </div>
              <p className="text-[11px] text-emerald-200/80">
                {outletName} &bull; Kasir: <strong>{user?.full_name || 'Staf Kasir'}</strong>
              </p>
            </div>
          </div>
        </div>

        <div className="p-2.5 bg-white/5 border border-white/10 rounded-2xl text-[10px] text-emerald-100 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
          <span>
            Input pemasukan tunai &amp; QRIS, pengeluaran kas kecil, serta hitung fisik uang kas sebelum serah terima shift/toko.
          </span>
        </div>
      </div>

      {/* Pesan Notifikasi Sukses / Gagal */}
      {submitMsg.text && (
        <div
          className={`p-3.5 rounded-2xl text-xs flex items-center gap-2.5 animate-in fade-in duration-150 ${
            submitMsg.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}
        >
          {submitMsg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span className="font-semibold leading-relaxed">{submitMsg.text}</span>
        </div>
      )}

      {/* FORMULIR UTAMA KASIR */}
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {/* Info Shift & Tanggal */}
        <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-xs space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-slate-600 mb-1">
                Tanggal Laporan
              </label>
              <input
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:border-emerald-600 focus:outline-hidden"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-600 mb-1">
                Shift Kasir
              </label>
              <select
                value={shiftName}
                onChange={(e) => setShiftName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:border-emerald-600 focus:outline-hidden cursor-pointer"
              >
                <option value="Shift Pagi">Shift Pagi</option>
                <option value="Shift Siang">Shift Siang</option>
                <option value="Full Day">Full Day</option>
              </select>
            </div>
          </div>
        </div>

        {/* 1. SEKSI PEMASUKAN OUTLET */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <PlusCircle className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-black text-slate-900">1. Pemasukan Penjualan</h4>
            </div>
            <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              Total: {formatRupiah(totalIncome)}
            </span>
          </div>

          <div className="space-y-2.5">
            {/* Modal Awal Kas di Laci */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-bold text-slate-700">Modal Awal di Laci (Kas Kecil)</label>
                <span className="text-[9px] text-slate-400">Modal kembalian awal</span>
              </div>
              <CurrencyInput
                value={startingCash}
                onChange={setStartingCash}
                placeholder="Rp 0"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:border-emerald-600 focus:outline-hidden"
              />
            </div>

            {/* Pemasukan Tunai */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-bold text-emerald-800">Pemasukan Tunai (Cash di Laci)</label>
                <span className="text-[9px] text-emerald-600 font-bold">Uang Fisik</span>
              </div>
              <CurrencyInput
                value={incomeCash}
                onChange={setIncomeCash}
                placeholder="Rp 0"
                className="w-full bg-emerald-50/50 border border-emerald-300 rounded-xl px-3 py-2 text-xs font-black text-emerald-800 focus:bg-white focus:border-emerald-600 focus:outline-hidden"
              />
            </div>

            {/* Pemasukan QRIS / Transfer / EDC */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-bold text-blue-800">Pemasukan QRIS / Non-Tunai / EDC</label>
                <span className="text-[9px] text-blue-600 font-bold">Langsung ke Rekening</span>
              </div>
              <CurrencyInput
                value={incomeQris}
                onChange={setIncomeQris}
                placeholder="Rp 0"
                className="w-full bg-blue-50/50 border border-blue-300 rounded-xl px-3 py-2 text-xs font-black text-blue-800 focus:bg-white focus:border-blue-600 focus:outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* 2. SEKSI PENGELUARAN OPERASIONAL (MULTI-ITEM DINAMIS) */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                <MinusCircle className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-black text-slate-900">2. Pengeluaran Operasional Toko</h4>
                <p className="text-[9px] text-slate-400">Kas kecil (beli es batu, gas, galon, dll)</p>
              </div>
            </div>
            <span className="text-[10px] font-extrabold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
              Total: {formatRupiah(totalExpense)}
            </span>
          </div>

          {/* Quick preset buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-[9px] font-bold text-slate-400 shrink-0">Template cepat:</span>
            {['Es Batu Kristal', 'Galon Aqua', 'Gas Elpiji 3kg', 'Plastik Takeaway', 'ATK / Bon'].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setExpenseItems((prev) => {
                    // Cek jika baris terakhir masih kosong note-nya
                    const last = prev[prev.length - 1];
                    if (last && !last.note) {
                      return prev.map((item, idx) => (idx === prev.length - 1 ? { ...item, note: preset } : item));
                    }
                    return [...prev, { id: Date.now(), note: preset, amount: 0 }];
                  });
                }}
                className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 text-[9px] font-semibold transition shrink-0 cursor-pointer"
              >
                + {preset}
              </button>
            ))}
          </div>

          {/* List of dynamic expense items */}
          <div className="space-y-2">
            {expenseItems.map((item, idx) => (
              <div
                key={item.id}
                className="p-2.5 bg-slate-50/90 rounded-xl border border-slate-200/80 space-y-2 animate-in fade-in duration-150"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-700">
                    Item Pengeluaran #{idx + 1}
                  </span>
                  {expenseItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveExpenseItem(item.id)}
                      className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 transition cursor-pointer"
                      title="Hapus baris ini"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <input
                      type="text"
                      value={item.note}
                      onChange={(e) => handleUpdateExpenseItem(item.id, 'note', e.target.value)}
                      placeholder="Nama barang / nota (misal: Es batu 2 sak)"
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-rose-500"
                    />
                  </div>
                  <div>
                    <CurrencyInput
                      value={item.amount}
                      onChange={(val) => handleUpdateExpenseItem(item.id, 'amount', val)}
                      placeholder="Rp 0"
                      className="w-full bg-white border border-rose-200 rounded-lg px-2.5 py-1.5 text-xs font-black text-rose-700 focus:outline-hidden focus:border-rose-500"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Tombol Tambah Item Pengeluaran */}
          <button
            type="button"
            onClick={handleAddExpenseItem}
            className="w-full py-2 bg-rose-50/70 hover:bg-rose-100 text-rose-700 border border-dashed border-rose-300 rounded-xl text-[11px] font-black flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Item Pengeluaran Lain</span>
          </button>
        </div>

        {/* 3. REKONSILIASI KAS FISIK DI LACI (CLOSING CASHIER) */}
        <div className="bg-white rounded-2xl p-4 border-2 border-emerald-300/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-emerald-200/60">
            <div className="flex items-center gap-2">
              <Calculator className="w-4 h-4 text-emerald-700" />
              <h4 className="text-xs font-black text-slate-900">3. Rekonsiliasi Kas Fisik di Laci</h4>
            </div>
            <span className="text-[9px] bg-emerald-100 text-emerald-900 font-extrabold px-2 py-0.5 rounded-full">
              Wajib Hitung Fisik
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
            <div className="flex items-center justify-between text-slate-600 text-[11px]">
              <span>Modal Awal:</span>
              <span className="font-bold">{formatRupiah(startingCash)}</span>
            </div>
            <div className="flex items-center justify-between text-emerald-700 text-[11px]">
              <span>+ Pemasukan Tunai:</span>
              <span className="font-bold">+{formatRupiah(incomeCash)}</span>
            </div>
            <div className="flex items-center justify-between text-rose-700 text-[11px]">
              <span>- Pengeluaran Kas:</span>
              <span className="font-bold">-{formatRupiah(totalExpense)}</span>
            </div>
            <div className="pt-1.5 border-t border-slate-200 flex items-center justify-between text-slate-900 font-black">
              <span>Ekspektasi Uang di Laci:</span>
              <span className="text-emerald-700 text-sm">{formatRupiah(expectedCash)}</span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-black text-slate-800">
                Hitung Fisik Uang di Laci Sekarang (Rp)
              </label>
              <span className="text-[9px] text-slate-400">Total uang fisik kasir</span>
            </div>
            <CurrencyInput
              value={actualCashCounted}
              onChange={setActualCashCounted}
              placeholder="Rp 0"
              className="w-full bg-white border-2 border-emerald-400 rounded-xl px-3 py-2 text-sm font-black text-slate-900 focus:outline-hidden focus:border-emerald-600"
              required
            />
          </div>

          {/* Indikator Selisih Kas Otomatis */}
          <div
            className={`p-2.5 rounded-xl border flex items-center justify-between text-xs font-bold ${
              cashDifference === 0
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                : cashDifference < 0
                ? 'bg-rose-50 border-rose-300 text-rose-800'
                : 'bg-blue-50 border-blue-300 text-blue-800'
            }`}
          >
            <div className="flex items-center gap-1.5">
              {cashDifference === 0 ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>
                {cashDifference === 0
                  ? 'Kas Fisik Pas / Sesuai'
                  : cashDifference < 0
                  ? 'Kas Kurang (Minus)'
                  : 'Kas Lebih (Surplus)'}
              </span>
            </div>
            <span className="font-black text-sm">
              {cashDifference > 0 ? `+${formatRupiah(cashDifference)}` : formatRupiah(cashDifference)}
            </span>
          </div>

          {/* Catatan Tambahan */}
          <div>
            <label className="block text-[10px] font-bold text-slate-600 mb-1">
              Catatan Kasir / Keterangan Selisih (Opsional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Misal: Uang fisik diserahkan ke Leader Budi"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-emerald-600 focus:outline-hidden"
            />
          </div>
        </div>

        {/* Tombol Kirim Laporan */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 text-white text-xs font-black rounded-2xl shadow-md shadow-emerald-500/25 active:scale-98 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Mengirim Laporan Kasir...</span>
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              <span>Kirim Laporan Kasir Hari Ini</span>
            </>
          )}
        </button>
      </form>

      {/* RIWAYAT LAPORAN KASIR TERAKHIR (ACCORDION BERDASARKAN BULAN) */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-sm space-y-3.5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs sm:text-sm font-black text-slate-800 truncate">
                Riwayat Laporan Kasir {outletName}
              </h4>
              <p className="text-[10px] text-slate-400 font-medium truncate">
                Dikelompokkan berdasarkan bulan &bull; Sinkron dengan Owner Dashboard
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={fetchReports}
            disabled={loadingHistory}
            className="px-2.5 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-[10px] text-slate-700 font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50 shrink-0"
            title="Segarkan data riwayat laporan kasir"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? 'animate-spin text-emerald-600' : ''}`} />
            <span className="hidden sm:inline">Segarkan</span>
          </button>
        </div>

        {loadingHistory ? (
          <div className="py-8 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
            <span>Memuat riwayat kasir {outletName}...</span>
          </div>
        ) : monthlyGroupedReports.length === 0 ? (
          <div className="py-8 text-center text-slate-400 space-y-1.5">
            <FileText className="w-7 h-7 mx-auto text-slate-300" />
            <p className="text-xs font-bold text-slate-700">Belum ada riwayat laporan kasir</p>
            <p className="text-[10px] max-w-xs mx-auto">
              Laporan closing shift untuk outlet {outletName} yang Anda kirim akan otomatis diarsipkan per bulan di sini.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {monthlyGroupedReports.map((group) => {
              const isExpanded = Boolean(expandedMonths[group.key]);
              const activeCount = group.reports.filter((r) => !r.is_archived).length;
              const archivedCount = group.reports.filter((r) => r.is_archived).length;

              return (
                <div
                  key={group.key}
                  className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs transition"
                >
                  {/* Header Accordion Bulan */}
                  <button
                    type="button"
                    onClick={() => toggleMonth(group.key)}
                    className="w-full p-3 sm:p-3.5 bg-slate-50/70 hover:bg-slate-100/70 flex items-center justify-between gap-3 text-left transition cursor-pointer select-none border-b border-slate-100"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold shrink-0">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h5 className="text-xs sm:text-sm font-black text-slate-900 truncate">
                          {group.label}
                        </h5>
                        <p className="text-[10px] text-slate-500 font-medium">
                          {group.reports.length} Laporan{' '}
                          {archivedCount > 0 && (
                            <span className="text-rose-600 font-semibold">({archivedCount} diarsip)</span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <span className="text-[8px] text-slate-400 font-bold block uppercase tracking-wider">
                          Omzet Valid
                        </span>
                        <span className="text-xs sm:text-sm font-black text-emerald-700">
                          {formatRupiah(group.totalOmset)}
                        </span>
                      </div>
                      <div className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-500">
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </div>
                    </div>
                  </button>

                  {/* Konten Laporan dalam Bulan */}
                  {isExpanded && (
                    <div className="p-3 sm:p-3.5 space-y-2.5 bg-white divide-y divide-slate-100">
                      {group.reports.map((item) => {
                        const isArchived = Boolean(item.is_archived);
                        const isVerified = item.status === 'Diverifikasi Owner';
                        const diff = Number(item.cash_difference) || 0;

                        const totalOmzet =
                          Number(item.total_income) ||
                          (Number(item.income_cash) || 0) + (Number(item.income_qris) || 0);
                        const cashTotal =
                          (Number(item.income_cash) || 0) - (Number(item.expense_amount) || 0);
                        const formattedWaDate = formatReportDateIndo(item.report_date || item.created_at);
                        const formattedExpenseList =
                          item.expense_notes && item.expense_notes.trim()
                            ? item.expense_notes.trim()
                            : '-';

                        const waMessage = [
                          '*LAPORAN KASIR 3 PILLAR*',
                          `Outlet: ${item.branch || outletName}`,
                          `Shift: ${item.shift_name || '-'}`,
                          `Tanggal: ${formattedWaDate}`,
                          `Kasir: ${item.cashier_name || user?.full_name || '-'}`,
                          '-----------------------------',
                          `Modal Awal: ${formatRupiah(item.starting_cash || 0)}`,
                          `Penjualan Cash: ${formatRupiah(item.income_cash || 0)}`,
                          `Penjualan QRIS: ${formatRupiah(item.income_qris || 0)}`,
                          `*Total Omzet:* ${formatRupiah(totalOmzet)}`,
                          '-----------------------------',
                          '*Pengeluaran:*',
                          formattedExpenseList,
                          `Total Pengeluaran: ${formatRupiah(item.expense_amount || 0)}`,
                          '-----------------------------',
                          `Modal Awal: ${formatRupiah(item.starting_cash || 0)}`,
                          `*Cash Total: ${formatRupiah(cashTotal)}*`,
                          '-----------------------------',
                          `Status: ${isArchived ? 'Diarsipkan (Dibatalkan)' : (item.status || 'Terkirim')}`,
                        ].join('\n');

                        return (
                          <div
                            key={item.id}
                            className={`p-3 rounded-xl border text-xs space-y-2 transition pt-3 first:pt-0 ${
                              isArchived
                                ? 'bg-slate-50/80 border-slate-200 text-slate-500 opacity-75'
                                : 'bg-slate-50/60 hover:bg-slate-50 border-slate-200/80'
                            }`}
                          >
                            {/* Baris 1: Outlet, Shift, Tanggal, & Badge Status */}
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-black text-slate-900 text-xs">{item.branch}</span>
                                <span className="text-[9px] bg-slate-200 text-slate-700 font-bold px-1.5 py-0.2 rounded-md">
                                  {item.shift_name || 'Shift'}
                                </span>
                                <span className="text-[10px] text-slate-500 font-medium">
                                  &bull; {item.report_date}
                                </span>
                              </div>

                              <div>
                                {isArchived ? (
                                  <span className="text-[9px] bg-slate-200 text-slate-700 border border-slate-300 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <Archive className="w-3 h-3 text-slate-500" />
                                    <span>Diarsipkan (Salah Input)</span>
                                  </span>
                                ) : isVerified ? (
                                  <span className="text-[9px] bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    <span>Diverifikasi Owner</span>
                                  </span>
                                ) : (
                                  <span className="text-[9px] bg-blue-50 text-blue-700 border border-blue-200 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-blue-500" />
                                    <span>{item.status || 'Terkirim'}</span>
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Baris 2: Grid Metrik Finansial */}
                            <div className="grid grid-cols-3 gap-1.5 p-2 bg-white rounded-lg border border-slate-100 text-[10px]">
                              <div>
                                <span className="text-[8px] text-slate-400 font-bold block uppercase tracking-wider">
                                  Total Omzet
                                </span>
                                <span
                                  className={`font-black ${
                                    isArchived ? 'line-through text-slate-400' : 'text-emerald-700'
                                  }`}
                                >
                                  {formatRupiah(
                                    item.total_income ||
                                      (Number(item.income_cash) || 0) + (Number(item.income_qris) || 0)
                                  )}
                                </span>
                                <span className="text-[8px] text-slate-400 block mt-0.5 truncate">
                                  Tunai: {formatRupiah(item.income_cash || 0)}
                                </span>
                              </div>

                              <div>
                                <span className="text-[8px] text-slate-400 font-bold block uppercase tracking-wider">
                                  Pengeluaran
                                </span>
                                <span
                                  className={`font-bold ${
                                    isArchived ? 'line-through text-slate-400' : 'text-rose-600'
                                  }`}
                                >
                                  {formatRupiah(item.expense_amount || 0)}
                                </span>
                                <span className="text-[8px] text-slate-400 block mt-0.5 truncate">
                                  QRIS: {formatRupiah(item.income_qris || 0)}
                                </span>
                              </div>

                              <div>
                                <span className="text-[8px] text-slate-400 font-bold block uppercase tracking-wider">
                                  Fisik di Laci
                                </span>
                                <span className="font-black text-slate-800">
                                  {formatRupiah(item.actual_cash_counted || item.closing_cash || 0)}
                                </span>
                                <span
                                  className={`text-[8px] font-bold block mt-0.5 truncate ${
                                    diff === 0
                                      ? 'text-emerald-600'
                                      : diff < 0
                                      ? 'text-rose-600'
                                      : 'text-blue-600'
                                  }`}
                                >
                                  Selisih: {diff === 0 ? 'Pas' : formatRupiah(diff)}
                                </span>
                              </div>
                            </div>

                            {/* Rincian Nota & Catatan */}
                            {item.expense_notes && (
                              <p className="text-[10px] text-slate-500 italic bg-amber-50/60 p-1.5 rounded-md border border-amber-100 leading-relaxed">
                                &bull; Pengeluaran: {item.expense_notes}
                              </p>
                            )}

                            {item.notes && (
                              <p className="text-[10px] text-slate-600 bg-white p-1.5 rounded-md border border-slate-100">
                                Catatan: <span className="font-medium">{item.notes}</span>
                              </p>
                            )}

                            {/* Baris 3: Info Kasir, Tombol Kirim WA & Tombol Arsip */}
                            <div className="flex items-center justify-between text-[9px] text-slate-400 pt-1.5 border-t border-slate-200/60 flex-wrap gap-2">
                              <span>
                                Kasir: <strong className="text-slate-700">{item.cashier_name}</strong>
                              </span>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {/* Tombol Kirim Ringkasan Laporan ke Group WA */}
                                <a
                                  href={`https://wa.me/?text=${encodeURIComponent(waMessage)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold flex items-center gap-1 transition shadow-2xs cursor-pointer active:scale-95"
                                  title="Kirim ringkasan laporan ke group WhatsApp"
                                >
                                  <MessageCircle className="w-3 h-3" />
                                  <span>Kirim WA</span>
                                </a>

                                {/* Tombol Arsip */}
                                {!isArchived ? (
                                  <button
                                    type="button"
                                    disabled={archivingId === item.id}
                                    onClick={() => handleArchiveReport(item)}
                                    className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[10px] font-bold flex items-center gap-1 transition cursor-pointer active:scale-95 disabled:opacity-50"
                                    title="Arsipkan laporan ini karena salah input (tidak dihitung di omset dashboard owner)"
                                  >
                                    <Archive className="w-3 h-3" />
                                    <span>{archivingId === item.id ? 'Mengarsipkan...' : 'Arsipkan'}</span>
                                  </button>
                                ) : (
                                  <span className="text-[9px] text-slate-400 italic">
                                    Salah input &bull; Tidak dihitung di dashboard owner
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
