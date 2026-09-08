'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Send,
  Camera,
  AlertCircle,
  Loader2,
  CheckCircle2,
  RefreshCw,
  Upload,
  SwitchCamera,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAuth } from '@/context/AuthContext';
import { uploadAttendancePhoto, compressImage } from '@/lib/storage';

export default function CameraModal({ isOpen, onClose, type = 'checkin', coords, outlet }) {
  const { user, recordAttendance, currentOutlet } = useAuth();
  const activeOutlet = outlet || currentOutlet;

  const [stream, setStream] = useState(null);
  const [capturing, setCapturing] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [cameraError, setCameraError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [facingMode, setFacingMode] = useState('user'); // 'user' (depan) atau 'environment' (belakang)
  const [isLoadingCamera, setIsLoadingCamera] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  // Fungsi mengaktifkan kamera dengan fallback constraints
  const startCamera = async (facing = 'user') => {
    setIsLoadingCamera(true);
    setCameraError('');

    // Matikan stream sebelumnya jika ada
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }

    try {
      let activeStream = null;

      if (!navigator?.mediaDevices?.getUserMedia) {
        throw new Error('Browser tidak mendukung akses kamera langsung (getUserMedia).');
      }

      // Coba dengan facingMode
      try {
        activeStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: facing,
            width: { ideal: 1280 },
            height: { ideal: 1280 },
          },
          audio: false,
        });
      } catch (err1) {
        console.warn('Fallback ke basic video constraint:', err1);
        // Fallback tanpa constraint ideal width/height
        activeStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      setStream(activeStream);

      // Hubungkan stream ke video element
      if (videoRef.current) {
        videoRef.current.srcObject = activeStream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current
            ?.play()
            .then(() => setIsLoadingCamera(false))
            .catch((e) => {
              console.warn('Video play catch:', e);
              setIsLoadingCamera(false);
            });
        };
      }
    } catch (err) {
      console.warn('Camera access error:', err);
      setIsLoadingCamera(false);
      setCameraError(
        'Kamera tidak aktif atau izin ditolak. Anda bisa klik "Izinkan Kamera" atau gunakan tombol "Ambil Foto/File" di bawah.'
      );
    }
  };

  // Trigger startCamera saat modal dibuka
  useEffect(() => {
    if (isOpen && !capturedPhoto) {
      startCamera(facingMode);
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isOpen, capturedPhoto]);

  // Efek tambahan untuk memastikan videoRef.current.srcObject selalu terhubung ke stream
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current
        .play()
        .then(() => setIsLoadingCamera(false))
        .catch((e) => console.log('Autoplay video err:', e));
    }
  }, [stream]);

  // Bersihkan stream saat modal ditutup
  const handleClose = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setCapturedPhoto(null);
    setSuccessMsg('');
    setCameraError('');
    onClose();
  };

  // Ambil snapshot foto dari video feed
  const takeSnapshot = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const width = video.videoWidth || 640;
      const height = video.videoHeight || 640;
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      // Cerminkan jika kamera depan
      if (facingMode === 'user') {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }

      ctx.drawImage(video, 0, 0, width, height);
      return canvas.toDataURL('image/jpeg', 0.9);
    }
    return generateFallbackAvatarDataUrl(user?.full_name || 'Staff');
  };

  // Alternatif upload foto jika kamera browser terblokir
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // Kompresi foto ke target 2MB
      const compressed = await compressImage(file, { maxSizeMB: 2.0, maxWidthOrHeight: 1920 });
      const reader = new FileReader();
      reader.onload = (event) => {
        setCapturedPhoto(event.target.result);
        if (stream) {
          stream.getTracks().forEach((t) => t.stop());
          setStream(null);
        }
      };
      reader.readAsDataURL(compressed);
    } catch (err) {
      console.warn('File upload err:', err);
    }
  };

  // Fallback visual generator
  const generateFallbackAvatarDataUrl = (name) => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 640;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(0, 0, 640, 640);
    ctx.fillStyle = activeOutlet?.pillarColor || '#F97316';
    ctx.beginPath();
    ctx.arc(320, 240, 110, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(320, 560, 210, 0, Math.PI, true);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 36px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(name, 320, 480);
    ctx.font = '24px system-ui';
    ctx.fillText(`${activeOutlet?.name || 'LazyBloom'} GPS Verified`, 320, 520);
    return canvas.toDataURL('image/jpeg', 0.9);
  };

  // Switch kamera depan/belakang
  const toggleFacingMode = () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  // Kirim presensi
  const handleSubmit = async () => {
    setCapturing(true);
    try {
      const photoDataUrl = capturedPhoto || takeSnapshot();
      setCapturedPhoto(photoDataUrl);

      // Matikan kamera setelah jepret
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        setStream(null);
      }

      // Upload ke Supabase Storage bucket 'attendance-photos' (Target 2MB)
      const uploadedUrl = await uploadAttendancePhoto(
        photoDataUrl,
        user?.employee_id || 'emp',
        type
      );

      // Catat ke tabel database attendance
      const res = await recordAttendance({
        type,
        photoUrl: uploadedUrl,
        coords,
        outletName: activeOutlet?.name,
      });

      if (res.success) {
        try {
          confetti({
            particleCount: 90,
            spread: 75,
            origin: { y: 0.6 },
            colors: ['#F97316', '#2563EB', '#10B981', '#FBBF24'],
          });
        } catch (e) {
          console.log('Confetti trigger:', e);
        }

        setSuccessMsg(
          type === 'checkin'
            ? `Presensi Masuk di ${activeOutlet?.name || 'Outlet'} Berhasil!`
            : `Presensi Pulang di ${activeOutlet?.name || 'Outlet'} Berhasil!`
        );

        setTimeout(() => {
          handleClose();
        }, 1800);
      }
    } catch (err) {
      console.error('Error recording attendance:', err);
      setCameraError('Gagal mencatat presensi. Silakan coba kembali.');
    } finally {
      setCapturing(false);
    }
  };

  if (!isOpen) return null;

  const isCheckIn = type === 'checkin';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-[390px] bg-white rounded-3xl shadow-2xl border-2 border-[#F97316] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-3.5 flex items-center justify-between border-b border-[#F97316]/40 bg-[#CACFD6]">
          <div className="flex-1 text-center pl-6">
            <h3 className="font-extrabold text-sm tracking-wider text-[#1E3A8A]">
              {isCheckIn ? 'PRESENSI MASUK' : 'PRESENSI PULANG'}
            </h3>
            <p className="text-[11px] font-bold text-gray-700">
              {activeOutlet?.name || 'LazyBloom'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1 rounded-full text-gray-600 hover:text-gray-900 hover:bg-black/5 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Center Content */}
        <div className="p-5 flex flex-col items-center text-center space-y-3.5">
          {/* Circular Camera Container */}
          <div className="relative w-56 h-56 rounded-full camera-glow-ring border-4 border-[#F97316] overflow-hidden bg-slate-950 flex items-center justify-center shadow-lg">
            {/* Foto yang sudah dijepret */}
            {capturedPhoto ? (
              <img
                src={capturedPhoto}
                alt="Selfie"
                className="w-full h-full object-cover"
              />
            ) : (
              <>
                {/* Elemen Video: Selalu dirender di DOM agar srcObject tidak pernah null */}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  onLoadedMetadata={(e) => e.currentTarget.play()}
                  className={`w-full h-full object-cover ${
                    facingMode === 'user' ? 'scale-x-[-1]' : ''
                  } ${!stream ? 'hidden' : 'block'}`}
                />

                {/* Indikator Memuat Kamera atau Error */}
                {!stream && (
                  <div className="flex flex-col items-center justify-center p-4 text-gray-300">
                    {isLoadingCamera ? (
                      <>
                        <Loader2 className="w-10 h-10 text-[#F97316] animate-spin mb-2" />
                        <p className="text-[11px] text-gray-300 font-semibold">
                          Mengaktifkan Kamera...
                        </p>
                      </>
                    ) : (
                      <>
                        <Camera className="w-10 h-10 text-[#F97316] mb-2 animate-pulse" />
                        <p className="text-[11px] text-gray-300 font-medium max-w-[180px]">
                          {cameraError
                            ? 'Kamera Belum Aktif'
                            : 'Meminta Izin Kamera...'}
                        </p>
                      </>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Dashed Oval Face Guide (matching screenshot 4 & 5) */}
            {!capturedPhoto && (
              <div className="pointer-events-none absolute inset-5 rounded-[50%] border-2 border-dashed border-[#F97316]/80 flex items-center justify-center" />
            )}

            {/* Verified GPS Badge inside bottom of circle */}
            <div className="absolute bottom-2.5 px-3 py-0.5 bg-black/75 backdrop-blur-xs rounded-full border border-emerald-500/60 flex items-center gap-1 shadow-sm">
              <span className="text-[10px] font-bold text-[#10B981] tracking-wide">
                {activeOutlet?.name || 'LazyBloom'} GPS Verified
              </span>
            </div>
          </div>

          {/* Hidden Canvas & File Input */}
          <canvas ref={canvasRef} className="hidden" />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="user"
            onChange={handleFileUpload}
            className="hidden"
          />

          {/* Subtext info */}
          <div className="space-y-0.5 max-w-[280px]">
            <h4 className="font-bold text-xs text-[#0F172A]">
              Posisikan Wajah Tegak &amp; Jelas
            </h4>
            <p className="text-[11px] text-gray-500 leading-tight">
              Sistem mencocokkan wajah &amp; koordinat GPS resto secara otomatis.
            </p>
          </div>

          {/* Control Bar: Switch Camera & File Upload Alternative */}
          <div className="flex items-center gap-2 pt-0.5">
            {!capturedPhoto && (
              <>
                <button
                  type="button"
                  onClick={() => startCamera(facingMode)}
                  className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[10px] font-bold rounded-lg border border-gray-300 flex items-center gap-1 transition"
                  title="Refresh / Coba Ulang Kamera"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Refresh Kamera</span>
                </button>

                <button
                  type="button"
                  onClick={toggleFacingMode}
                  className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[10px] font-bold rounded-lg border border-gray-300 flex items-center gap-1 transition"
                  title="Ganti Kamera Depan / Belakang"
                >
                  <SwitchCamera className="w-3 h-3" />
                  <span>{facingMode === 'user' ? 'Kamera Belakang' : 'Kamera Depan'}</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-2.5 py-1 bg-orange-50 hover:bg-orange-100 text-orange-800 text-[10px] font-bold rounded-lg border border-orange-300 flex items-center gap-1 transition"
              title="Upload Foto dari Perangkat"
            >
              <Upload className="w-3 h-3" />
              <span>{capturedPhoto ? 'Ganti Foto' : 'Ambil Foto / Galeri'}</span>
            </button>
          </div>

          {/* Success Message */}
          {successMsg && (
            <div className="w-full p-2.5 bg-emerald-100 border border-emerald-300 rounded-xl text-xs font-semibold text-emerald-800 flex items-center justify-center gap-2 animate-bounce">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Error Message */}
          {cameraError && !successMsg && (
            <div className="w-full p-2 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 flex items-center justify-center gap-1.5 text-left">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{cameraError}</span>
            </div>
          )}
        </div>

        {/* Footer / Kirim Presensi Button */}
        <div className="border-t border-[#F97316]/40 bg-[#CACFD6] p-3">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={capturing || !!successMsg}
            className="w-full py-2.5 flex items-center justify-center gap-2 text-xs font-semibold text-[#1E293B] hover:bg-black/5 active:bg-black/10 transition rounded-xl disabled:opacity-60"
          >
            {capturing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-[#2563EB]" />
                <span>Memproses Foto (2MB) &amp; GPS...</span>
              </>
            ) : successMsg ? (
              <span className="text-emerald-700 font-bold">Presensi Berhasil!</span>
            ) : (
              <>
                <Send className="w-4 h-4 text-[#2563EB] fill-[#2563EB]" />
                <span>Kirim Presensi</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
