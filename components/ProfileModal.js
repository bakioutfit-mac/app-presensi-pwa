'use client';

import React, { useState, useRef } from 'react';
import { Settings, X, ArrowDownToLine, User, Camera, Check, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { uploadAttendancePhoto } from '@/lib/storage';

export default function ProfileModal({ isOpen, onClose }) {
  const { user, updateProfile, userOutlet, logout } = useAuth();
  const [phone, setPhone] = useState(user?.phone || '');
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [saving, setSaving] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar_url || null);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    setAvatarPreview(previewUrl);

    try {
      const uploadedUrl = await uploadAttendancePhoto(file, user?.employee_id || 'emp', 'avatar');
      setAvatarPreview(uploadedUrl);
      const res = await updateProfile({ avatar_url: uploadedUrl });
      if (res.success) {
        setMessage({ type: 'success', text: 'Foto profil berhasil diperbarui! Mengalihkan ke menu login...' });
        setTimeout(() => {
          onClose();
          logout();
        }, 1600);
      } else {
        setMessage({ type: 'error', text: res.error || 'Gagal menyimpan foto profil.' });
      }
    } catch (err) {
      console.warn('Avatar upload error:', err);
      setMessage({ type: 'error', text: 'Gagal mengupload foto profil.' });
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    if (newPin && newPin.length !== 6) {
      setMessage({ type: 'error', text: 'PIN baru harus 6 digit angka.' });
      return;
    }

    if (newPin && !oldPin) {
      setMessage({ type: 'error', text: 'Masukkan PIN lama untuk mengubah PIN.' });
      return;
    }

    setSaving(true);
    const res = await updateProfile({
      newPhone: phone,
      oldPin: oldPin || undefined,
      newPin: newPin || undefined,
    });
    setSaving(false);

    if (res.success) {
      setMessage({ type: 'success', text: 'Perubahan berhasil disimpan! Mengalihkan ke menu login...' });
      setOldPin('');
      setNewPin('');
      setTimeout(() => {
        onClose();
        logout();
      }, 1600);
    } else {
      setMessage({ type: 'error', text: res.error || 'Gagal menyimpan perubahan.' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-[390px] bg-[#CACFD6] rounded-3xl shadow-2xl border-2 border-[#F97316] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 flex items-center justify-between border-b border-[#F97316]/50 bg-[#E5E7EB]/90">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-[#2563EB]" />
            <h3 className="font-extrabold text-sm tracking-wider text-[#2563EB]">
              PROFILE SETTING
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-gray-500 hover:text-gray-800 hover:bg-black/5 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-4 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* User Info Card */}
          <div className="bg-[#B4BAC3] rounded-2xl p-3.5 flex gap-3 border border-white/40 shadow-xs">
            {/* Avatar block */}
            <div className="flex flex-col items-center gap-1.5 shrink-0">
              <div className="w-20 h-20 rounded-2xl bg-[#9CA3AF] flex items-center justify-center overflow-hidden border border-white/60 shadow-sm relative">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt={user?.full_name || 'Staff'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-12 h-12 text-white/90" />
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="bg-[#EA580C] hover:bg-[#C2410C] active:scale-95 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-md shadow-xs transition"
              >
                Edit Foto
              </button>
            </div>

            {/* Info details */}
            <div className="flex-1 min-w-0 text-left text-xs text-gray-800 space-y-0.5">
              <h4 className="font-bold text-sm text-[#1E293B] truncate">
                {user?.full_name || 'Fikril Bay'}
              </h4>
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="font-semibold text-gray-700">
                  ID : {user?.employee_id || 'LZY_0021'}
                </p>
                <span
                  className={`text-[9px] font-extrabold px-2 py-0.2 rounded-full ${
                    userOutlet?.badgeBg || 'bg-orange-500'
                  } text-white shadow-xs`}
                >
                  {userOutlet?.name || user?.branch || 'LazyBloom'}
                </span>
              </div>
              <p className="text-[11px] text-gray-600">
                {user?.birth_date || '21 November 1998'}
              </p>
              <p className="text-[11px] text-gray-600 line-clamp-2 leading-tight">
                {user?.address || 'Jl. Ir Moh Hatta, Candiareng Perumahan candi wanamas'}
              </p>
              <p className="text-[11px] font-medium text-gray-700">
                {user?.phone || '085775560400'}
              </p>
            </div>
          </div>

          {/* Alert Message */}
          {message.text && (
            <div
              className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                message.type === 'success'
                  ? 'bg-emerald-100 border border-emerald-300 text-emerald-800'
                  : 'bg-red-100 border border-red-300 text-red-800'
              }`}
            >
              {message.type === 'success' ? (
                <Check className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{message.text}</span>
            </div>
          )}

          {/* Form Ubah PIN & No HP */}
          <form onSubmit={handleSave} className="space-y-3 pt-1">
            <h4 className="font-bold text-xs text-[#2563EB] tracking-wider text-center">
              UBAH PIN & NO. HP
            </h4>

            {/* Ubah No HP */}
            <div>
              <label className="block text-[11px] font-semibold text-[#2563EB] mb-1 ml-1">
                Ubah No. Hp
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Misal : 085775560400"
                className="w-full bg-white rounded-full px-3.5 py-2 text-xs text-gray-800 placeholder-gray-400 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/50 shadow-inner"
              />
            </div>

            {/* Ubah PIN (PIN Lama) */}
            <div>
              <label className="block text-[11px] font-semibold text-[#2563EB] mb-1 ml-1">
                Ubah PIN (Masukan pin lama)
              </label>
              <input
                type="password"
                maxLength={6}
                value={oldPin}
                onChange={(e) => setOldPin(e.target.value.replace(/\D/g, ''))}
                placeholder="* * * * * *"
                className="w-full bg-white rounded-full px-3.5 py-2 text-xs tracking-widest text-gray-800 placeholder-gray-400 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/50 shadow-inner"
              />
            </div>

            {/* Masukan PIN Baru */}
            <div>
              <label className="block text-[11px] font-semibold text-[#2563EB] mb-1 ml-1">
                Masukan PIN Baru
              </label>
              <input
                type="password"
                maxLength={6}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                placeholder="* * * * * *"
                className="w-full bg-white rounded-full px-3.5 py-2 text-xs tracking-widest text-gray-800 placeholder-gray-400 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/50 shadow-inner"
              />
            </div>

            {/* Footer / Submit Button */}
            <div className="pt-3 -mx-4 -mb-4 border-t border-[#F97316]/50 bg-[#B8BFC8]">
              <button
                type="submit"
                disabled={saving}
                className="w-full py-3 flex flex-col items-center justify-center text-xs font-semibold text-gray-800 hover:bg-black/5 active:bg-black/10 transition"
              >
                <div className="w-7 h-7 rounded-full bg-[#2563EB] text-white flex items-center justify-center shadow-sm mb-1">
                  <ArrowDownToLine className="w-4 h-4" />
                </div>
                <span>{saving ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
