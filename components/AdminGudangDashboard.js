'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Package, Truck, Search, Loader2, RefreshCw, Layers, CheckCircle } from 'lucide-react';
import BrandLogo from './BrandLogo';

export default function AdminGudangDashboard({ onBack }) {
  const [activeTab, setActiveTab] = useState('stock'); // 'stock' | 'incoming' | 'distribution'
  
  // Data States
  const [stocks, setStocks] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  
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
      if (activeTab === 'stock') {
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
          // Status 'Diproses' = OTW ke Gudang (sudah deal dengan supplier)
          // Status 'Diterima Gudang' = Tiba di Gudang
          .in('status', ['Diproses', 'Diterima Gudang'])
          .order('created_at', { ascending: false });
          
        if (inErr) throw inErr;
        setIncoming(inData || []);
      }
    } catch (err) {
      console.error('Fetch error:', err);
      showToast('error', 'Gagal memuat data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Gudang Terima Barang dari Purchasing (Ubah status & Tambah Stok Pusat)
  const handleReceiveToWarehouse = async (reqId, items) => {
    if (!confirm('Konfirmasi bahwa barang fisik telah tiba di Gudang Pusat? Stok akan ditambahkan secara otomatis.')) return;
    
    setProcessingId(reqId);
    try {
      // 1. Tambah stok untuk setiap item di warehouse_stocks
      for (const item of items) {
        const catalogId = item.catalog.id;
        const qtyToAdd = Number(item.qty_requested);

        // Cek apakah row stok sudah ada
        const { data: existStock, error: existErr } = await supabase
          .from('warehouse_stocks')
          .select('id, qty_available')
          .eq('catalog_id', catalogId)
          .single();
          
        if (existErr && existErr.code !== 'PGRST116') { // PGRST116 = Not Found
          throw existErr;
        }

        if (existStock) {
          // Update
          const { error: updErr } = await supabase
            .from('warehouse_stocks')
            .update({ 
              qty_available: Number(existStock.qty_available) + qtyToAdd,
              last_updated: new Date().toISOString()
            })
            .eq('id', existStock.id);
          if (updErr) throw updErr;
        } else {
          // Insert baru
          const { error: insErr } = await supabase
            .from('warehouse_stocks')
            .insert({
              catalog_id: catalogId,
              qty_available: qtyToAdd,
              last_updated: new Date().toISOString()
            });
          if (insErr) throw insErr;
        }
      }

      // 2. Ubah status request menjadi 'Diterima Gudang' 
      // (Bisa juga langsung 'Siap Distribusi' tergantung flow, kita pakai Diterima Gudang agar konsisten)
      const { error: reqErr } = await supabase
        .from('purchase_requests')
        .update({ status: 'Diterima Gudang' })
        .eq('id', reqId);
        
      if (reqErr) throw reqErr;

      showToast('success', 'Barang berhasil dimasukkan ke Master Stok!');
      fetchData();
    } catch (err) {
      console.error('Receive error:', err);
      showToast('error', 'Gagal memproses stok: ' + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  // Gudang mendistribusikan barang ke Outlet
  const handleDistributeToOutlet = async (reqId, outletName, items) => {
    if (!confirm(`Kirim barang ini ke Outlet ${outletName} sekarang? Stok pusat akan dikurangi.`)) return;
    
    setProcessingId(reqId);
    try {
      for (const item of items) {
        const catalogId = item.catalog.id;
        const qtyToSent = Number(item.qty_requested);

        // Kurangi stok pusat
        const { data: existStock } = await supabase
          .from('warehouse_stocks')
          .select('id, qty_available')
          .eq('catalog_id', catalogId)
          .single();

        if (!existStock || existStock.qty_available < qtyToSent) {
          throw new Error(`Stok ${item.catalog.item_name} tidak cukup di pusat!`);
        }

        await supabase
          .from('warehouse_stocks')
          .update({ 
            qty_available: Number(existStock.qty_available) - qtyToSent,
            last_updated: new Date().toISOString()
          })
          .eq('id', existStock.id);

        // Catat di log distribusi
        await supabase
          .from('stock_distributions')
          .insert({
            request_id: reqId,
            catalog_id: catalogId,
            outlet_name: outletName,
            qty_sent: qtyToSent,
            status: 'Dikirim',
            delivery_photo_url: 'https://via.placeholder.com/400x600.png?text=Bukti+Kirim' // Dummy foto
          });
      }

      // 3. Ubah status request jadi 'Sedang Dikirim' atau 'Selesai (Di sisi gudang)'
      await supabase
        .from('purchase_requests')
        .update({ status: 'Selesai (Dikirim ke Outlet)' })
        .eq('id', reqId);

      showToast('success', `Barang berhasil dikirim ke ${outletName}!`);
      fetchData();
    } catch (err) {
      console.error('Distribute error:', err);
      showToast('error', err.message);
    } finally {
      setProcessingId(null);
    }
  };


  return (
    <div className="space-y-4 animate-in fade-in duration-300">
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
              <Package className="w-4 h-4 text-blue-600" />
              Gudang Pusat
            </h3>
            <p className="text-[10px] text-slate-500 font-medium">Master Stok & Distribusi</p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex bg-slate-200/50 p-1.5 rounded-2xl gap-1">
        <button
          onClick={() => setActiveTab('stock')}
          className={`flex-1 py-2 text-[11px] font-black rounded-xl flex justify-center items-center gap-1.5 transition ${
            activeTab === 'stock' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          Master Stok
        </button>
        <button
          onClick={() => setActiveTab('incoming')}
          className={`flex-1 py-2 text-[11px] font-black rounded-xl flex justify-center items-center gap-1.5 transition ${
            activeTab === 'incoming' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Truck className="w-3.5 h-3.5" />
          Logistik
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          <span className="text-[11px] font-bold">Memuat data gudang...</span>
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
              <p className="text-xs text-slate-500">Tidak ada pengiriman logistik masuk atau keluar.</p>
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
