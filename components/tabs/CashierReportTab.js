'use client';

import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { CurrencyInput, formatRupiah } from '@/lib/currency';
import { getLocalDateString } from '@/lib/date';

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

  // Muat riwayat laporan kasir
  const fetchReports = async () => {
    setLoadingHistory(true);
    try {
      let remoteReports = [];
      const { data, error } = await supabase
        .from('outlet_cash_reports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (!error && data) {
        remoteReports = data;
      }

      // Ambil juga dari local storage fallback jika ada
      let localReports = [];
      if (typeof window !== 'undefined') {
        try {
          localReports = JSON.parse(localStorage.getItem('pwa_outlet_cash_reports') || '[]');
        } catch (e) {}
      }

      // Gabungkan & deduplikasi berdasarkan id
      const combined = [...remoteReports];
      localReports.forEach((loc) => {
        if (!combined.some((r) => r.id === loc.id)) {
          combined.push(loc);
        }
      });

      combined.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setHistoryReports(combined);
    } catch (err) {
      console.warn('Fetch cashier reports error:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

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

      {/* RIWAYAT LAPORAN KASIR TERAKHIR */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-500" />
            <h4 className="text-xs font-black text-slate-800">Riwayat Laporan Kasir Terakhir</h4>
          </div>
          <button
            type="button"
            onClick={fetchReports}
            className="text-[10px] text-emerald-700 hover:underline font-bold flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 ${loadingHistory ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </button>
        </div>

        {loadingHistory ? (
          <div className="py-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
            <span>Memuat riwayat kasir...</span>
          </div>
        ) : historyReports.length === 0 ? (
          <div className="py-6 text-center text-slate-400 space-y-1">
            <FileText className="w-6 h-6 mx-auto text-slate-300" />
            <p className="text-xs font-semibold">Belum ada riwayat laporan kasir</p>
            <p className="text-[10px]">Laporan yang Anda kirim akan muncul di sini.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {historyReports.map((item) => (
              <div
                key={item.id}
                className="p-3 bg-slate-50/80 hover:bg-slate-50 rounded-xl border border-slate-200/70 text-xs space-y-2 transition"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-slate-900 text-xs">{item.branch}</span>
                    <span className="text-[9px] bg-slate-200 text-slate-700 font-bold px-1.5 py-0.2 rounded-md">
                      {item.shift_name || 'Shift'}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium">
                    {item.report_date}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-1.5 p-2 bg-white rounded-lg border border-slate-100 text-[10px]">
                  <div>
                    <span className="text-[8px] text-slate-400 font-bold block">Pemasukan</span>
                    <span className="font-black text-emerald-700">
                      {formatRupiah(item.total_income || 0)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[8px] text-slate-400 font-bold block">Pengeluaran</span>
                    <span className="font-bold text-rose-600">
                      {formatRupiah(item.expense_amount || 0)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[8px] text-slate-400 font-bold block">Fisik di Laci</span>
                    <span className="font-black text-slate-800">
                      {formatRupiah(item.actual_cash_counted || item.closing_cash || 0)}
                    </span>
                  </div>
                </div>

                {item.expense_notes && (
                  <p className="text-[10px] text-slate-500 italic bg-amber-50/60 p-1.5 rounded-md border border-amber-100">
                    &bull; Pengeluaran: {item.expense_notes}
                  </p>
                )}

                <div className="flex items-center justify-between text-[9px] text-slate-400 pt-0.5">
                  <span>Kasir: {item.cashier_name}</span>
                  <span className="text-emerald-600 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>{item.status || 'Terkirim'}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
