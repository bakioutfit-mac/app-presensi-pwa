'use client';
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { formatRupiah } from '@/lib/currency';
import { Receipt, AlertCircle, RefreshCw, Briefcase, FileText, Banknote, ShoppingCart, UserCheck, X, TrendingUp, Calendar, ChevronUp, ChevronDown } from 'lucide-react';

export default function OwnerFinanceTab({ user, onBack, showToast }) {
  const [subTab, setSubTab] = useState('gaji'); // 'gaji', 'revenue', 'po'
  const [salaryList, setSalaryList] = useState([]);
  const [poList, setPoList] = useState([]);
  const [expandedPeriods, setExpandedPeriods] = useState({});
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (subTab === 'gaji') {
        // Fetch dari payslips, ambil yang sudah di-release (atau semuanya karena payslip dibuat saat sudah fix)
        const { data, error } = await supabase
          .from('payslips')
          .select('*, employees(full_name, branch, position)')
          .order('created_at', { ascending: false });
          
        if (error) throw error;
        setSalaryList(data || []);
      } else if (subTab === 'po') {
        // Fetch dari purchase_requests yang payment_status nya Lunas atau Sudah Dibayar
        const { data, error } = await supabase
          .from('purchase_requests')
          .select('*')
          .in('payment_status', ['Lunas', 'Sudah Dibayar'])
          .order('created_at', { ascending: false });
          
        if (error) throw error;
        setPoList(data || []);
      }
    } catch (err) {
      if (showToast) showToast('error', 'Gagal memuat data finance: ' + err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (subTab !== 'revenue') {
      fetchData();
    }
  }, [subTab]);

  return (
    <div className="space-y-4 animate-in fade-in duration-300 pb-12">
      {/* Header Finance Owner */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 shadow-xs transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
              <Banknote className="w-5 h-5 text-blue-600" />
              <span>Finance Overview</span>
            </h2>
            <p className="text-[10px] font-medium text-slate-500">Ringkasan Gaji &amp; Pembayaran PO</p>
          </div>
        </div>
        <button
          type="button"
          onClick={fetchData}
          disabled={loading || subTab === 'revenue'}
          className="p-2 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 transition cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Sub-tabs Navigasi */}
      <div className="flex bg-white rounded-2xl p-1.5 border border-slate-200 shadow-xs gap-1 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setSubTab('gaji')}
          className={`flex-1 min-w-[100px] py-2 px-3 text-[10px] font-bold rounded-xl transition flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
            subTab === 'gaji' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <UserCheck className="w-3.5 h-3.5" />
          Daftar Gaji
        </button>
        <button
          onClick={() => setSubTab('revenue')}
          className={`flex-1 min-w-[100px] py-2 px-3 text-[10px] font-bold rounded-xl transition flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
            subTab === 'revenue' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          Revenue
        </button>
        <button
          onClick={() => setSubTab('po')}
          className={`flex-1 min-w-[120px] py-2 px-3 text-[10px] font-bold rounded-xl transition flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
            subTab === 'po' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <ShoppingCart className="w-3.5 h-3.5" />
          Pembayaran PO
        </button>
      </div>

      {/* Konten Sub-tab */}
      <div className="bg-white rounded-3xl p-4 border border-slate-200 shadow-sm min-h-[300px]">
        {subTab === 'gaji' && (
          <div className="space-y-3">
            <h3 className="text-xs font-black text-slate-800 border-b border-slate-100 pb-2 mb-3">Daftar Gaji Karyawan Tersalurkan</h3>
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <RefreshCw className="w-6 h-6 text-slate-300 animate-spin" />
              </div>
            ) : salaryList.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-xs text-slate-500 font-medium">Belum ada riwayat penggajian.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {(() => {
                  const grouped = salaryList.reduce((acc, slip) => {
                    const p = slip.period || 'Periode Lainnya';
                    if (!acc[p]) acc[p] = [];
                    acc[p].push(slip);
                    return acc;
                  }, {});
                  
                  return Object.entries(grouped).map(([period, slips]) => {
                    const isExpanded = expandedPeriods[period] !== false; // default true
                    return (
                      <div key={period} className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setExpandedPeriods(prev => ({ ...prev, [period]: !isExpanded }))}
                          className="w-full px-4 py-3 bg-slate-50 flex items-center justify-between hover:bg-slate-100 transition cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center">
                              <Calendar className="w-4 h-4" />
                            </div>
                            <div className="text-left">
                              <h4 className="text-xs font-black text-slate-900">{period}</h4>
                              <p className="text-[10px] font-medium text-slate-500">{slips.length} Karyawan</p>
                            </div>
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          )}
                        </button>
                        
                        {isExpanded && (
                          <div className="p-3 bg-white space-y-2 border-t border-slate-100">
                            {slips.map((slip) => (
                              <div key={slip.id} className="flex items-center justify-between p-3 rounded-2xl border border-slate-100 bg-slate-50">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                                    {slip.employees?.full_name ? slip.employees.full_name.charAt(0).toUpperCase() : '?'}
                                  </div>
                                  <div>
                                    <p className="text-sm font-black text-slate-900">{slip.employees?.full_name || 'Tanpa Nama'}</p>
                                    <p className="text-[10px] text-slate-500 font-medium">{slip.employees?.branch || 'Pusat'}</p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs font-black text-emerald-600">{formatRupiah(slip.net_salary)}</p>
                                  <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-full font-bold mt-1 inline-block">Paid</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </div>
        )}

        {subTab === 'revenue' && (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 border border-slate-200">
              <TrendingUp className="w-8 h-8" />
            </div>
            <h3 className="text-sm font-black text-slate-800">Revenue Analytics</h3>
            <p className="text-xs text-slate-500 font-medium max-w-[200px]">(Coming Soon)<br/>Fitur ini sedang dimatangkan.</p>
          </div>
        )}

        {subTab === 'po' && (
          <div className="space-y-3">
            <h3 className="text-xs font-black text-slate-800 border-b border-slate-100 pb-2 mb-3">Daftar Pembayaran Supplier (PO Lunas)</h3>
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <RefreshCw className="w-6 h-6 text-slate-300 animate-spin" />
              </div>
            ) : poList.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-xs text-slate-500 font-medium">Belum ada PO yang lunas dibayarkan finance.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {poList.map((po) => (
                  <div key={po.id} className="flex items-center justify-between p-3 rounded-2xl border border-slate-100 bg-slate-50">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold shrink-0">
                        <ShoppingCart className="w-4 h-4" />
                      </div>
                      <div>
                        {/* Karena request level tidak menyimpan nama supplier secara langsung di schema yang ada, kita pakai Request ID / Outlet */}
                        <p className="text-sm font-black text-slate-900">PO: {po.outlet_name || 'Pusat'}</p>
                        <p className="text-[10px] text-slate-500 font-medium">Req By: {po.requested_by || '-'} &bull; {po.request_date}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black text-emerald-600">{formatRupiah(po.total_amount || 0)}</p>
                      <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-full font-bold mt-1 inline-block">Lunas</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
