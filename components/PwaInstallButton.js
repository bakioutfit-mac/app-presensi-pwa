"use client";

import React, { useState, useEffect } from "react";
import { Download, Share2, PlusSquare, X, Smartphone } from "lucide-react";

export default function PwaInstallButton({ className = "" }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Check if already running in standalone PWA mode
    const standaloneMode =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;
    setIsStandalone(standaloneMode);

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isAppleDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(isAppleDevice);

    const handleBeforeInstallPrompt = (e) => {
      // Prevent browser's default mini-infobar
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    const handleAppInstalled = () => {
      setIsStandalone(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  if (!mounted || isStandalone) {
    return null;
  }

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === "accepted") {
        setDeferredPrompt(null);
      }
    } else if (isIos) {
      setShowIosGuide(true);
    } else {
      // General guidance for browsers where prompt didn't fire
      setShowIosGuide(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleInstallClick}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100/90 hover:bg-slate-200/90 text-slate-600 hover:text-slate-800 text-xs font-medium border border-slate-200/80 transition-all duration-150 cursor-pointer shadow-2xs active:scale-95 ${className}`}
        title="Instal aplikasi ini ke perangkat Anda"
      >
        <Download className="w-3.5 h-3.5 text-slate-500" />
        <span>Instal PWA</span>
      </button>

      {/* Guide Dialog for iOS or Manual Installation */}
      {showIosGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-xs w-full p-5 shadow-xl border border-slate-100 text-slate-800 relative">
            <button
              onClick={() => setShowIosGuide(false)}
              className="absolute top-3.5 right-3.5 p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-xl bg-orange-50 text-[#F97316]">
                <Smartphone className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">Pasang Aplikasi</h3>
            </div>

            <p className="text-xs text-slate-500 mb-3 leading-relaxed">
              Jadikan aplikasi lebih cepat dibuka langsung dari layar utama HP Anda:
            </p>

            <ol className="text-xs text-slate-600 space-y-2 mb-4">
              <li className="flex items-start gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                <span className="font-bold text-slate-400 shrink-0">1.</span>
                <span className="leading-tight">
                  Ketuk tombol <strong>Bagikan (Share)</strong> <Share2 className="w-3.5 h-3.5 inline text-blue-500 mx-0.5" /> di bilah browser Safari / Chrome.
                </span>
              </li>
              <li className="flex items-start gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                <span className="font-bold text-slate-400 shrink-0">2.</span>
                <span className="leading-tight">
                  Pilih menu <strong>"Tambah ke Layar Utama" (Add to Home Screen)</strong> <PlusSquare className="w-3.5 h-3.5 inline text-slate-700 mx-0.5" />.
                </span>
              </li>
            </ol>

            <button
              type="button"
              onClick={() => setShowIosGuide(false)}
              className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              Mengerti
            </button>
          </div>
        </div>
      )}
    </>
  );
}
