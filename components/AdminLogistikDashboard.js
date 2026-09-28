'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Package, Truck, Search, Loader2, Layers, CheckCircle, Plus, Minus, ShoppingCart, History, ArrowDownToLine, ArrowUpFromLine, Trash2, ListChecks, ChevronUp, ChevronDown, Clock, Send } from 'lucide-react';

export default function AdminLogistikDashboard({ onBack, userRole }) {
  const [activeTab, setActiveTab] = useState('pos'); // 'pos' | 'requests' | 'stock' | 'history'
  
  const [stocks, setStocks] = useState([]);
  const [requests, setRequests] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  
  // POS States
  const [cart, setCart] = useState([]);
  const [notes, setNotes] = useState('');
  const [selectedOutlet, setSelectedOutlet] = useState('');
  const [expandedDate, setExpandedDate] = useState(null);
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
          .select(`*, catalog:catalog_id(item_name, uom, category)`)
          .order('created_at', { ascending: false })
          .limit(100);
        if (historyErr && historyErr.code !== '42P01') throw historyErr;
        setTransactions(historyData || []);

      } else if (activeTab === 'requests') {
        const { data: reqData, error: reqErr } = await supabase
          .from('purchase_requests')
          .select(`
            *,
            purchase_request_items(
              id, qty_requested, 
              catalog:catalog_id(id, item_name, uom, category, supplier:supplier_id(id, name, contact_phone))
            )
          `)
          .neq('status', 'Selesai')
          .order('created_at', { ascending: false });
          
        if (reqErr) throw reqErr;
        setRequests(reqData || []);
      }
    } catch (err) {
      console.error('Fetch error:', err);
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
    showToast('success', `${stockItem.item_name} ditambahkan.`);
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

  const processTransaction = async (type) => {
    if (cart.length === 0) return showToast('error', 'Keranjang kosong!');
    if (type === 'OUT' && !selectedOutlet) return showToast('error', 'Pilih Outlet Tujuan!');
    if (!notes.trim() && type === 'IN') return showToast('error', 'Keterangan Masuk wajib diisi!');
    
    setProcessingId('transaction');
    try {
      const finalNotes = type === 'OUT' ? `Kirim ke: ${selectedOutlet} - ${notes}` : notes;
      
      for (const item of cart) {
        const catalogId = item.catalog.id;
        const qty = Number(item.qty);

        // 1. Catat Transaksi
        const { error: txErr } = await supabase.from('warehouse_transactions').insert({
          catalog_id: catalogId, transaction_type: type, qty: qty, notes: finalNotes
        });
        if (txErr && txErr.code !== '42P01') throw txErr;

        // 2. Update Stock
        const { data: existStock, error: existErr } = await supabase.from('warehouse_stocks').select('id, qty_available').eq('catalog_id', catalogId).single();
        if (existErr && existErr.code !== 'PGRST116') throw existErr;

        if (existStock) {
          const newQty = type === 'IN' ? Number(existStock.qty_available) + qty : Number(existStock.qty_available) - qty;
          await supabase.from('warehouse_stocks').update({ qty_available: newQty, last_updated: new Date().toISOString() }).eq('id', existStock.id);
        } else {
          const newQty = type === 'IN' ? qty : -qty;
          await supabase.from('warehouse_stocks').insert({ catalog_id: catalogId, qty_available: newQty, last_updated: new Date().toISOString() });
        }
      }

      showToast('success', `Berhasil memproses Mutasi ${type === 'IN' ? 'Masuk' : 'Keluar'}!`);
      setCart([]); setNotes(''); setSelectedOutlet('');
      fetchData();
    } catch (err) {
      if (err.code === '42P01') showToast('error', 'Tabel transaksi belum dibuat di SQL!');
      else showToast('error', err.message);
    } finally {
      setProcessingId(null);
    }
  };

  // ================= APPROVAL LOGIC =================
  const sendWhatsAppToSupplier = (supplier, items, reqId) => {
    if (!supplier?.contact_phone) return alert('Nomor supplier tidak tersedia!');
    let message = `Halo ${supplier.name},\nKami dari 3 Pillar Management ingin memesan:\n\n`;
    items.forEach((it, idx) => {
      message += `${idx + 1}. ${it.catalog?.item_name} - ${it.qty_requested} ${it.catalog?.uom}\n`;
    });
    message += `\nMohon konfirmasi ketersediaan barang. Terima kasih.`;
    
    let phone = supplier.contact_phone.replace(/[^0-9]/g, '');
    if (phone.startsWith('0')) phone = '62' + phone.substring(1);
    
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleProcessRequest = async (reqId) => {
    if (!confirm('Tandai sebagai diproses (Sedang dibeli/dikirim dari supplier)?')) return;
    setProcessingId(reqId);
    try {
      await supabase.from('purchase_requests').update({ status: 'Diproses' }).eq('id', reqId);
      showToast('success', 'Status diubah jadi Diproses!');
      fetchData();
    } catch (e) {
      showToast('error', 'Gagal memproses!');
    } finally { setProcessingId(null); }
  };

  const handleReceiveToWarehouse = async (reqId, items) => {
    if (!confirm('Barang telah tiba di Gudang Pusat? Stok akan otomatis bertambah.')) return;
    setProcessingId(reqId);
    try {
      for (const item of items) {
        const catalogId = item.catalog.id;
        const qtyToAdd = Number(item.qty_requested);

        const { data: existStock } = await supabase.from('warehouse_stocks').select('id, qty_available').eq('catalog_id', catalogId).single();
        if (existStock) {
          await supabase.from('warehouse_stocks').update({ qty_available: Number(existStock.qty_available) + qtyToAdd, last_updated: new Date().toISOString() }).eq('id', existStock.id);
        } else {
          await supabase.from('warehouse_stocks').insert({ catalog_id: catalogId, qty_available: qtyToAdd, last_updated: new Date().toISOString() });
        }
        
        await supabase.from('warehouse_transactions').insert({ catalog_id: catalogId, transaction_type: 'IN', qty: qtyToAdd, notes: 'PO Masuk ke Gudang' }).catch(() => {});
      }

      await supabase.from('purchase_requests').update({ status: 'Diterima Gudang' }).eq('id', reqId);
      showToast('success', 'Stok Gudang Bertambah!');
      fetchData();
    } catch (e) {
      showToast('error', 'Gagal terima barang!');
    } finally { setProcessingId(null); }
  };

  const handleSendToOutlet = async (reqId, outletName, items) => {
    if (!confirm(`Kirim ke ${outletName}? Stok pusat akan berkurang otomatis.`)) return;
    setProcessingId(reqId);
    try {
      for (const item of items) {
        const catalogId = item.catalog.id;
        const qtyToSent = Number(item.qty_requested);

        const { data: existStock } = await supabase.from('warehouse_stocks').select('id, qty_available').eq('catalog_id', catalogId).single();
        if (existStock) {
          await supabase.from('warehouse_stocks').update({ qty_available: Number(existStock.qty_available) - qtyToSent, last_updated: new Date().toISOString() }).eq('id', existStock.id);
        }
        await supabase.from('warehouse_transactions').insert({ catalog_id: catalogId, transaction_type: 'OUT', qty: qtyToSent, notes: `Distribusi PO ke ${outletName}` }).catch(() => {});
      }

      await supabase.from('purchase_requests').update({ status: 'Selesai' }).eq('id', reqId);
      showToast('success', 'Barang terkirim ke Outlet!');
      fetchData();
    } catch (e) {
      showToast('error', 'Gagal kirim ke outlet!');
    } finally { setProcessingId(null); }
  };

  // Render logic
  const groupedRequests = requests.reduce((acc, req) => {
    const d = req.request_date || new Date().toISOString().split('T')[0];
    if (!acc[d]) acc[d] = [];
    acc[d].push(req);
    return acc;
  }, {});

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
              <Package className="w-4 h-4 text-indigo-600" />
              Logistik & Supply Chain
            </h3>
            <p className="text-[10px] text-slate-500 font-medium">Gudang & Purchasing Terpadu</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-200/50 p-1.5 rounded-2xl gap-1 overflow-x-auto scrollbar-none">
        <button onClick={() => setActiveTab('pos')} className={`flex-shrink-0 px-4 py-2 text-[11px] font-black rounded-xl flex items-center gap-1.5 transition ${activeTab === 'pos' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <ShoppingCart className="w-3.5 h-3.5" /> POS Mutasi
        </button>
        <button onClick={() => setActiveTab('requests')} className={`flex-shrink-0 px-4 py-2 text-[11px] font-black rounded-xl flex items-center gap-1.5 transition ${activeTab === 'requests' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <ListChecks className="w-3.5 h-3.5" /> Request Leader
        </button>
        <button onClick={() => setActiveTab('history')} className={`flex-shrink-0 px-4 py-2 text-[11px] font-black rounded-xl flex items-center gap-1.5 transition ${activeTab === 'history' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <History className="w-3.5 h-3.5" /> Riwayat
        </button>
        <button onClick={() => setActiveTab('stock')} className={`flex-shrink-0 px-4 py-2 text-[11px] font-black rounded-xl flex items-center gap-1.5 transition ${activeTab === 'stock' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <Layers className="w-3.5 h-3.5" /> Master Stok
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
          <span className="text-[11px] font-bold">Memuat Sistem Logistik...</span>
        </div>
      ) : activeTab === 'pos' ? (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <h4 className="text-xs font-black text-slate-800 flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-indigo-500" />
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

            <div className="pt-2 space-y-2">
              <select
                value={selectedOutlet}
                onChange={e => setSelectedOutlet(e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="">-- Pilih Tujuan (Wajib Jika KELUAR) --</option>
                <option value="LazyBloom">LazyBloom</option>
                <option value="Deru Ombak">Deru Ombak</option>
                <option value="Sea Cafe">Sea Cafe</option>
                <option value="Mobile / Lapangan">Mobile / Lapangan</option>
                <option value="Lainnya">Lainnya (Retur/Rusak/Dll)</option>
              </select>

              <input
                type="text"
                placeholder="Keterangan Tambahan..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={() => processTransaction('IN')} disabled={processingId === 'transaction' || cart.length === 0} className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 disabled:opacity-50">
                {processingId === 'transaction' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowDownToLine className="w-4 h-4" />}
                MASUK (+)
              </button>
              <button onClick={() => processTransaction('OUT')} disabled={processingId === 'transaction' || cart.length === 0} className="flex-1 py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 disabled:opacity-50">
                {processingId === 'transaction' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUpFromLine className="w-4 h-4" />}
                KELUAR (-)
              </button>
            </div>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari & Tap barang ke keranjang..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-3 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:ring-2 shadow-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {stocks.filter(s => !searchQuery || s.item_name.toLowerCase().includes(searchQuery.toLowerCase())).map(stock => {
                const qty = stock.warehouse_stocks?.[0]?.qty_available || 0;
                return (
                  <button key={stock.id} onClick={() => addToCart(stock)} className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-col gap-2 relative overflow-hidden text-left hover:border-indigo-400 transition">
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${qty <= 0 ? 'bg-rose-500' : 'bg-indigo-500'}`} />
                    <div className="pl-2">
                      <span className="text-[9px] font-bold text-slate-400 uppercase">{stock.category || 'Barang'}</span>
                      <h4 className="text-[11px] font-black text-slate-900 leading-tight mt-0.5">{stock.item_name}</h4>
                    </div>
                    
                    <div className="pl-2 mt-auto pt-2 border-t border-slate-100 flex items-end justify-between w-full">
                      <span className="text-[10px] font-bold text-slate-500">
                        Sisa: <span className={qty <= 0 ? 'text-rose-600' : 'text-indigo-600'}>{qty}</span>
                      </span>
                      <Plus className="w-3.5 h-3.5 text-indigo-500 bg-indigo-50 rounded-full p-0.5" />
                    </div>
                  </button>
                );
            })}
          </div>
        </div>
      ) : activeTab === 'requests' ? (
        <div className="space-y-3">
          {Object.keys(groupedRequests).length === 0 ? (
             <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center">
               <CheckCircle className="w-8 h-8 text-emerald-300 mx-auto mb-2" />
               <h4 className="text-sm font-black text-slate-600">Semua Request Beres!</h4>
             </div>
          ) : (
             Object.keys(groupedRequests).sort((a,b) => new Date(b) - new Date(a)).map(date => (
              <div key={date} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <button onClick={() => setExpandedDate(expandedDate === date ? null : date)} className="w-full p-4 flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl"><Clock className="w-4 h-4" /></div>
                    <div className="text-left">
                      <h4 className="text-xs font-black text-slate-900">Req: {date}</h4>
                      <p className="text-[10px] text-slate-500">{groupedRequests[date].length} Request Outlet</p>
                    </div>
                  </div>
                  {expandedDate === date ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {expandedDate === date && (
                  <div className="p-4 border-t border-slate-100 space-y-4">
                    {groupedRequests[date].map(req => {
                      const itemsBySupplier = req.purchase_request_items.reduce((acc, item) => {
                        const supId = item.catalog?.supplier?.id || 'unknown';
                        if (!acc[supId]) acc[supId] = { supplier: item.catalog?.supplier, items: [] };
                        acc[supId].items.push(item);
                        return acc;
                      }, {});

                      return (
                        <div key={req.id} className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-3 relative overflow-hidden">
                          <div className={`absolute left-0 top-0 bottom-0 w-1 ${req.status === 'Menunggu Persetujuan' ? 'bg-rose-400' : req.status === 'Diproses' ? 'bg-amber-400' : 'bg-emerald-500'}`} />
                          
                          <div className="flex justify-between items-start pl-2">
                            <div>
                              <h5 className="text-xs font-black text-slate-900">{req.outlet_name}</h5>
                              <p className="text-[10px] text-slate-500">Oleh: {req.requested_by}</p>
                            </div>
                            <span className={`px-2 py-1 text-[9px] font-black rounded-lg ${req.status === 'Menunggu Persetujuan' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>{req.status}</span>
                          </div>

                          <div className="pl-2 space-y-2">
                            {Object.entries(itemsBySupplier).map(([supId, data]) => (
                              <div key={supId} className="bg-slate-50 border border-slate-100 rounded-xl overflow-hidden">
                                <div className="px-2.5 py-2 bg-slate-100/50 flex justify-between items-center">
                                  <span className="text-[10px] font-black text-slate-700">{data.supplier?.name || 'Tanpa Supplier / Internal'}</span>
                                  {req.status === 'Menunggu Persetujuan' && data.supplier && (
                                    <button onClick={() => sendWhatsAppToSupplier(data.supplier, data.items, req.id)} className="flex items-center gap-1 text-[9px] font-black text-emerald-600 bg-emerald-100 px-2 py-1 rounded-md">
                                      <Send className="w-3 h-3" /> Chat Supplier
                                    </button>
                                  )}
                                </div>
                                <ul className="p-2.5 space-y-1">
                                  {data.items.map(item => (
                                    <li key={item.id} className="text-[11px] flex justify-between border-b border-slate-100 pb-1 last:border-0 last:pb-0">
                                      <span className="text-slate-600">{item.catalog?.item_name}</span>
                                      <span className="font-bold text-slate-900">{item.qty_requested} {item.catalog?.uom}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>

                          <div className="pl-2 pt-1 flex gap-2">
                            {req.status === 'Menunggu Persetujuan' && (
                              <button onClick={() => handleProcessRequest(req.id)} disabled={processingId === req.id} className="flex-1 py-2.5 bg-indigo-600 text-white text-[11px] font-black rounded-xl">
                                {processingId === req.id ? 'Memproses...' : 'Tandai Sedang Diproses (Beli/Kirim)'}
                              </button>
                            )}
                            {req.status === 'Diproses' && (
                              <button onClick={() => handleReceiveToWarehouse(req.id, req.purchase_request_items)} disabled={processingId === req.id} className="flex-1 py-2.5 bg-emerald-600 text-white text-[11px] font-black rounded-xl">
                                {processingId === req.id ? 'Memproses...' : 'Masuk ke Gudang (Tiba)'}
                              </button>
                            )}
                            {req.status === 'Diterima Gudang' && (
                              <button onClick={() => handleSendToOutlet(req.id, req.outlet_name, req.purchase_request_items)} disabled={processingId === req.id} className="flex-1 py-2.5 bg-amber-500 text-white text-[11px] font-black rounded-xl">
                                {processingId === req.id ? 'Memproses...' : `Kirim & Selesai ke ${req.outlet_name}`}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
             ))
          )}
        </div>
      ) : activeTab === 'history' ? (
        <div className="space-y-3 animate-in fade-in">
          {transactions.map(tx => (
            <div key={tx.id} className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${tx.transaction_type === 'IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                    {tx.transaction_type === 'IN' ? 'MASUK' : 'KELUAR'}
                  </span>
                  <span className="text-[9px] text-slate-400 font-medium">{new Date(tx.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</span>
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
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {stocks.map(stock => {
              const qty = stock.warehouse_stocks?.[0]?.qty_available || 0;
              return (
                <div key={stock.id} className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-col gap-2 relative overflow-hidden">
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${qty === 0 ? 'bg-rose-500' : 'bg-indigo-500'}`} />
                  <div className="pl-2">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">{stock.category || 'Barang'}</span>
                    <h4 className="text-xs font-black text-slate-900">{stock.item_name}</h4>
                  </div>
                  <div className="pl-2 mt-auto pt-2 border-t border-slate-100">
                    <span className="text-[9px] text-slate-500 block mb-0.5">Stok Saat Ini:</span>
                    <div className="flex items-baseline gap-1">
                      <span className={`text-lg font-black leading-none ${qty === 0 ? 'text-rose-600' : 'text-indigo-600'}`}>{qty}</span>
                      <span className="text-[10px] font-bold text-slate-400">{stock.uom}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
