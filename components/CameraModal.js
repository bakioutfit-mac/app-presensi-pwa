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
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAuth } from '@/context/AuthContext';
import { uploadAttendancePhoto } from '@/lib/storage';

export default function CameraModal({ isOpen, onClose, type = 'checkin', coords, outlet }) {
  const { user, recordAttendance, currentOutlet } = useAuth();
  const activeOutlet = outlet || currentOutlet;

  const [stream, setStream] = useState(null);
  const [capturing, setCapturing] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [cameraError, setCameraError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoadingCamera, setIsLoadingCamera] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Fungsi mengaktifkan kamera depan (hanya camera depan / selfie)
  const startCamera = async () => {
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

      // Selalu kunci hanya kamera depan (facingMode: 'user')
      try {
        activeStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 1280 },
          },
          audio: false,
        });
      } catch (err1) {
        console.warn('Fallback ke basic video constraint:', err1);
        activeStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
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
        'Kamera depan belum aktif atau izin ditolak. Silakan izinkan akses kamera lalu klik tombol "Refresh Kamera".'
      );
    }
  };

  // Trigger startCamera saat modal dibuka
  useEffect(() => {
    if (isOpen && !capturedPhoto) {
      startCamera();
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
    setCameraError('');
    setSuccessMsg('');
    onClose();
  };

  // Jepret foto dari video feed kamera depan
  const takeSnapshot = () => {
    if (!videoRef.current || !canvasRef.current) {
      return generateFallbackAvatarDataUrl(user?.full_name || 'Staf Presensi');
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const size = Math.min(video.videoWidth || 640, video.videoHeight || 640);

    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext('2d');
    const startX = (video.videoWidth - size) / 2;
    const startY = (video.videoHeight - size) / 2;

    // Mirroring kamera depan agar natural seperti cermin
    ctx.translate(size, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, startX, startY, size, size, 0, 0, size, size);

    return canvas.toDataURL('image/jpeg', 0.9);
  };

  // Fallback visual generator
  const generateFallbackAvatarDataUrl = (name) => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 640;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(0, 0, 640, 640);
    ctx.fillStyle = activeOutlet?.pillarColor || '#2563EB';
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
    ctx.fillText(`${activeOutlet?.name || 'Outlet'} GPS Verified`, 320, 520);
    return canvas.toDataURL('image/jpeg', 0.9);
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
        <div className="px-5 py-3.5 flex items-center justify-between border-b border-slate-200 bg-slate-50">
          <div className="flex-1 text-center pl-6">
            <h3 className="font-black text-sm tracking-wider text-slate-900">
              {isCheckIn ? 'PRESENSI MASUK' : 'PRESENSI PULANG'}
            </h3>
            <p className="text-[11px] font-bold text-[#2563EB]">
              {activeOutlet?.name || 'LazyBloom'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Center Content */}
        <div className="p-5 flex flex-col items-center text-center space-y-3.5">
          {/* Circular Camera Container (Kamera Depan Only) */}
          <div className="relative w-56 h-56 rounded-full camera-glow-ring border-4 border-[#2563EB] overflow-hidden bg-slate-950 flex items-center justify-center shadow-lg">
            {/* Foto yang sudah dijepret */}
            {capturedPhoto ? (
              <img
                src={capturedPhoto}
                alt="Selfie"
                className="w-full h-full object-cover"
              />
            ) : (
              <>
                {/* Elemen Video: Selalu cermin / mirror kamera depan */}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  onLoadedMetadata={(e) => e.currentTarget.play()}
                  className={`w-full h-full object-cover scale-x-[-1] ${!stream ? 'hidden' : 'block'}`}
                />

                {/* Indikator Memuat Kamera atau Error */}
                {!stream && (
                  <div className="flex flex-col items-center justify-center p-4 text-gray-300">
                    {isLoadingCamera ? (
                      <>
                        <Loader2 className="w-10 h-10 text-[#2563EB] animate-spin mb-2" />
                        <p className="text-[11px] text-gray-300 font-semibold">
                          Mengaktifkan Kamera Depan...
                        </p>
                      </>
                    ) : (
                      <>
                        <Camera className="w-10 h-10 text-[#2563EB] mb-2 animate-pulse" />
                        <p className="text-[11px] text-gray-300 font-medium max-w-[180px]">
                          {cameraError
                            ? 'Kamera Belum Aktif'
                            : 'Meminta Izin Kamera Depan...'}
                        </p>
                      </>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Dashed Oval Face Guide */}
            {!capturedPhoto && (
              <div className="pointer-events-none absolute inset-5 rounded-[50%] border-2 border-dashed border-[#2563EB]/80 flex items-center justify-center" />
            )}

            {/* Verified GPS Badge inside bottom of circle */}
            <div className="absolute bottom-2.5 px-3 py-0.5 bg-black/75 backdrop-blur-xs rounded-full border border-emerald-500/60 flex items-center gap-1 shadow-sm">
              <span className="text-[10px] font-bold text-[#10B981] tracking-wide">
                {activeOutlet?.name || 'LazyBloom'} GPS Verified
              </span>
            </div>
          </div>

          {/* Hidden Canvas */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Subtext info */}
          <div className="space-y-0.5 max-w-[280px]">
            <h4 className="font-bold text-xs text-[#0F172A]">
              Posisikan Wajah Tegak &amp; Jelas
            </h4>
            <p className="text-[11px] text-gray-500 leading-tight">
              Kamera depan memvalidasi wajah &amp; koordinat GPS resto secara otomatis.
            </p>
          </div>

          {/* Control Bar: HANYA Tombol Refresh Kamera */}
          <div className="flex items-center justify-center gap-2 pt-0.5">
            {!capturedPhoto && (
              <button
                type="button"
                onClick={() => startCamera()}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold rounded-xl border border-slate-300 flex items-center gap-1.5 transition shadow-xs"
                title="Refresh / Coba Ulang Kamera Depan"
              >
                <RefreshCw className="w-3.5 h-3.5 text-[#2563EB]" />
                <span>Refresh Kamera</span>
              </button>
            )}
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
            <div className="w-full p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 flex items-center justify-center gap-1.5 text-left">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{cameraError}</span>
            </div>
          )}
        </div>

        {/* Footer / Kirim Presensi Button */}
        <div className="border-t border-slate-200 bg-slate-50 p-3.5">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={capturing || !!successMsg}
            className="w-full py-2.5 flex items-center justify-center gap-2 text-xs font-black text-white bg-[#2563EB] hover:bg-[#1D4ED8] active:scale-98 transition rounded-xl shadow-xs disabled:opacity-60"
          >
            {capturing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Memproses Foto &amp; GPS...</span>
              </>
            ) : successMsg ? (
              <span className="text-white font-bold">Presensi Berhasil!</span>
            ) : (
              <>
                <Send className="w-4 h-4 text-white fill-white" />
                <span>Kirim Presensi</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
