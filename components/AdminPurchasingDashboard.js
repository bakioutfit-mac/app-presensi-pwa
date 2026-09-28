'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, CheckCircle, Clock, Truck, ListChecks, MessageCircle, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import BrandLogo from './BrandLogo';

export default function AdminPurchasingDashboard({ onBack }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedDate, setExpandedDate] = useState(null);
  
  const [processingId, setProcessingId] = useState(null);
  const [toast, setToast] = useState({ type: '', text: '' });

  const showToast = (type, text) => {
    setToast({ type, text });
    setTimeout(() => setToast({ type: '', text: '' }), 4000);
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      // Mengambil semua request beserta item dan data supplier dari relasi
      const { data, error } = await supabase
        .from('purchase_requests')
        .select(`
          *,
          purchase_request_items(
            id,
            qty_requested,
            status,
            catalog:catalog_id(
              item_name,
              uom,
              supplier:supplier_id(
                id,
                name,
                wa_number
              )
            )
          )
        `)
        .order('request_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests(data || []);
      
      // Auto expand the latest date
      if (data && data.length > 0) {
        setExpandedDate(data[0].request_date);
      }
    } catch (err) {
      console.error('Error fetching requests:', err);
      showToast('error', 'Gagal memuat data permintaan barang.');
    } finally {
      setLoading(false);
    }
  };

  // Mengelompokkan berdasarkan tanggal
  const groupedRequests = requests.reduce((acc, curr) => {
    const date = curr.request_date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(curr);
    return acc;
  }, {});

  // Fitur WhatsApp Otomatis ke Supplier
  const handleWhatsAppSupplier = (supplier, itemsToOrder, outletName) => {
    if (!supplier?.wa_number) {
      showToast('error', 'Nomor WA supplier tidak tersedia di database.');
      return;
    }

    // Format nomor WA (pastikan diawali 62)
    let waNumber = supplier.wa_number.replace(/\D/g, '');
    if (waNumber.startsWith('0')) waNumber = '62' + waNumber.substring(1);

    // Menyusun teks pesanan
    let text = `Halo Admin *${supplier.name}*,\nKami dari 3 Pillar Management (Outlet: ${outletName}) ingin memesan barang berikut:\n\n`;
    itemsToOrder.forEach((item, index) => {
      text += `${index + 1}. ${item.catalog?.item_name} = *${item.qty_requested} ${item.catalog?.uom}*\n`;
    });
    text += `\nMohon konfirmasi ketersediaan dan total tagihannya ya. Terima kasih!`;

    const encodedText = encodeURIComponent(text);
    const waUrl = `https://wa.me/${waNumber}?text=${encodedText}`;
    
    // Buka di tab baru
    window.open(waUrl, '_blank');
  };

  // Fitur Approve (Ubah Status ke Diproses)
  const handleApprove = async (requestId) => {
    if (!confirm('Tandai permintaan ini sebagai "Sedang Diproses" (Sudah dihubungi supplier)?')) return;
    
    setProcessingId(requestId);
    try {
      const { error } = await supabase
        .from('purchase_requests')
        .update({ status: 'Diproses' })
        .eq('id', requestId);

      if (error) throw error;
      
      showToast('success', 'Status berhasil diubah menjadi Diproses!');
      fetchRequests(); // refresh data
    } catch (err) {
      console.error('Approve error:', err);
      showToast('error', 'Gagal mengubah status: ' + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  // Fitur Kirim ke Finance/Gudang (Tandai Selesai di level Purchasing)
  const handleSendToWarehouse = async (requestId) => {
    if (!confirm('Tandai barang telah tiba di Gudang Pusat (Beralih ke Task Gudang)?')) return;
    
    setProcessingId(requestId);
    try {
      const { error } = await supabase
        .from('purchase_requests')
        .update({ status: 'Diterima Gudang' })
        .eq('id', requestId);

      if (error) throw error;
      
      showToast('success', 'Barang diteruskan ke Gudang Pusat!');
      fetchRequests(); // refresh data
    } catch (err) {
      console.error('Update error:', err);
      showToast('error', 'Gagal update status: ' + err.message);
    } finally {
      setProcessingId(null);
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
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 shadow-xs transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
              <ListChecks className="w-4 h-4 text-emerald-600" />
              <span>Task Purchasing</span>
              <span className="text-[9px] bg-emerald-600 text-white px-2 py-0.5 rounded-full font-black">
                Procurement
              </span>
            </h3>
            <p className="text-[10px] text-slate-500 font-medium">Validasi stok & order barang ke supplier</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
          <span className="text-[11px] font-bold">Memuat daftar permintaan...</span>
        </div>
      ) : Object.keys(groupedRequests).length === 0 ? (
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm text-center space-y-3">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto">
            <CheckCircle className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-black text-slate-800">Semua Beres!</h4>
          <p className="text-xs text-slate-500">Tidak ada pengajuan barang baru dari outlet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {Object.keys(groupedRequests).sort((a,b) => new Date(b) - new Date(a)).map(date => (
            <div key={date} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden transition-all">
              {/* Accordion Header */}
              <button
                type="button"
                onClick={() => setExpandedDate(expandedDate === date ? null : date)}
                className="w-full p-4 flex items-center justify-between bg-slate-50/50 hover:bg-slate-50 transition"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <h4 className="text-xs font-black text-slate-900">Pengajuan: {date}</h4>
                    <p className="text-[10px] text-slate-500">{groupedRequests[date].length} Request Outlet</p>
                  </div>
                </div>
                {expandedDate === date ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>

              {/* Accordion Body */}
              {expandedDate === date && (
                <div className="p-4 border-t border-slate-100 space-y-4">
                  {groupedRequests[date].map(req => {
                    // Kelompokkan item berdasarkan supplier agar bisa kirim 1 WA per supplier
                    const itemsBySupplier = req.purchase_request_items.reduce((acc, item) => {
                      const supId = item.catalog?.supplier?.id || 'unknown';
                      if (!acc[supId]) {
                        acc[supId] = {
                          supplier: item.catalog?.supplier,
                          items: []
                        };
                      }
                      acc[supId].items.push(item);
                      return acc;
                    }, {});

                    return (
                      <div key={req.id} className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-3 relative overflow-hidden">
                        {/* Garis Warna Status */}
                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                          req.status.includes('Menunggu') ? 'bg-amber-400' :
                          req.status.includes('Gudang') ? 'bg-blue-500' :
                          'bg-emerald-500'
                        }`} />

                        <div className="flex justify-between items-start pl-2">
                          <div>
                            <h5 className="text-xs font-black text-slate-900">{req.outlet_name}</h5>
                            <p className="text-[10px] text-slate-500">Oleh: {req.requested_by}</p>
                          </div>
                          <span className={`px-2 py-1 text-[9px] font-black rounded-lg ${
                            req.status.includes('Menunggu') ? 'bg-amber-100 text-amber-700' :
                            req.status.includes('Gudang') ? 'bg-blue-100 text-blue-700' :
                            'bg-emerald-100 text-emerald-700'
                          }`}>
                            {req.status}
                          </span>
                        </div>

                        {req.notes && (
                          <div className="pl-2">
                            <p className="text-[10px] bg-amber-50 text-amber-800 p-2 rounded-lg italic">
                              " {req.notes} "
                            </p>
                          </div>
                        )}

                        <div className="space-y-3 pl-2 pt-2 border-t border-slate-100">
                          {Object.values(itemsBySupplier).map((group, idx) => (
                            <div key={idx} className="bg-slate-50 rounded-xl p-2.5 border border-slate-200">
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-[10px] font-black text-slate-700">
                                  🏢 {group.supplier?.name || 'Tanpa Supplier (Lokal)'}
                                </span>
                                {group.supplier?.wa_number && (
                                  <button
                                    onClick={() => handleWhatsAppSupplier(group.supplier, group.items, req.outlet_name)}
                                    className="px-2 py-1 bg-green-500 hover:bg-green-600 text-white text-[9px] font-bold rounded-lg flex items-center gap-1 transition"
                                  >
                                    <MessageCircle className="w-3 h-3" />
                                    WA Supplier
                                  </button>
                                )}
                              </div>
                              <ul className="space-y-1">
                                {group.items.map(item => (
                                  <li key={item.id} className="text-[11px] flex justify-between">
                                    <span className="text-slate-600">• {item.catalog?.item_name}</span>
                                    <span className="font-bold text-slate-900">{item.qty_requested} {item.catalog?.uom}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2 pl-2 pt-2">
                          {req.status === 'Menunggu Purchasing' && (
                            <button
                              onClick={() => handleApprove(req.id)}
                              disabled={processingId === req.id}
                              className="flex-1 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[10px] font-black rounded-xl transition flex justify-center items-center gap-1 disabled:opacity-50"
                            >
                              {processingId === req.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <ListChecks className="w-3 h-3" />}
                              Validasi (Sedang Diproses)
                            </button>
                          )}
                          
                          {req.status === 'Diproses' && (
                            <button
                              onClick={() => handleSendToWarehouse(req.id)}
                              disabled={processingId === req.id}
                              className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black rounded-xl transition flex justify-center items-center gap-1 disabled:opacity-50"
                            >
                              {processingId === req.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Truck className="w-3 h-3" />}
                              Teruskan ke Gudang Pusat
                            </button>
                          )}
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
