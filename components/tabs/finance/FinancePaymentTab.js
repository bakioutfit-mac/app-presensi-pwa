'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { CreditCard, CheckCircle, Loader2, Receipt, Image as ImageIcon } from 'lucide-react';

export default function FinancePaymentTab() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  
  // State untuk form pembayaran
  const [paymentModal, setPaymentModal] = useState({ open: false, reqId: null, totalAmount: '' });
  const [toast, setToast] = useState({ type: '', text: '' });

  const showToast = (type, text) => {
    setToast({ type, text });
    setTimeout(() => setToast({ type: '', text: '' }), 4000);
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('purchase_requests')
        .select(`
          id, outlet_name, request_date, status, payment_status, total_amount, payment_receipt_url,
          purchase_request_items(
            qty_requested,
            catalog:catalog_id(item_name, uom, supplier:supplier_id(name))
          )
        `)
        // Filter: Yang status barunya bukan 'Draft' / 'Menunggu Purchasing'
        // Asumsi: Begitu masuk 'Diproses' atau lebih, Purchasing sudah info harga, 
        // tapi kita filter khusus yang 'Belum Bayar'
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvoices(data || []);
    } catch (err) {
      console.error('Error fetching invoices:', err);
      showToast('error', 'Gagal memuat tagihan PO.');
    } finally {
      setLoading(false);
    }
  };

  const handlePay = async (e) => {
    e.preventDefault();
    if (!paymentModal.totalAmount || paymentModal.totalAmount <= 0) {
      showToast('error', 'Masukkan nominal transfer yang valid!');
      return;
    }

    setProcessingId(paymentModal.reqId);
    try {
      const { error } = await supabase
        .from('purchase_requests')
        .update({
          payment_status: 'Lunas',
          total_amount: paymentModal.totalAmount,
          // Simpan string dummy foto resi untuk sekarang (bisa diganti storage UI nanti)
          payment_receipt_url: 'https://via.placeholder.com/400x600.png?text=Bukti+Transfer'
        })
        .eq('id', paymentModal.reqId);

      if (error) throw error;

      showToast('success', 'Pembayaran berhasil dikonfirmasi (Lunas)!');
      setPaymentModal({ open: false, reqId: null, totalAmount: '' });
      fetchInvoices(); // Refresh data
    } catch (err) {
      console.error('Payment error:', err);
      showToast('error', 'Gagal memproses pembayaran: ' + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Toast Notification */}
      {toast.text && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-sm pointer-events-none">
          <div className={`p-4 rounded-2xl shadow-xl flex items-center gap-3 animate-in slide-in-from-top-10 fade-in duration-300 border-2 ${
            toast.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}>
            <span className="text-sm font-bold">{toast.text}</span>
          </div>
        </div>
      )}

      {/* Banner */}
      <div className="bg-gradient-to-r from-teal-900 via-emerald-900 to-slate-900 text-white rounded-2xl p-4 shadow-sm border border-teal-800/50 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-teal-300 shrink-0">
          <CreditCard className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-xs font-black tracking-wide">Validasi & Pembayaran PO</h4>
          <p className="text-[10px] text-teal-200/80 mt-0.5">
            Setujui tagihan dari Purchasing dan bayar Supplier.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-10 gap-2 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin text-teal-500" />
          <span className="text-[10px] font-bold">Memuat tagihan...</span>
        </div>
      ) : invoices.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 border border-slate-200/80 text-center shadow-xs space-y-2">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
            <CheckCircle className="w-5 h-5" />
          </div>
          <h5 className="text-xs font-bold text-slate-700">Belum Ada Tagihan</h5>
        </div>
      ) : (
        <div className="space-y-3">
          {invoices.map(inv => (
            <div key={inv.id} className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
              <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                inv.payment_status === 'Lunas' ? 'bg-emerald-500' : 'bg-amber-400'
              }`} />
              
              <div className="flex justify-between items-start pl-2 pb-2 border-b border-slate-100">
                <div>
                  <h5 className="text-xs font-black text-slate-900">PO: {inv.outlet_name}</h5>
                  <p className="text-[10px] text-slate-500">{inv.request_date} • Status Logistik: {inv.status}</p>
                </div>
                <span className={`px-2 py-1 text-[9px] font-black rounded-lg ${
                  inv.payment_status === 'Lunas' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {inv.payment_status}
                </span>
              </div>

              <div className="pl-2 pt-2 space-y-2">
                <div className="text-[10px] font-bold text-slate-500 mb-1">Rincian Order:</div>
                <ul className="space-y-1">
                  {(inv.purchase_request_items || []).map((item, idx) => (
                    <li key={idx} className="text-[10px] flex justify-between bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-100">
                      <span className="text-slate-700">{item.catalog?.item_name} <span className="text-slate-400">({item.catalog?.supplier?.name})</span></span>
                      <span className="font-bold text-slate-900">{item.qty_requested} {item.catalog?.uom}</span>
                    </li>
                  ))}
                </ul>

                {inv.payment_status === 'Lunas' ? (
                  <div className="mt-3 bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-[9px] font-bold text-emerald-600 block">Total Dibayar</span>
                      <span className="text-xs font-black text-emerald-800">Rp {Number(inv.total_amount).toLocaleString('id-ID')}</span>
                    </div>
                    <button className="p-2 bg-white text-emerald-600 rounded-lg shadow-xs hover:bg-emerald-100">
                      <ImageIcon className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setPaymentModal({ open: true, reqId: inv.id, totalAmount: '' })}
                    className="w-full mt-2 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-[11px] font-black rounded-xl transition flex items-center justify-center gap-1.5"
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    Input Pembayaran (Lunas)
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Pembayaran */}
      {paymentModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <form onSubmit={handlePay} className="relative max-w-sm w-full bg-white rounded-3xl p-5 shadow-2xl border border-slate-100 space-y-4">
            <div className="pb-3 border-b border-slate-100">
              <h4 className="text-sm font-black text-slate-900">Validasi Pembayaran</h4>
              <p className="text-[10px] text-slate-500">Masukkan nominal total yang telah ditransfer ke Supplier.</p>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-600 mb-1.5">Total Nominal (Rp)</label>
              <input
                type="number"
                value={paymentModal.totalAmount}
                onChange={(e) => setPaymentModal({ ...paymentModal, totalAmount: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-black text-slate-900 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                placeholder="Contoh: 1500000"
                required
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 p-2.5 rounded-xl flex gap-2">
              <ImageIcon className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-[9px] text-blue-800 leading-relaxed">
                Di versi ini, bukti transfer otomatis ter-generate sebagai <i>dummy image</i>. Di versi production, Finance akan mengunggah foto struk transfer fisik.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPaymentModal({ open: false, reqId: null, totalAmount: '' })}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-bold rounded-xl transition"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={processingId === paymentModal.reqId}
                className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-[11px] font-black rounded-xl transition flex justify-center items-center gap-1.5 disabled:opacity-50"
              >
                {processingId === paymentModal.reqId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                Konfirmasi Lunas
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
