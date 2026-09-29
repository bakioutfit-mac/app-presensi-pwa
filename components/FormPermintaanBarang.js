'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Layers, UserMinus, UserCheck, Search, Loader2, Package, CheckCircle, Plus, Minus, ShoppingCart, History, Trash2, Edit3, Send, RefreshCw } from 'lucide-react';
import { getLocalDateString } from '@/lib/date';

export default function FormPermintaanBarang({ user, onBack }) {
  const [activeTab, setActiveTab] = useState('pos'); // 'pos' | 'history'
  
  const [catalogs, setCatalogs] = useState([]);
  const [history, setHistory] = useState([]);
  const [stocks, setStocks] = useState([]);
  const [outletCart, setOutletCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // POS States
  const [cart, setCart] = useState([]);
  const [notes, setNotes] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Custom Item Modal State
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customItem, setCustomItem] = useState({ name: '', uom: 'pcs' });

  const [toast, setToast] = useState({ type: '', text: '' });
  const showToast = (type, text) => {
    setToast({ type, text });
    setTimeout(() => setToast({ type: '', text: '' }), 4000);
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'pos') {
        const { data, error } = await supabase.from('inventory_catalogs').select('*').order('item_name', { ascending: true });
        if (error) throw error;
        setCatalogs(data || []);
      } else if (activeTab === 'stock' || activeTab === 'mutasi') {
        const { data, error } = await supabase.from('outlet_stocks')
          .select('*, catalog:catalog_id(item_name, uom, category)')
          .eq('outlet_name', user?.branch || 'Pusat')
          .order('catalog(item_name)', { ascending: true });
        if (error && error.code !== '42P01') throw error;
        setStocks(data || []);
      } else {
        const { data, error } = await supabase.from('purchase_requests')
          .select(`*, purchase_request_items(id, catalog_id, qty_requested, status, catalog:catalog_id(id, item_name, uom))`)
          .eq('outlet_name', user?.branch || 'Pusat')
          .order('created_at', { ascending: false }).limit(20);
        if (error) throw error;
        setHistory(data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };


  const updateOutletCart = (stockItem, delta) => {
    setOutletCart(prev => {
      const existing = prev.find(item => item.catalog.id === stockItem.catalog.id);
      if (existing) {
        return prev.map(item => item.catalog.id === stockItem.catalog.id ? { ...item, qty: item.qty + delta } : item).filter(i => i.qty > 0);
      }
      if (delta > 0) return [...prev, { catalog: stockItem.catalog, qty: delta, stockId: stockItem.id, available: stockItem.qty_available }];
      return prev;
    });
  };

  const processOutletUsage = async () => {
    if (outletCart.length === 0) return showToast('error', 'Keranjang pemakaian kosong!');
    setIsSubmitting(true);
    try {
      const outletName = user?.branch || 'Pusat';
      for (const item of outletCart) {
        const catalogId = item.catalog.id;
        const qty = Number(item.qty);
        
        await supabase.from('outlet_transactions').insert({
          outlet_name: outletName,
          catalog_id: catalogId,
          transaction_type: 'OUT',
          qty: qty,
          notes: 'Pemakaian Harian (Produksi)'
        }).catch(()=>{});

        await supabase.from('outlet_stocks').update({
          qty_available: Number(item.available) - qty,
          last_updated: new Date().toISOString()
        }).eq('id', item.stockId);
      }

      showToast('success', 'Pemakaian stok berhasil dicatat!');
      setOutletCart([]);
      fetchData();
    } catch (err) {
      showToast('error', 'Gagal memproses pemakaian!');
    } finally { setIsSubmitting(false); }
  };

  // ================= POS LOGIC =================
  const addToCart = (catalogItem) => {
    setCart(prev => {
      const existing = prev.find(item => item.catalog.id === catalogItem.id);
      if (existing) {
        return prev.map(item => item.catalog.id === catalogItem.id ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { catalog: catalogItem, qty: 1 }];
    });
    showToast('success', `${catalogItem.item_name} ditambahkan.`);
  };

  const updateCartQty = (catalogId, delta) => {
    setCart(prev => prev.map(item => {
      if (item.catalog.id === catalogId) {
        const newQty = item.qty + delta;
        return newQty > 0 ? { ...item, qty: newQty } : item;
      }
      return item;
    }));
  };

  const removeFromCart = (catalogId) => setCart(prev => prev.filter(item => item.catalog.id !== catalogId));

  const handleAddCustomItem = async () => {
    if (!customItem.name.trim()) return showToast('error', 'Nama barang tidak boleh kosong!');
    
    setIsSubmitting(true);
    try {
      // Create new catalog item
      const { data, error } = await supabase.from('inventory_catalogs').insert({
        item_name: customItem.name.trim(),
        uom: customItem.uom,
        category: 'Request Baru'
      }).select().single();
      
      if (error) throw error;
      
      setCatalogs(prev => [...prev, data]);
      addToCart(data);
      setShowCustomModal(false);
      setCustomItem({ name: '', uom: 'pcs' });
    } catch (err) {
      showToast('error', 'Gagal menambah barang baru: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitRequest = async () => {
    if (cart.length === 0) return showToast('error', 'Keranjang masih kosong!');
    setIsSubmitting(true);
    
    try {
      const { data: reqData, error: reqError } = await supabase.from('purchase_requests').insert({
        outlet_name: user?.branch || 'Pusat',
        requested_by: user?.full_name || 'Leader',
        request_date: getLocalDateString(),
        status: 'Menunggu Persetujuan',
        notes: notes
      }).select().single();

      if (reqError) throw reqError;

      const detailsToInsert = cart.map(item => ({
        request_id: reqData.id,
        catalog_id: item.catalog.id,
        qty_requested: item.qty,
        status: 'Menunggu'
      }));

      const { error: detailError } = await supabase.from('purchase_request_items').insert(detailsToInsert);
      if (detailError) throw detailError;

      showToast('success', 'Permintaan barang berhasil dikirim!');
      setCart([]);
      setNotes('');
      setActiveTab('history');
    } catch (err) {
      showToast('error', 'Gagal mengirim permintaan: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmReceived = async (req) => {
    if (!confirm('Tandai barang sudah diterima di outlet? Stok Outlet akan otomatis bertambah!')) return;
    setIsSubmitting(true);
    try {
      const outletName = user?.branch || 'Pusat';
      // Tambah ke stok outlet
      for (const item of req.purchase_request_items) {
        if (!item.catalog_id && !item.catalog) continue;
        const catalogId = item.catalog_id || (item.catalog && item.catalog.id);
        if (!catalogId) continue;
        const qtyToAdd = Number(item.qty_requested);

        // 1. Catat transaksi
        const { error: txErr } = await supabase.from('outlet_transactions').insert({
          outlet_name: outletName,
          catalog_id: catalogId,
          transaction_type: 'IN',
          qty: qtyToAdd,
          notes: 'Terima PO (Req ID: ' + req.id.substring(0,6) + ')'
        });
        if (txErr) throw txErr;

        // 2. Update Stock
        const { data: existStock, error: existErr } = await supabase.from('outlet_stocks')
          .select('id, qty_available')
          .eq('outlet_name', outletName)
          .eq('catalog_id', catalogId)
          .single();
        if (existErr && existErr.code !== 'PGRST116') throw existErr;

        if (existStock) {
          const { error: updErr } = await supabase.from('outlet_stocks').update({
            qty_available: Number(existStock.qty_available) + qtyToAdd,
            last_updated: new Date().toISOString()
          }).eq('id', existStock.id);
          if (updErr) throw updErr;
        } else {
          const { error: insErr } = await supabase.from('outlet_stocks').insert({
            outlet_name: outletName,
            catalog_id: catalogId,
            qty_available: qtyToAdd
          });
          if (insErr) throw insErr;
        }
      }

      const { error: reqErr } = await supabase.from('purchase_requests').update({ status: 'Selesai' }).eq('id', req.id);
      if (reqErr) throw reqErr;
      
      showToast('success', 'Penerimaan berhasil & Stok Outlet Bertambah!');
      fetchData();
    } catch (err) {
      console.error('Confirm Received Error:', JSON.stringify(err, null, 2));
      showToast('error', (err && err.message) || 'Gagal konfirmasi!');
    } finally { setIsSubmitting(false); }
  };

  return (
    <div className="space-y-4 pb-24">
      {/* Toast */}
      {toast.text && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-sm">
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
          <button type="button" onClick={onBack} className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 shadow-xs transition">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
              <Package className="w-4 h-4 text-orange-600" />
              Request Barang
            </h3>
            <p className="text-[10px] text-slate-500 font-medium">Outlet: {user?.branch || 'Pusat'}</p>
          </div>
        </div>
        <button onClick={fetchData} className="p-2 rounded-xl bg-orange-50 text-orange-600 hover:bg-orange-100 transition shadow-xs">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap bg-slate-200/50 p-1.5 rounded-2xl gap-1">
        <button onClick={() => setActiveTab('pos')} className={`flex-1 py-2 text-[10px] font-black rounded-xl flex items-center justify-center gap-1.5 transition ${activeTab === 'pos' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <ShoppingCart className="w-3.5 h-3.5" /> Order
        </button>
        <button onClick={() => setActiveTab('stock')} className={`flex-1 py-2 text-[10px] font-black rounded-xl flex items-center justify-center gap-1.5 transition ${activeTab === 'stock' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <Layers className="w-3.5 h-3.5" /> Stok
        </button>
        <button onClick={() => setActiveTab('mutasi')} className={`flex-1 py-2 text-[10px] font-black rounded-xl flex items-center justify-center gap-1.5 transition ${activeTab === 'mutasi' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <Minus className="w-3.5 h-3.5" /> Pemakaian
        </button>
        <button onClick={() => setActiveTab('history')} className={`flex-1 py-2 text-[10px] font-black rounded-xl flex items-center justify-center gap-1.5 transition ${activeTab === 'history' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <History className="w-3.5 h-3.5" /> Riwayat
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
          <span className="text-[11px] font-bold">Memuat...</span>
        </div>
      ) : activeTab === 'pos' ? (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <h4 className="text-xs font-black text-slate-800 flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-orange-500" />
              Keranjang Request ({cart.length} item)
            </h4>
            
            {cart.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400 font-medium italic border-2 border-dashed border-slate-100 rounded-xl">
                Ketuk barang di katalog bawah untuk menambah.
              </div>
            ) : activeTab === 'stock' ? (
        <div className="space-y-3 animate-in fade-in">
          {stocks.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400 font-medium border-2 border-dashed border-slate-200 rounded-2xl">
              Stok Outlet Kosong.<br/>Order barang dari Pusat dulu.
            </div>
          ) : (
            stocks.map(st => (
              <div key={st.id} className="bg-white p-3 border border-slate-200 rounded-xl shadow-xs flex justify-between items-center">
                <div>
                  <h4 className="text-[11px] font-black text-slate-900">{st.catalog?.item_name}</h4>
                  <p className="text-[9px] text-slate-500 font-medium">Kategori: {st.catalog?.category || 'Umum'}</p>
                </div>
                <div className="text-right">
                  <span className={`text-sm font-black ${st.qty_available <= 5 ? 'text-rose-600' : 'text-slate-800'}`}>{st.qty_available}</span>
                  <span className="text-[9px] text-slate-500 uppercase ml-1">{st.catalog?.uom}</span>
                </div>
              </div>
            ))
          )}
        </div>
      ) : activeTab === 'mutasi' ? (
        <div className="space-y-4 animate-in fade-in">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <h4 className="text-xs font-black text-slate-800 flex items-center gap-2">
              <Minus className="w-4 h-4 text-orange-500" />
              Catat Pemakaian Stok ({outletCart.length} item)
            </h4>
            
            {outletCart.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400 font-medium italic border-2 border-dashed border-slate-100 rounded-xl">
                Pilih stok di bawah untuk dicatat pemakaiannya.
              </div>
            ) : (
              <div className="space-y-2">
                {outletCart.map(item => (
                  <div key={item.catalog.id} className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <div className="flex-1">
                      <p className="text-[11px] font-black text-slate-900">{item.catalog.item_name}</p>
                      <p className="text-[9px] text-slate-500 font-bold uppercase">Stok: {item.available} {item.catalog.uom}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateOutletCart(item, -1)} className="w-6 h-6 rounded bg-white border border-slate-200 flex items-center justify-center text-slate-600">-</button>
                      <span className="text-xs font-black w-6 text-center">{item.qty}</span>
                      <button onClick={() => updateOutletCart(item, 1)} disabled={item.qty >= item.available} className="w-6 h-6 rounded bg-white border border-slate-200 flex items-center justify-center text-slate-600 disabled:opacity-30">+</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button onClick={processOutletUsage} disabled={isSubmitting || outletCart.length === 0} className="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-black transition flex items-center justify-center gap-2 mt-2 shadow-md disabled:opacity-50">
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              KONFIRMASI PEMAKAIAN
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {stocks.filter(s => s.qty_available > 0).map(stock => {
              const inCart = outletCart.find(i => i.catalog.id === stock.catalog.id)?.qty || 0;
              return (
                <button key={stock.id} onClick={() => updateOutletCart(stock, 1)} disabled={inCart >= stock.qty_available} className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-col gap-2 text-left disabled:opacity-50">
                  <div className="pl-1">
                    <h4 className="text-[11px] font-black text-slate-900 leading-tight">{stock.catalog?.item_name}</h4>
                  </div>
                  <div className="pl-1 mt-auto pt-2 border-t border-slate-100 flex items-end justify-between w-full">
                    <span className="text-[10px] font-bold text-emerald-600">Sisa: {stock.qty_available}</span>
                    <Minus className="w-4 h-4 text-orange-500 bg-orange-50 rounded-full p-0.5" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
              <div className="space-y-2">
                {cart.map(item => (
                  <div key={item.catalog.id} className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <div className="flex-1">
                      <p className="text-[11px] font-black text-slate-900">{item.catalog.item_name}</p>
                      <p className="text-[9px] text-slate-500 font-bold uppercase">{item.catalog.uom}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateCartQty(item.catalog.id, -1)} className="w-6 h-6 rounded bg-white border border-slate-200 flex items-center justify-center text-slate-600">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-black w-6 text-center">{item.qty}</span>
                      <button onClick={() => updateCartQty(item.catalog.id, 1)} className="w-6 h-6 rounded bg-white border border-slate-200 flex items-center justify-center text-slate-600">
                        <Plus className="w-3 h-3" />
                      </button>
                      <button onClick={() => removeFromCart(item.catalog.id)} className="w-6 h-6 ml-2 rounded bg-rose-50 text-rose-600 flex items-center justify-center">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2">
              <input
                type="text"
                placeholder="Catatan tambahan (Opsional)..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-orange-500 outline-none"
              />
            </div>

            <button onClick={handleSubmitRequest} disabled={isSubmitting || cart.length === 0} className="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-black transition flex items-center justify-center gap-2 mt-2 shadow-md disabled:opacity-50">
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              KIRIM REQUEST BARANG
            </button>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari barang..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-3 text-xs font-medium text-slate-700 focus:border-orange-500 focus:ring-2 shadow-sm"
            />
          </div>

          <button onClick={() => setShowCustomModal(true)} className="w-full py-3 border-2 border-dashed border-orange-300 text-orange-600 bg-orange-50 rounded-xl text-[11px] font-black flex items-center justify-center gap-2 hover:bg-orange-100 transition">
            <Edit3 className="w-4 h-4" />
            BARANG TIDAK ADA? REQUEST CUSTOM
          </button>

          <div className="grid grid-cols-2 gap-3">
            {catalogs.filter(s => !searchQuery || s.item_name.toLowerCase().includes(searchQuery.toLowerCase())).map(stock => (
              <button key={stock.id} onClick={() => addToCart(stock)} className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-col gap-2 relative overflow-hidden text-left hover:border-orange-400 transition">
                <div className="pl-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase">{stock.category || 'Barang'}</span>
                  <h4 className="text-[11px] font-black text-slate-900 leading-tight mt-0.5">{stock.item_name}</h4>
                </div>
                
                <div className="pl-1 mt-auto pt-2 border-t border-slate-100 flex items-end justify-between w-full">
                  <span className="text-[9px] font-bold text-slate-500 uppercase">{stock.uom}</span>
                  <Plus className="w-4 h-4 text-orange-500 bg-orange-50 rounded-full p-0.5" />
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : activeTab === 'stock' ? (
        <div className="space-y-3 animate-in fade-in">
          {stocks.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400 font-medium border-2 border-dashed border-slate-200 rounded-2xl">
              Stok Outlet Kosong.<br/>Order barang dari Pusat dulu.
            </div>
          ) : (
            stocks.map(st => (
              <div key={st.id} className="bg-white p-3 border border-slate-200 rounded-xl shadow-xs flex justify-between items-center">
                <div>
                  <h4 className="text-[11px] font-black text-slate-900">{st.catalog?.item_name}</h4>
                  <p className="text-[9px] text-slate-500 font-medium">Kategori: {st.catalog?.category || 'Umum'}</p>
                </div>
                <div className="text-right">
                  <span className={`text-sm font-black ${st.qty_available <= 5 ? 'text-rose-600' : 'text-slate-800'}`}>{st.qty_available}</span>
                  <span className="text-[9px] text-slate-500 uppercase ml-1">{st.catalog?.uom}</span>
                </div>
              </div>
            ))
          )}
        </div>
      ) : activeTab === 'mutasi' ? (
        <div className="space-y-4 animate-in fade-in">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <h4 className="text-xs font-black text-slate-800 flex items-center gap-2">
              <Minus className="w-4 h-4 text-orange-500" />
              Catat Pemakaian Stok ({outletCart.length} item)
            </h4>
            
            {outletCart.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400 font-medium italic border-2 border-dashed border-slate-100 rounded-xl">
                Pilih stok di bawah untuk dicatat pemakaiannya.
              </div>
            ) : (
              <div className="space-y-2">
                {outletCart.map(item => (
                  <div key={item.catalog.id} className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <div className="flex-1">
                      <p className="text-[11px] font-black text-slate-900">{item.catalog.item_name}</p>
                      <p className="text-[9px] text-slate-500 font-bold uppercase">Stok: {item.available} {item.catalog.uom}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateOutletCart(item, -1)} className="w-6 h-6 rounded bg-white border border-slate-200 flex items-center justify-center text-slate-600">-</button>
                      <span className="text-xs font-black w-6 text-center">{item.qty}</span>
                      <button onClick={() => updateOutletCart(item, 1)} disabled={item.qty >= item.available} className="w-6 h-6 rounded bg-white border border-slate-200 flex items-center justify-center text-slate-600 disabled:opacity-30">+</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button onClick={processOutletUsage} disabled={isSubmitting || outletCart.length === 0} className="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-black transition flex items-center justify-center gap-2 mt-2 shadow-md disabled:opacity-50">
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              KONFIRMASI PEMAKAIAN
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {stocks.filter(s => s.qty_available > 0).map(stock => {
              const inCart = outletCart.find(i => i.catalog.id === stock.catalog.id)?.qty || 0;
              return (
                <button key={stock.id} onClick={() => updateOutletCart(stock, 1)} disabled={inCart >= stock.qty_available} className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-col gap-2 text-left disabled:opacity-50">
                  <div className="pl-1">
                    <h4 className="text-[11px] font-black text-slate-900 leading-tight">{stock.catalog?.item_name}</h4>
                  </div>
                  <div className="pl-1 mt-auto pt-2 border-t border-slate-100 flex items-end justify-between w-full">
                    <span className="text-[10px] font-bold text-emerald-600">Sisa: {stock.qty_available}</span>
                    <Minus className="w-4 h-4 text-orange-500 bg-orange-50 rounded-full p-0.5" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {history.length === 0 ? (
             <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center">
               <History className="w-8 h-8 text-slate-300 mx-auto mb-2" />
               <h4 className="text-sm font-black text-slate-600">Belum Ada Riwayat</h4>
             </div>
          ) : activeTab === 'stock' ? (
        <div className="space-y-3 animate-in fade-in">
          {stocks.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400 font-medium border-2 border-dashed border-slate-200 rounded-2xl">
              Stok Outlet Kosong.<br/>Order barang dari Pusat dulu.
            </div>
          ) : (
            stocks.map(st => (
              <div key={st.id} className="bg-white p-3 border border-slate-200 rounded-xl shadow-xs flex justify-between items-center">
                <div>
                  <h4 className="text-[11px] font-black text-slate-900">{st.catalog?.item_name}</h4>
                  <p className="text-[9px] text-slate-500 font-medium">Kategori: {st.catalog?.category || 'Umum'}</p>
                </div>
                <div className="text-right">
                  <span className={`text-sm font-black ${st.qty_available <= 5 ? 'text-rose-600' : 'text-slate-800'}`}>{st.qty_available}</span>
                  <span className="text-[9px] text-slate-500 uppercase ml-1">{st.catalog?.uom}</span>
                </div>
              </div>
            ))
          )}
        </div>
      ) : activeTab === 'mutasi' ? (
        <div className="space-y-4 animate-in fade-in">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <h4 className="text-xs font-black text-slate-800 flex items-center gap-2">
              <Minus className="w-4 h-4 text-orange-500" />
              Catat Pemakaian Stok ({outletCart.length} item)
            </h4>
            
            {outletCart.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400 font-medium italic border-2 border-dashed border-slate-100 rounded-xl">
                Pilih stok di bawah untuk dicatat pemakaiannya.
              </div>
            ) : (
              <div className="space-y-2">
                {outletCart.map(item => (
                  <div key={item.catalog.id} className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <div className="flex-1">
                      <p className="text-[11px] font-black text-slate-900">{item.catalog.item_name}</p>
                      <p className="text-[9px] text-slate-500 font-bold uppercase">Stok: {item.available} {item.catalog.uom}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateOutletCart(item, -1)} className="w-6 h-6 rounded bg-white border border-slate-200 flex items-center justify-center text-slate-600">-</button>
                      <span className="text-xs font-black w-6 text-center">{item.qty}</span>
                      <button onClick={() => updateOutletCart(item, 1)} disabled={item.qty >= item.available} className="w-6 h-6 rounded bg-white border border-slate-200 flex items-center justify-center text-slate-600 disabled:opacity-30">+</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button onClick={processOutletUsage} disabled={isSubmitting || outletCart.length === 0} className="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-black transition flex items-center justify-center gap-2 mt-2 shadow-md disabled:opacity-50">
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              KONFIRMASI PEMAKAIAN
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {stocks.filter(s => s.qty_available > 0).map(stock => {
              const inCart = outletCart.find(i => i.catalog.id === stock.catalog.id)?.qty || 0;
              return (
                <button key={stock.id} onClick={() => updateOutletCart(stock, 1)} disabled={inCart >= stock.qty_available} className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-col gap-2 text-left disabled:opacity-50">
                  <div className="pl-1">
                    <h4 className="text-[11px] font-black text-slate-900 leading-tight">{stock.catalog?.item_name}</h4>
                  </div>
                  <div className="pl-1 mt-auto pt-2 border-t border-slate-100 flex items-end justify-between w-full">
                    <span className="text-[10px] font-bold text-emerald-600">Sisa: {stock.qty_available}</span>
                    <Minus className="w-4 h-4 text-orange-500 bg-orange-50 rounded-full p-0.5" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
            history.map(req => (
              <div key={req.id} className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-3 relative overflow-hidden">
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${req.status === 'Selesai' ? 'bg-emerald-500' : req.status === 'Menunggu Persetujuan' ? 'bg-rose-400' : 'bg-amber-400'}`} />
                
                <div className="flex justify-between items-start pl-2">
                  <div>
                    <h5 className="text-[10px] font-black text-slate-900">{req.request_date}</h5>
                    <p className="text-[9px] text-slate-500">{req.notes || '-'}</p>
                  </div>
                  <span className={`px-2 py-1 text-[9px] font-black rounded-lg ${req.status === 'Selesai' ? 'bg-emerald-100 text-emerald-700' : req.status === 'Menunggu Persetujuan' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>{req.status}</span>
                </div>

                <div className="pl-2">
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5">
                    <ul className="space-y-1">
                      {(req.purchase_request_items || []).map(item => (
                        <li key={item.id} className="text-[10px] flex justify-between border-b border-slate-100 pb-1 last:border-0 last:pb-0">
                          <span className="text-slate-600">{item.catalog?.item_name}</span>
                          <span className="font-bold text-slate-900">{item.qty_requested} {item.catalog?.uom}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {req.status === 'Siap diambil' && (
                  <div className="pl-2 pt-1">
                    <button onClick={() => handleConfirmReceived(req)} disabled={isSubmitting} className="w-full py-2.5 bg-emerald-600 text-white text-[11px] font-black rounded-xl">
                      Konfirmasi Barang Diterima di Outlet
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Custom Item Modal */}
      {showCustomModal && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-orange-600 p-4 text-white text-center">
              <h3 className="text-sm font-black">Request Barang Baru</h3>
              <p className="text-[10px] opacity-80">Masukkan nama barang yang tidak ada di katalog</p>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Nama Barang</label>
                <input type="text" value={customItem.name} onChange={e => setCustomItem({...customItem, name: e.target.value})} className="w-full p-3 rounded-xl border-2 border-slate-100 bg-slate-50 text-sm font-bold focus:border-orange-500 focus:bg-white transition outline-none" placeholder="Cth: Tisu Galon 5L" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Satuan (UOM)</label>
                <input type="text" value={customItem.uom} onChange={e => setCustomItem({...customItem, uom: e.target.value})} className="w-full p-3 rounded-xl border-2 border-slate-100 bg-slate-50 text-sm font-bold focus:border-orange-500 focus:bg-white transition outline-none" placeholder="Cth: pcs, kg, pack" />
              </div>
              
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button onClick={() => setShowCustomModal(false)} className="py-3 rounded-xl bg-slate-100 text-slate-600 text-xs font-black">Batal</button>
                <button onClick={handleAddCustomItem} disabled={isSubmitting} className="py-3 rounded-xl bg-orange-600 text-white text-xs font-black disabled:opacity-50 flex justify-center items-center">
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Tambah ke Cart'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
