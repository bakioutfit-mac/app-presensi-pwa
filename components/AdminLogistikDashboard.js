'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Edit3, X, Save, Package, Truck, Search, Loader2, Layers, CheckCircle, Plus, Minus, ShoppingCart, History, ArrowDownToLine, ArrowUpFromLine, Trash2, ListChecks, ChevronUp, ChevronDown, Clock, Send, RefreshCw } from 'lucide-react';

export default function AdminLogistikDashboard({ onBack, userRole }) {
  const [activeTab, setActiveTab] = useState('pos'); // 'pos' | 'requests' | 'stock' | 'history'
  
  const [stocks, setStocks] = useState([]);
  const [requests, setRequests] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  
  // PO Supplier State
  const [poCart, setPoCart] = useState([]);
  const [expandedSupplier, setExpandedSupplier] = useState(null);
  const [supplierSubTab, setSupplierSubTab] = useState('order'); // 'order' | 'data'
  const [newSupplier, setNewSupplier] = useState({ name: '', wa_number: '', category: '' });
  
  // POS States
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [editingCatalog, setEditingCatalog] = useState(null);
  const [catalogForm, setCatalogForm] = useState({ item_name: '', uom: '', category: '' });
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
              catalog:catalog_id(id, item_name, uom, category, supplier:suppliers(id, name, wa_number))
            )
          `)
          .neq('status', 'Selesai')
          .order('created_at', { ascending: false });
          
        if (reqErr) throw reqErr;
        setRequests(reqData || []);
      } else if (activeTab === 'suppliers') {
        const { data: supData, error: supErr } = await supabase
          .from('suppliers')
          .select('*, inventory_catalogs(id, item_name, uom, category)')
          .order('name', { ascending: true });
        if (supErr) throw supErr;
        setSuppliers(supData || []);
      }
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };


  const handleSaveCatalog = async () => {
    if (!catalogForm.item_name || !catalogForm.uom) return showToast('error', 'Nama dan Satuan wajib diisi!');
    setProcessingId('save-catalog');
    try {
      if (editingCatalog) {
        const { error } = await supabase.from('inventory_catalogs').update({
          item_name: catalogForm.item_name,
          uom: catalogForm.uom,
          category: catalogForm.category || 'General'
        }).eq('id', editingCatalog.id);
        if (error) throw error;
        showToast('success', 'Barang berhasil diupdate!');
      } else {
        const { error } = await supabase.from('inventory_catalogs').insert({
          item_name: catalogForm.item_name,
          uom: catalogForm.uom,
          category: catalogForm.category || 'General'
        });
        if (error) throw error;
        showToast('success', 'Barang baru berhasil ditambahkan!');
      }
      setShowCatalogModal(false);
      setEditingCatalog(null);
      setCatalogForm({ item_name: '', uom: '', category: '' });
      fetchData();
    } catch (err) {
      showToast('error', 'Gagal menyimpan barang!');
    } finally { setProcessingId(null); }
  };

  const handleDeleteCatalog = async (id, name) => {
    if (!confirm(`Hapus permanen ${name} dari database?`)) return;
    setProcessingId(id);
    try {
      // Hapus relasi yang mencegah penghapusan (RESTRICT)
      await supabase.from('purchase_request_items').delete().eq('catalog_id', id);
      
      const { error } = await supabase.from('inventory_catalogs').delete().eq('id', id);
      if (error) throw error;
      showToast('success', `${name} berhasil dihapus!`);
      fetchData();
    } catch (err) {
      console.error(err); showToast('error', err.message || 'Gagal menghapus barang!');
    } finally { setProcessingId(null); }
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

  const handleAddSupplier = async () => {
    if (!newSupplier.name || !newSupplier.wa_number) return showToast('error', 'Nama dan WA wajib diisi!');
    setProcessingId('add-supplier');
    try {
      const { data, error } = await supabase.from('suppliers').insert({
        name: newSupplier.name,
        wa_number: newSupplier.wa_number,
        category: newSupplier.category || 'Umum'
      }).select().single();
      if (error) throw error;
      setSuppliers(prev => [...prev, data]);
      setNewSupplier({ name: '', wa_number: '', category: '' });
      showToast('success', 'Supplier berhasil ditambahkan!');
    } catch (err) {
      showToast('error', 'Gagal menambah supplier!');
    } finally {
      setProcessingId(null);
    }
  };

  // ================= PO SUPPLIER LOGIC =================
  const updatePoCart = (supplierId, catalogItem, delta) => {
    setPoCart(prev => {
      const supplierCart = prev[supplierId] || [];
      const existing = supplierCart.find(item => item.catalog.id === catalogItem.id);
      let newSupplierCart;
      
      if (existing) {
        newSupplierCart = supplierCart.map(item => 
          item.catalog.id === catalogItem.id ? { ...item, qty: item.qty + delta } : item
        ).filter(item => item.qty > 0);
      } else if (delta > 0) {
        newSupplierCart = [...supplierCart, { catalog: catalogItem, qty: delta }];
      } else {
        newSupplierCart = supplierCart;
      }

      return { ...prev, [supplierId]: newSupplierCart };
    });
  };

  const sendPoToSupplier = (supplier) => {
    const items = poCart[supplier.id] || [];
    if (items.length === 0) return showToast('error', 'Pilih minimal 1 barang!');
    if (!supplier.wa_number) return showToast('error', 'Nomor WA supplier tidak tersedia!');
    
    let message = `Halo ${supplier.name},\nKami dari 3 Pillar Management (Gudang Pusat) ingin memesan:\n\n`;
    items.forEach((it, idx) => {
      message += `${idx + 1}. ${it.catalog?.item_name} - ${it.qty} ${it.catalog?.uom}\n`;
    });
    message += `\nMohon diproses. Terima kasih.`;
    
    let phone = supplier.wa_number.replace(/[^0-9]/g, '');
    if (phone.startsWith('0')) phone = '62' + phone.substring(1);
    
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
    
    setPoCart(prev => ({ ...prev, [supplier.id]: [] }));
  };


  const addToPoCart = (stockItem) => {
    setPoCart(prev => {
      const existing = prev.find(item => item.catalog.id === stockItem.id || item.catalog.id === stockItem.catalog?.id);
      if (existing) {
        return prev.map(item => (item.catalog.id === stockItem.id || item.catalog.id === stockItem.catalog?.id) ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { catalog: stockItem.catalog || stockItem, qty: 1 }];
    });
  };

  const updatePoCartQty = (catalogId, delta) => {
    setPoCart(prev => prev.map(item => {
      if (item.catalog.id === catalogId) {
        const newQty = item.qty + delta;
        return newQty > 0 ? { ...item, qty: newQty } : item;
      }
      return item;
    }));
  };

  const removeFromPoCart = (catalogId) => setPoCart(prev => prev.filter(item => item.catalog.id !== catalogId));

  const [selectedSupplierForWa, setSelectedSupplierForWa] = useState('');

  const handleSendWaGlobal = () => {
    if (poCart.length === 0) return showToast('error', 'Keranjang masih kosong!');
    if (!selectedSupplierForWa) return showToast('error', 'Pilih supplier tujuan!');
    
    const supplier = suppliers.find(s => s.id === selectedSupplierForWa);
    if (!supplier?.wa_number) return showToast('error', 'Nomor WhatsApp supplier tidak tersedia!');

    let message = `Halo ${supplier.name},\nKami dari 3 Pillar Management ingin memesan barang berikut:\n\n`;
    poCart.forEach((it, idx) => {
      message += `${idx + 1}. ${it.catalog?.item_name} - ${it.qty} ${it.catalog?.uom}\n`;
    });
    message += `\nMohon konfirmasi ketersediaannya ya. Terima kasih.`;
    
    let phone = supplier.wa_number.replace(/[^0-9]/g, '');
    if (phone.startsWith('0')) phone = '62' + phone.substring(1);
    
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
    // Opsional: kosongkan keranjang setelah kirim WA
    // setPoCart([]);
  };

  // ================= APPROVAL LOGIC =================
  const sendWhatsAppToSupplier = (supplier, items, reqId) => {
    if (!supplier?.wa_number) return alert('Nomor supplier tidak tersedia!');
    let message = `Halo ${supplier.name},\nKami dari 3 Pillar Management ingin memesan:\n\n`;
    items.forEach((it, idx) => {
      message += `${idx + 1}. ${it.catalog?.item_name} - ${it.qty_requested} ${it.catalog?.uom}\n`;
    });
    message += `\nMohon konfirmasi ketersediaan barang. Terima kasih.`;
    
    let phone = supplier.wa_number.replace(/[^0-9]/g, '');
    if (phone.startsWith('0')) phone = '62' + phone.substring(1);
    
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
  };


  const handleAcceptRequest = async (reqId) => {
    if (!confirm('Terima request ini dan mulai siapkan barangnya?')) return;
    setProcessingId(reqId);
    try {
      await supabase.from('purchase_requests').update({ status: 'Sedang disiapkan' }).eq('id', reqId);
      showToast('success', 'Status diubah jadi Sedang disiapkan!');
      fetchData();
    } catch (e) {
      showToast('error', 'Gagal memproses!');
    } finally { setProcessingId(null); }
  };




  const handleSendToOutlet = async (reqId, outletName, items) => {
    if (!confirm(`Serahkan barang ke ${outletName}? Stok pusat akan berkurang otomatis.`)) return;
    setProcessingId(reqId);
    try {
      for (const item of items) {
        if (!item.catalog) continue;
        const catalogId = item.catalog.id;
        const qtyToSent = Number(item.qty_requested);

        const { data: existStock, error: existErr } = await supabase.from('warehouse_stocks').select('id, qty_available').eq('catalog_id', catalogId).single();
        if (existErr && existErr.code !== 'PGRST116') throw existErr;
        
        if (existStock) {
          const { error: updErr } = await supabase.from('warehouse_stocks').update({ qty_available: Number(existStock.qty_available) - qtyToSent, last_updated: new Date().toISOString() }).eq('id', existStock.id);
          if (updErr) throw updErr;
        }
        const { error: txErr } = await supabase.from('warehouse_transactions').insert({ catalog_id: catalogId, transaction_type: 'OUT', qty: qtyToSent, notes: `Distribusi ke ${outletName}` });
        if (txErr && txErr.code !== '42P01') throw txErr;
      }

      const { error: reqErr } = await supabase.from('purchase_requests').update({ status: 'Siap diambil' }).eq('id', reqId);
      if (reqErr) throw reqErr;
      
      showToast('success', 'Barang diserahkan ke Outlet (Menunggu Konfirmasi Leader)!');
      fetchData();
    } catch (e) {
      console.error(e);
      showToast('error', e.message || 'Gagal serahkan barang!');
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
        <button onClick={fetchData} className="p-2 rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition shadow-xs">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-200/50 p-1.5 rounded-2xl gap-1 overflow-x-auto scrollbar-none">
        <button onClick={() => setActiveTab('pos')} className={`flex-shrink-0 px-4 py-2 text-[11px] font-black rounded-xl flex items-center gap-1.5 transition ${activeTab === 'pos' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <ShoppingCart className="w-3.5 h-3.5" /> POS Mutasi
        </button>
        <button onClick={() => setActiveTab('requests')} className={`flex-shrink-0 px-4 py-2 text-[11px] font-black rounded-xl flex items-center gap-1.5 transition ${activeTab === 'requests' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <ListChecks className="w-3.5 h-3.5" /> Request Outlet
        </button>
        <button onClick={() => setActiveTab('history')} className={`flex-shrink-0 px-4 py-2 text-[11px] font-black rounded-xl flex items-center gap-1.5 transition ${activeTab === 'history' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <History className="w-3.5 h-3.5" /> Riwayat
        </button>
        <button onClick={() => setActiveTab('stock')} className={`flex-shrink-0 px-4 py-2 text-[11px] font-black rounded-xl flex items-center gap-1.5 transition ${activeTab === 'stock' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <Layers className="w-3.5 h-3.5" /> Master Stok
        </button>
        <button onClick={() => setActiveTab('suppliers')} className={`flex-shrink-0 px-4 py-2 text-[11px] font-black rounded-xl flex items-center gap-1.5 transition ${activeTab === 'suppliers' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <Truck className="w-3.5 h-3.5" /> Order Supplier
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
                          <div className={`absolute left-0 top-0 bottom-0 w-1 ${req.status === 'Menunggu Persetujuan' ? 'bg-rose-400' : req.status === 'Sedang disiapkan' ? 'bg-amber-400' : 'bg-emerald-500'}`} />
                          
                          <div className="flex justify-between items-start pl-2">
                            <div>
                              <h5 className="text-xs font-black text-slate-900">{req.outlet_name}</h5>
                              <p className="text-[10px] text-slate-500">Oleh: {req.requested_by}</p>
                            </div>
                            <span className={`px-2 py-1 text-[9px] font-black rounded-lg ${req.status === 'Menunggu Persetujuan' ? 'bg-rose-100 text-rose-700' : req.status === 'Sedang disiapkan' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{req.status}</span>
                          </div>


                          <div className="pl-2 space-y-2">
                            <ul className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 space-y-1">
                              {req.purchase_request_items.map(item => (
                                <li key={item.id} className="text-[11px] flex justify-between border-b border-slate-100 pb-1 last:border-0 last:pb-0">
                                  <span className="text-slate-600">{item.catalog?.item_name || 'Barang Terhapus'}</span>
                                  <span className="font-bold text-slate-900">{item.qty_requested} {item.catalog?.uom || ''}</span>
                                </li>
                              ))}
                            </ul>
                          </div>


                          <div className="pl-2 pt-1 flex gap-2">
                            {req.status === 'Menunggu Persetujuan' && (
                              <button onClick={() => handleAcceptRequest(req.id)} disabled={processingId === req.id} className="flex-1 py-2.5 bg-indigo-600 text-white text-[11px] font-black rounded-xl hover:bg-indigo-700 transition">
                                {processingId === req.id ? 'Memproses...' : 'Terima Request (Siapkan)'}
                              </button>
                            )}
                            {req.status === 'Sedang disiapkan' && (
                              <button onClick={() => handleSendToOutlet(req.id, req.outlet_name, req.purchase_request_items)} disabled={processingId === req.id} className="flex-1 py-2.5 bg-emerald-600 text-white text-[11px] font-black rounded-xl hover:bg-emerald-700 transition">
                                {processingId === req.id ? 'Memproses...' : 'Serahkan Barang (Selesai Disiapkan)'}
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
      ) : activeTab === 'suppliers' ? (
        <div className="space-y-4">
          <div className="flex bg-slate-200/50 p-1.5 rounded-2xl gap-1">
            <button onClick={() => setSupplierSubTab('order')} className={`flex-1 py-2 text-[11px] font-black rounded-xl flex items-center justify-center gap-1.5 transition ${supplierSubTab === 'order' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <ShoppingCart className="w-3.5 h-3.5" /> Order via WA
            </button>
            <button onClick={() => setSupplierSubTab('data')} className={`flex-1 py-2 text-[11px] font-black rounded-xl flex items-center justify-center gap-1.5 transition ${supplierSubTab === 'data' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <Layers className="w-3.5 h-3.5" /> Master Data Supplier
            </button>
          </div>

          {supplierSubTab === 'order' ? (
            <div className="space-y-4 animate-in fade-in">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <h4 className="text-xs font-black text-slate-800 flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-green-500" />
                  Rekapan Order ({poCart.length} item)
                </h4>
                
                {poCart.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400 font-medium italic border-2 border-dashed border-slate-100 rounded-xl">
                    Keranjang kosong. Pilih barang dari daftar di bawah.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                    {poCart.map(item => (
                      <div key={item.catalog.id} className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <div className="flex-1">
                          <p className="text-[11px] font-black text-slate-900">{item.catalog.item_name}</p>
                          <p className="text-[9px] text-slate-500">{item.catalog.uom}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => updatePoCartQty(item.catalog.id, -1)} className="w-6 h-6 rounded bg-white border border-slate-200 flex items-center justify-center text-slate-600">
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-xs font-black w-6 text-center">{item.qty}</span>
                          <button onClick={() => updatePoCartQty(item.catalog.id, 1)} className="w-6 h-6 rounded bg-white border border-slate-200 flex items-center justify-center text-slate-600">
                            <Plus className="w-3 h-3" />
                          </button>
                          <button onClick={() => removeFromPoCart(item.catalog.id)} className="w-6 h-6 ml-2 rounded bg-rose-50 text-rose-600 flex items-center justify-center">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-2 space-y-2 border-t border-slate-100">
                  <select
                    value={selectedSupplierForWa}
                    onChange={e => setSelectedSupplierForWa(e.target.value)}
                    className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-green-500 outline-none"
                  >
                    <option value="">-- Pilih Supplier Tujuan --</option>
                    {suppliers.map(sup => (
                      <option key={sup.id} value={sup.id}>{sup.name} ({sup.category || 'Umum'})</option>
                    ))}
                  </select>

                  <button onClick={handleSendWaGlobal} disabled={poCart.length === 0 || !selectedSupplierForWa} className="w-full py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl text-xs font-black transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50">
                    <Send className="w-4 h-4" />
                    KIRIM REKAPAN VIA WA
                  </button>
                </div>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari & Tap barang ke rekap..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-3 text-xs font-medium text-slate-700 focus:border-green-500 focus:ring-2 shadow-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pb-20">
                {stocks.filter(s => !searchQuery || s.item_name.toLowerCase().includes(searchQuery.toLowerCase())).map(stock => {
                  const qty = stock.warehouse_stocks?.[0]?.qty_available || 0;
                  return (
                    <button key={stock.id} onClick={() => addToPoCart(stock)} className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-col gap-2 relative overflow-hidden text-left hover:border-green-400 transition">
                      <div className={`absolute left-0 top-0 bottom-0 w-1 ${qty <= 0 ? 'bg-rose-500' : 'bg-green-500'}`} />
                      <div className="pl-2">
                        <span className="text-[9px] font-bold text-slate-400 uppercase">{stock.category || 'Barang'}</span>
                        <h4 className="text-[11px] font-black text-slate-900 leading-tight mt-0.5">{stock.item_name}</h4>
                      </div>
                      <div className="pl-2 mt-auto pt-2 border-t border-slate-100 flex items-end justify-between w-full">
                        <span className="text-[10px] font-bold text-slate-500">
                          Sisa: <span className={qty <= 0 ? 'text-rose-600' : 'text-slate-900'}>{qty}</span>
                        </span>
                        <Plus className="w-3.5 h-3.5 text-green-500 bg-green-50 rounded-full p-0.5" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in">
              <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm space-y-3">
                <h4 className="text-xs font-black text-slate-900 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-indigo-500" />
                  Tambah Supplier Baru
                </h4>
                <div className="space-y-2">
                  <input type="text" placeholder="Nama Supplier / Toko" value={newSupplier.name} onChange={e => setNewSupplier({...newSupplier, name: e.target.value})} className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:bg-white transition outline-none font-medium" />
                  <input type="text" placeholder="Nomor WhatsApp (Cth: 0812...)" value={newSupplier.wa_number} onChange={e => setNewSupplier({...newSupplier, wa_number: e.target.value})} className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:bg-white transition outline-none font-medium" />
                  <input type="text" placeholder="Kategori (Opsional, cth: Sembako)" value={newSupplier.category} onChange={e => setNewSupplier({...newSupplier, category: e.target.value})} className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:bg-white transition outline-none font-medium" />
                  <button onClick={handleAddSupplier} disabled={processingId === 'add-supplier'} className="w-full py-3 bg-indigo-600 text-white rounded-xl text-xs font-black flex justify-center items-center gap-2 mt-2 shadow-sm disabled:opacity-50">
                    {processingId === 'add-supplier' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Simpan Data Supplier
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {suppliers.map(sup => (
                  <div key={sup.id} className="bg-white p-3 border border-slate-200 rounded-2xl flex items-center justify-between shadow-xs">
                    <div>
                      <h5 className="text-[11px] font-black text-slate-900">{sup.name}</h5>
                      <p className="text-[10px] text-slate-500 font-medium mt-0.5">{sup.wa_number} • {sup.category || 'Umum'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="relative flex-1 mr-2">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari master barang..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:ring-2 shadow-sm outline-none"
              />
            </div>
            <button onClick={() => { setEditingCatalog(null); setCatalogForm({ item_name: '', uom: '', category: '' }); setShowCatalogModal(true); }} className="flex-shrink-0 w-10 h-10 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full flex items-center justify-center shadow-md transition">
              <Plus className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {stocks.filter(s => !searchQuery || s.item_name.toLowerCase().includes(searchQuery.toLowerCase())).map(stock => {
              const qty = stock.warehouse_stocks?.[0]?.qty_available || 0;
              return (
                <div key={stock.id} className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-col gap-2 relative overflow-hidden group">
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${qty === 0 ? 'bg-rose-500' : 'bg-indigo-500'}`} />
                  <div className="pl-2 pr-1 flex justify-between items-start">
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase">{stock.category || 'Barang'}</span>
                      <h4 className="text-[11px] font-black text-slate-900 leading-tight">{stock.item_name}</h4>
                    </div>
                    <div className="flex flex-col gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditingCatalog(stock); setCatalogForm({ item_name: stock.item_name, uom: stock.uom, category: stock.category }); setShowCatalogModal(true); }} className="p-1 bg-slate-100 text-slate-600 rounded-md hover:bg-indigo-100 hover:text-indigo-600"><Edit3 className="w-3 h-3" /></button>
                      <button onClick={() => handleDeleteCatalog(stock.id, stock.item_name)} disabled={processingId === stock.id} className="p-1 bg-slate-100 text-slate-600 rounded-md hover:bg-rose-100 hover:text-rose-600"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  </div>
                  <div className="pl-2 mt-auto pt-2 border-t border-slate-100">
                    <span className="text-[9px] text-slate-500 block mb-0.5">Stok Gudang:</span>
                    <div className="flex items-baseline gap-1">
                      <span className={`text-lg font-black leading-none ${qty === 0 ? 'text-rose-600' : 'text-indigo-600'}`}>{qty}</span>
                      <span className="text-[10px] font-bold text-slate-400">{stock.uom}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Modal Catalog */}
          {showCatalogModal && (
            <div className="fixed inset-0 bg-slate-900/50 z-[100] flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="text-sm font-black text-slate-900">{editingCatalog ? 'Edit Barang' : 'Tambah Barang Baru'}</h3>
                  <button onClick={() => setShowCatalogModal(false)} className="p-2 bg-slate-100 rounded-xl text-slate-500 hover:bg-rose-100 hover:text-rose-600"><X className="w-4 h-4" /></button>
                </div>
                <div className="p-4 space-y-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Nama Barang</label>
                    <input type="text" value={catalogForm.item_name} onChange={e => setCatalogForm({...catalogForm, item_name: e.target.value})} className="w-full mt-1 p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-medium" placeholder="Cth: Kopi Arabica" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Satuan (UOM)</label>
                    <input type="text" value={catalogForm.uom} onChange={e => setCatalogForm({...catalogForm, uom: e.target.value})} className="w-full mt-1 p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-medium" placeholder="Cth: kg / pcs / renceng" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Kategori</label>
                    <input type="text" value={catalogForm.category} onChange={e => setCatalogForm({...catalogForm, category: e.target.value})} className="w-full mt-1 p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-medium" placeholder="Cth: Bahan Baku" />
                  </div>
                </div>
                <div className="p-4 border-t border-slate-100">
                  <button onClick={handleSaveCatalog} disabled={processingId === 'save-catalog'} className="w-full py-3 bg-indigo-600 text-white rounded-xl text-xs font-black flex justify-center items-center gap-2 shadow-sm">
                    {processingId === 'save-catalog' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Simpan Data
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
