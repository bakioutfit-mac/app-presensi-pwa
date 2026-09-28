'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Plus, Trash2, Send, ShoppingCart, Loader2, Package, History, CheckCircle } from 'lucide-react';
import { getLocalDateString } from '@/lib/date';
import BrandLogo from './BrandLogo';

export default function FormPermintaanBarang({ user, onBack }) {
  const [catalogs, setCatalogs] = useState([]);
  const [loadingCatalogs, setLoadingCatalogs] = useState(true);
  
  // Tab: 'form' | 'history'
  const [activeTab, setActiveTab] = useState('form');

  // Request State
  const [items, setItems] = useState([{ catalog_id: '', qty: 1 }]);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // History State
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [toast, setToast] = useState({ type: '', text: '' });

  const showToast = (type, text) => {
    setToast({ type, text });
    setTimeout(() => setToast({ type: '', text: '' }), 4000);
  };

  useEffect(() => {
    fetchCatalogs();
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab]);

  const fetchCatalogs = async () => {
    try {
      setLoadingCatalogs(true);
      const { data, error } = await supabase
        .from('inventory_catalogs')
        .select('*')
        .order('item_name', { ascending: true });

      if (error) throw error;
      setCatalogs(data || []);
    } catch (err) {
      console.error('Error fetching catalogs:', err);
    } finally {
      setLoadingCatalogs(false);
    }
  };

  const fetchHistory = async () => {
    try {
      setLoadingHistory(true);
      const { data, error } = await supabase
        .from('purchase_requests')
        .select(`
          *,
          purchase_request_items(
            id,
            qty_requested,
            status,
            catalog:catalog_id(item_name, uom)
          )
        `)
        .eq('outlet_name', user?.branch || 'Pusat')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setHistory(data || []);
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleAddItem = () => {
    setItems([...items, { catalog_id: '', qty: 1 }]);
  };

  const handleRemoveItem = (index) => {
    if (items.length > 1) {
      const newItems = [...items];
      newItems.splice(index, 1);
      setItems(newItems);
    }
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validasi
    const validItems = items.filter(item => item.catalog_id && item.qty > 0);
    if (validItems.length === 0) {
      showToast('error', 'Pilih minimal 1 barang dengan kuantitas lebih dari 0.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Insert Header
      const { data: reqData, error: reqError } = await supabase
        .from('purchase_requests')
        .insert({
          outlet_name: user?.branch || 'Pusat',
          requested_by: user?.full_name || 'Leader',
          request_date: getLocalDateString(),
          status: 'Menunggu Purchasing',
          notes: notes
        })
        .select()
        .single();

      if (reqError) throw reqError;

      // 2. Insert Detail Items
      const detailsToInsert = validItems.map(item => ({
        request_id: reqData.id,
        catalog_id: item.catalog_id,
        qty_requested: item.qty,
        status: 'Menunggu'
      }));

      const { error: detailError } = await supabase
        .from('purchase_request_items')
        .insert(detailsToInsert);

      if (detailError) throw detailError;

      showToast('success', 'Permintaan barang berhasil dikirim ke Purchasing!');
      setItems([{ catalog_id: '', qty: 1 }]);
      setNotes('');
      setActiveTab('history');
      
    } catch (err) {
      console.error('Submit error:', err);
      showToast('error', 'Gagal mengirim permintaan: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmReceived = async (reqId) => {
    if (!confirm('Tandai bahwa barang fisik sudah diterima di outlet dan sesuai dengan pesanan?')) return;
    
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('purchase_requests')
        .update({ status: 'Selesai (Barang Diterima)' })
        .eq('id', reqId);
        
      if (error) throw error;
      
      // Update distribution log
      await supabase
        .from('stock_distributions')
        .update({ 
          status: 'Diterima Outlet',
          received_photo_url: 'https://via.placeholder.com/400x600.png?text=Bukti+Terima'
        })
        .eq('request_id', reqId);

      showToast('success', 'Penerimaan barang berhasil dikonfirmasi!');
      fetchHistory();
    } catch (err) {
      console.error('Confirm error:', err);
      showToast('error', 'Gagal konfirmasi terima: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
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

      {/* Header */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 shadow-xs transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
              <ShoppingCart className="w-4 h-4 text-amber-500" />
              Pengajuan Barang
            </h3>
            <p className="text-[10px] text-slate-500 font-medium">Outlet: {user?.branch || 'Pusat'}</p>
          </div>
        </div>
        <BrandLogo variant="icon" size="sm" />
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-200/50 p-1.5 rounded-2xl gap-1">
        <button
          type="button"
          onClick={() => setActiveTab('form')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-[11px] font-black rounded-xl transition ${
            activeTab === 'form' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-500'
          }`}
        >
          <ShoppingCart className="w-3.5 h-3.5" />
          Buat Pengajuan
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-[11px] font-black rounded-xl transition ${
            activeTab === 'history' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-500'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          Riwayat Outlet
        </button>
      </div>

      {activeTab === 'form' && (
        <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-5">
          <div className="pb-3 border-b border-slate-100">
            <h4 className="text-sm font-black text-slate-800">Form Permintaan Barang</h4>
            <p className="text-[11px] text-slate-500">Pilih bahan baku/kebutuhan yang habis</p>
          </div>

          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={index} className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-500 bg-slate-200 px-2 py-0.5 rounded-md">
                    Barang #{index + 1}
                  </span>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      className="p-1.5 bg-rose-100 text-rose-600 rounded-lg hover:bg-rose-200"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-8">
                    <select
                      value={item.catalog_id}
                      onChange={(e) => handleItemChange(index, 'catalog_id', e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-xs text-slate-800 font-semibold focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                      required
                    >
                      <option value="">-- Pilih Barang --</option>
                      {loadingCatalogs ? (
                        <option disabled>Memuat katalog...</option>
                      ) : catalogs.length === 0 ? (
                        <option disabled>Katalog Kosong!</option>
                      ) : (
                        catalogs.map(cat => (
                          <option key={cat.id} value={cat.id}>
                            {cat.item_name} ({cat.uom})
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                  <div className="col-span-4">
                    <input
                      type="number"
                      min="1"
                      value={item.qty}
                      onChange={(e) => handleItemChange(index, 'qty', e.target.value)}
                      placeholder="QTY"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-xs text-slate-800 font-semibold focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-center"
                      required
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleAddItem}
            className="w-full py-2.5 border-2 border-dashed border-slate-300 rounded-xl text-[11px] font-bold text-slate-500 hover:border-amber-400 hover:text-amber-600 transition flex items-center justify-center gap-1.5 bg-slate-50"
          >
            <Plus className="w-3.5 h-3.5" />
            Tambah Item Barang Lain
          </button>

          <div>
            <label className="block text-[10px] font-bold text-slate-600 mb-1.5 ml-1">
              Catatan Khusus (Opsional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
              placeholder="Contoh: Tolong kirim yang botol besar..."
              rows={2}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black text-xs shadow-lg shadow-amber-500/30 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {isSubmitting ? 'Mengirim...' : 'Kirim Permintaan ke Purchasing'}
          </button>
        </form>
      )}

      {activeTab === 'history' && (
        <div className="space-y-3">
          {loadingHistory ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-[10px] font-bold">Memuat riwayat...</span>
            </div>
          ) : history.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 border border-slate-200/80 text-center shadow-xs space-y-2">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                <Package className="w-5 h-5" />
              </div>
              <h5 className="text-xs font-bold text-slate-700">Belum Ada Riwayat</h5>
              <p className="text-[10px] text-slate-400">Belum pernah mengajukan permintaan barang.</p>
            </div>
          ) : (
            history.map(req => (
              <div key={req.id} className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div>
                    <span className="text-[9px] text-slate-500 font-bold">{req.request_date}</span>
                    <h5 className="text-xs font-black text-slate-900 mt-0.5">{req.status}</h5>
                  </div>
                  <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black ${
                    req.status.includes('Selesai') ? 'bg-emerald-100 text-emerald-700' :
                    req.status.includes('Proses') ? 'bg-blue-100 text-blue-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {req.status}
                  </span>
                </div>
                
                <div className="space-y-1.5">
                  {(req.purchase_request_items || []).map(item => (
                    <div key={item.id} className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-700 font-medium">{item.catalog?.item_name || 'Item Terhapus'}</span>
                      <span className="font-bold text-slate-900">{item.qty_requested} {item.catalog?.uom}</span>
                    </div>
                  ))}
                </div>
                {req.notes && (
                  <p className="text-[10px] text-slate-500 bg-slate-50 p-2 rounded-lg italic">
                    Note: {req.notes}
                  </p>
                )}
                
                {req.status === 'Selesai (Dikirim ke Outlet)' && (
                  <button
                    onClick={() => handleConfirmReceived(req.id)}
                    disabled={isSubmitting}
                    className="w-full mt-2 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-black rounded-xl transition flex justify-center items-center gap-1.5 disabled:opacity-50"
                  >
                    {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                    Konfirmasi Barang Diterima
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
