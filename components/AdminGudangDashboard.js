'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Package, Truck, Search, Loader2, Layers, CheckCircle, Plus, Minus, ShoppingCart, History, ArrowDownToLine, ArrowUpFromLine, Trash2 } from 'lucide-react';
import BrandLogo from './BrandLogo';

export default function AdminGudangDashboard({ onBack }) {
  const [activeTab, setActiveTab] = useState('pos'); // 'pos' | 'stock' | 'history' | 'incoming'
  
  // Data States
  const [stocks, setStocks] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  
  // POS States
  const [cart, setCart] = useState([]);
  const [notes, setNotes] = useState('');
  
  const [searchQuery, setSearchQuery] = useState('');
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
      if (activeTab === 'pos' || activeTab === 'stock') {
        // Fetch Master Stock & Catalogs
        const { data: stockData, error: stockErr } = await supabase
          .from('inventory_catalogs')
          .select(`
            id, item_name, uom, category,
            warehouse_stocks(qty_available, last_updated)
          `)
          .order('item_name', { ascending: true });
          
        if (stockErr) throw stockErr;
        setStocks(stockData || []);
        
      } else if (activeTab === 'history') {
        const { data: historyData, error: historyErr } = await supabase
          .from('warehouse_transactions')
          .select(`
            *,
            catalog:catalog_id(item_name, uom, category)
          `)
          .order('created_at', { ascending: false })
          .limit(100);
        if (historyErr) {
            // Ignore error if table doesn't exist yet (before SQL run)
            if (historyErr.code !== '42P01') throw historyErr;
        } else {
            setTransactions(historyData || []);
        }
      } else if (activeTab === 'incoming') {
        // Fetch Barang yang sudah divalidasi Purchasing / sedang OTW ke Gudang
        const { data: inData, error: inErr } = await supabase
          .from('purchase_requests')
          .select(`
            *,
            purchase_request_items(
              id,
              qty_requested,
              catalog:catalog_id(id, item_name, uom)
            )
          `)
          .in('status', ['Diproses', 'Diterima Gudang'])
          .order('created_at', { ascending: false });
          
        if (inErr) throw inErr;
        setIncoming(inData || []);
      }
    } catch (err) {
      console.error('Fetch error:', err);
      // showToast('error', 'Gagal memuat data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ================= POS LOGIC =================
  const addToCart = (stockItem) => {
    setCart(prev => {
      const existing = prev.find(item => item.catalog.id === stockItem.id);
      if (existing) {
        return prev.map(item => item.catalog.id === stockItem.id ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { catalog: stockItem, qty: 1 }];
    });
    showToast('success', `${stockItem.item_name} ditambahkan ke draft.`);
  };

  const updateCartQty = (catalogId, delta) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.catalog.id === catalogId) {
          const newQty = item.qty + delta;
          return newQty > 0 ? { ...item, qty: newQty } : item;
        }
        return item;
      });
    });
  };

  const removeFromCart = (catalogId) => {
    setCart(prev => prev.filter(item => item.catalog.id !== catalogId));
  };

  const processTransaction = async (type) => {
    if (cart.length === 0) return showToast('error', 'Keranjang masih kosong!');
    if (!notes.trim()) return showToast('error', 'Keterangan wajib diisi!');
    
    setProcessingId('transaction');
    try {
      for (const item of cart) {
        const catalogId = item.catalog.id;
        const qty = Number(item.qty);

        // 1. Catat di Riwayat Transaksi (jika tabel ada)
        const { error: txErr } = await supabase
          .from('warehouse_transactions')
          .insert({
            catalog_id: catalogId,
            transaction_type: type, // 'IN' or 'OUT'
            qty: qty,
            notes: notes
          });
        
        if (txErr && txErr.code !== '42P01') throw txErr; // 42P01 = undefined table (if user hasn't run SQL)

        // 2. Update Master Stock
        const { data: existStock, error: existErr } = await supabase
          .from('warehouse_stocks')
          .select('id, qty_available')
          .eq('catalog_id', catalogId)
          .single();
          
        if (existErr && existErr.code !== 'PGRST116') throw existErr;

        if (existStock) {
          const currentQty = Number(existStock.qty_available);
          const newQty = type === 'IN' ? currentQty + qty : currentQty - qty;
          
          await supabase
            .from('warehouse_stocks')
            .update({ 
              qty_available: newQty,
              last_updated: new Date().toISOString()
            })
            .eq('id', existStock.id);
        } else {
          // If out, and no stock exists, it will become negative (which is normal in some ledgers)
          const newQty = type === 'IN' ? qty : -qty;
          await supabase
            .from('warehouse_stocks')
            .insert({
              catalog_id: catalogId,
              qty_available: newQty,
              last_updated: new Date().toISOString()
            });
        }
      }

      showToast('success', type === 'IN' ? 'Barang Masuk Berhasil Dicatat!' : 'Barang Keluar Berhasil Dicatat!');
      setCart([]);
      setNotes('');
      fetchData();
    } catch (err) {
      console.error('Transaction error:', err);
      if (err.code === '42P01') {
         showToast('error', 'Tabel transaksi belum dibuat! Jalankan SQL di Supabase.');
      } else {
         showToast('error', 'Gagal memproses transaksi: ' + err.message);
      }
    } finally {
      setProcessingId(null);
    }
  };

  // ================= OLD LOGISTIC LOGIC (Dari PO) =================
  const handleReceiveToWarehouse = async (reqId, items) => {
    if (!confirm('Konfirmasi bahwa barang fisik telah tiba di Gudang Pusat? Stok akan ditambahkan secara otomatis.')) return;
    setProcessingId(reqId);
    try {
      for (const item of items) {
        const catalogId = item.catalog.id;
        const qtyToAdd = Number(item.qty_requested);

        // Update Stock
        const { data: existStock, error: existErr } = await supabase
          .from('warehouse_stocks')
          .select('id, qty_available')
          .eq('catalog_id', catalogId)
          .single();
          
        if (existErr && existErr.code !== 'PGRST116') throw existErr;

        if (existStock) {
          await supabase.from('warehouse_stocks').update({ 
            qty_available: Number(existStock.qty_available) + qtyToAdd,
            last_updated: new Date().toISOString()
          }).eq('id', existStock.id);
        } else {
          await supabase.from('warehouse_stocks').insert({
            catalog_id: catalogId,
            qty_available: qtyToAdd,
            last_updated: new Date().toISOString()
          });
        }
        
        // Catat ke transaksi POS otomatis
        await supabase.from('warehouse_transactions').insert({
          catalog_id: catalogId,
          transaction_type: 'IN',
          qty: qtyToAdd,
          notes: 'Logistik Masuk dari PO Purchasing'
        }).catch(() => {});
      }

      await supabase.from('purchase_requests').update({ status: 'Diterima Gudang' }).eq('id', reqId);
      showToast('success', 'Barang berhasil dimasukkan ke Master Stok!');
      fetchData();
    } catch (err) {
      showToast('error', 'Gagal memproses stok: ' + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDistributeToOutlet = async (reqId, outletName, items) => {
    if (!confirm(`Kirim barang ini ke Outlet ${outletName} sekarang? Stok pusat akan dikurangi.`)) return;
    setProcessingId(reqId);
    try {
      for (const item of items) {
        const catalogId = item.catalog.id;
        const qtyToSent = Number(item.qty_requested);

        const { data: existStock } = await supabase.from('warehouse_stocks').select('id, qty_available').eq('catalog_id', catalogId).single();
        if (existStock) {
           await supabase.from('warehouse_stocks').update({ 
             qty_available: Number(existStock.qty_available) - qtyToSent,
             last_updated: new Date().toISOString()
           }).eq('id', existStock.id);
        }
        
        await supabase.from('warehouse_transactions').insert({
          catalog_id: catalogId,
          transaction_type: 'OUT',
          qty: qtyToSent,
          notes: `Distribusi Logistik ke ${outletName}`
        }).catch(() => {});
      }

      await supabase.from('purchase_requests').update({ status: 'Selesai' }).eq('id', reqId);
      showToast('success', 'Barang didistribusikan & stok dikurangi!');
      fetchData();
    } catch (err) {
      showToast('error', 'Gagal kirim: ' + err.message);
    } finally {
      setProcessingId(null);
    }
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
              <Package className="w-4 h-4 text-blue-600" />
              Gudang Pusat POS
            </h3>
            <p className="text-[10px] text-slate-500 font-medium">Mutasi & Master Stok</p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex bg-slate-200/50 p-1.5 rounded-2xl gap-1 overflow-x-auto scrollbar-none">
        <button onClick={() => setActiveTab('pos')} className={`flex-shrink-0 px-4 py-2 text-[11px] font-black rounded-xl flex items-center gap-1.5 transition ${activeTab === 'pos' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <ShoppingCart className="w-3.5 h-3.5" /> POS Mutasi
        </button>
        <button onClick={() => setActiveTab('history')} className={`flex-shrink-0 px-4 py-2 text-[11px] font-black rounded-xl flex items-center gap-1.5 transition ${activeTab === 'history' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <History className="w-3.5 h-3.5" /> Riwayat
        </button>
        <button onClick={() => setActiveTab('stock')} className={`flex-shrink-0 px-4 py-2 text-[11px] font-black rounded-xl flex items-center gap-1.5 transition ${activeTab === 'stock' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <Layers className="w-3.5 h-3.5" /> Master Stok
        </button>
        <button onClick={() => setActiveTab('incoming')} className={`flex-shrink-0 px-4 py-2 text-[11px] font-black rounded-xl flex items-center gap-1.5 transition ${activeTab === 'incoming' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <Truck className="w-3.5 h-3.5" /> Logistik PO
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          <span className="text-[11px] font-bold">Memuat data gudang...</span>
        </div>
      ) : activeTab === 'pos' ? (
        <div className="space-y-4">
          {/* Cart / Keranjang Section */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <h4 className="text-xs font-black text-slate-800 flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-blue-500" />
              Keranjang Mutasi ({cart.length} item)
            </h4>
            
            {cart.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400 font-medium italic border-2 border-dashed border-slate-100 rounded-xl">
                Belum ada barang dipilih. Ketuk barang di bawah.
              </div>
            ) : (
              <div className="space-y-2">
                {cart.map(item => (
                  <div key={item.catalog.id} className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <div className="flex-1">
                      <p className="text-[11px] font-black text-slate-900">{item.catalog.item_name}</p>
                      <p className="text-[9px] text-slate-500">{item.catalog.uom}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateCartQty(item.catalog.id, -1)} className="w-6 h-6 rounded bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-black w-6 text-center">{item.qty}</span>
                      <button onClick={() => updateCartQty(item.catalog.id, 1)} className="w-6 h-6 rounded bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100">
                        <Plus className="w-3 h-3" />
                      </button>
                      <button onClick={() => removeFromCart(item.catalog.id)} className="w-6 h-6 ml-2 rounded bg-rose-50 text-rose-600 flex items-center justify-center hover:bg-rose-100">
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
                placeholder="Keterangan (Wajib: misal 'Retur Outlet A')"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => processTransaction('IN')}
                disabled={processingId === 'transaction' || cart.length === 0}
                className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 disabled:opacity-50 shadow-sm"
              >
                {processingId === 'transaction' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowDownToLine className="w-4 h-4" />}
                MASUK (+)
              </button>
              <button
                onClick={() => processTransaction('OUT')}
                disabled={processingId === 'transaction' || cart.length === 0}
                className="flex-1 py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 disabled:opacity-50 shadow-sm"
              >
                {processingId === 'transaction' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUpFromLine className="w-4 h-4" />}
                KELUAR (-)
              </button>
            </div>
          </div>

          {/* Catalog Selection */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari & Tap untuk pilih barang..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-3 text-xs font-medium text-slate-700 focus:border-blue-500 focus:ring-2 shadow-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {stocks
              .filter(s => !searchQuery || s.item_name.toLowerCase().includes(searchQuery.toLowerCase()))
              .map(stock => {
                const qty = stock.warehouse_stocks?.[0]?.qty_available || 0;
                return (
                  <button 
                    key={stock.id} 
                    onClick={() => addToCart(stock)}
                    className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-col gap-2 relative overflow-hidden text-left hover:border-blue-400 transition"
                  >
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${qty <= 0 ? 'bg-rose-500' : 'bg-blue-500'}`} />
                    <div className="pl-2">
                      <span className="text-[9px] font-bold text-slate-400 uppercase">{stock.category || 'Barang'}</span>
                      <h4 className="text-[11px] font-black text-slate-900 leading-tight mt-0.5">{stock.item_name}</h4>
                    </div>
                    
                    <div className="pl-2 mt-auto pt-2 border-t border-slate-100 flex items-end justify-between w-full">
                      <span className="text-[10px] font-bold text-slate-500">
                        Sisa: <span className={qty <= 0 ? 'text-rose-600' : 'text-blue-600'}>{qty}</span> {stock.uom}
                      </span>
                      <Plus className="w-3.5 h-3.5 text-blue-500 bg-blue-50 rounded-full p-0.5" />
                    </div>
                  </button>
                );
            })}
          </div>
        </div>
      ) : activeTab === 'history' ? (
        <div className="space-y-3 animate-in fade-in">
          {transactions.length === 0 ? (
             <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center">
               <History className="w-8 h-8 text-slate-300 mx-auto mb-2" />
               <h4 className="text-sm font-black text-slate-600">Belum Ada Riwayat</h4>
             </div>
          ) : (
            transactions.map(tx => (
              <div key={tx.id} className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${tx.transaction_type === 'IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                      {tx.transaction_type === 'IN' ? 'MASUK' : 'KELUAR'}
                    </span>
                    <span className="text-[9px] text-slate-400 font-medium">
                      {new Date(tx.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </div>
                  <h4 className="text-[11px] font-black text-slate-900">{tx.catalog?.item_name}</h4>
                  <p className="text-[10px] text-slate-500 italic mt-0.5">{tx.notes}</p>
                </div>
                <div className="text-right">
                  <span className={`text-sm font-black ${tx.transaction_type === 'IN' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {tx.transaction_type === 'IN' ? '+' : '-'}{tx.qty}
                  </span>
                  <span className="text-[9px] text-slate-500 block">{tx.catalog?.uom}</span>
                </div>
              </div>
            ))
          )}
        </div>
      ) : activeTab === 'stock' ? (
        <div className="space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nama barang..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {stocks
              .filter(s => !searchQuery || s.item_name.toLowerCase().includes(searchQuery.toLowerCase()))
              .map(stock => {
                const qty = stock.warehouse_stocks?.[0]?.qty_available || 0;
                return (
                  <div key={stock.id} className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-col gap-2 relative overflow-hidden">
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                      qty === 0 ? 'bg-rose-500' : qty < 10 ? 'bg-amber-400' : 'bg-blue-500'
                    }`} />
                    <div className="pl-2">
                      <span className="text-[9px] font-bold text-slate-400 uppercase">{stock.category || 'Barang'}</span>
                      <h4 className="text-xs font-black text-slate-900 leading-tight mt-0.5">{stock.item_name}</h4>
                    </div>
                    
                    <div className="pl-2 mt-auto pt-2 border-t border-slate-100 flex items-end justify-between">
                      <div>
                        <span className="text-[9px] text-slate-500 block mb-0.5">Sisa Stok Pusat:</span>
                        <div className="flex items-baseline gap-1">
                          <span className={`text-lg font-black leading-none ${
                            qty === 0 ? 'text-rose-600' : 'text-blue-600'
                          }`}>{qty}</span>
                          <span className="text-[10px] font-bold text-slate-400">{stock.uom}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {incoming.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm text-center space-y-3">
              <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mx-auto">
                <CheckCircle className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-black text-slate-800">Clear!</h4>
              <p className="text-xs text-slate-500">Tidak ada pengiriman logistik masuk atau keluar via Sistem PO.</p>
            </div>
          ) : (
            incoming.map(req => (
              <div key={req.id} className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-3 relative overflow-hidden">
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                  req.status === 'Diproses' ? 'bg-amber-400' : 'bg-blue-500'
                }`} />

                <div className="flex justify-between items-start pl-2">
                  <div>
                    <h5 className="text-xs font-black text-slate-900">Tujuan: {req.outlet_name}</h5>
                    <p className="text-[10px] text-slate-500">{req.request_date}</p>
                  </div>
                  <span className={`px-2 py-1 text-[9px] font-black rounded-lg ${
                    req.status === 'Diproses' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {req.status === 'Diproses' ? 'OTW dari Supplier' : 'Tiba di Gudang'}
                  </span>
                </div>

                <div className="pl-2">
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5">
                    <ul className="space-y-1">
                      {(req.purchase_request_items || []).map(item => (
                        <li key={item.id} className="text-[11px] flex justify-between">
                          <span className="text-slate-600">• {item.catalog?.item_name}</span>
                          <span className="font-bold text-slate-900">{item.qty_requested} {item.catalog?.uom}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="pl-2 pt-1 flex gap-2">
                  {req.status === 'Diproses' && (
                    <button
                      onClick={() => handleReceiveToWarehouse(req.id, req.purchase_request_items)}
                      disabled={processingId === req.id}
                      className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black rounded-xl transition flex justify-center items-center gap-1.5 disabled:opacity-50"
                    >
                      {processingId === req.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Package className="w-3.5 h-3.5" />}
                      Terima di Master Stok
                    </button>
                  )}

                  {req.status === 'Diterima Gudang' && (
                    <button
                      onClick={() => handleDistributeToOutlet(req.id, req.outlet_name, req.purchase_request_items)}
                      disabled={processingId === req.id}
                      className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-black rounded-xl transition flex justify-center items-center gap-1.5 disabled:opacity-50"
                    >
                      {processingId === req.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Truck className="w-3.5 h-3.5" />}
                      Kirim ke {req.outlet_name}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
