"use client";
import jsQR from "jsqr";
import { useEffect, useRef, useState } from "react";

// Camera QR reader (works on iOS Safari too, unlike BarcodeDetector) with a paste fallback.
export function QrScanner({ onResult }: { onResult: (text: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const cb = useRef(onResult);
  const [error, setError] = useState(() => ("getUserMedia" in (navigator.mediaDevices ?? {}) ? "" : "No camera here. Paste the code instead."));
  const [paste, setPaste] = useState("");

  useEffect(() => {
    cb.current = onResult;
  }, [onResult]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    const canvas = document.createElement("canvas");
    const g = canvas.getContext("2d", { willReadFrequently: true });
    if (!navigator.mediaDevices?.getUserMedia) return;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((s) => {
        if (stopped) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        const v = video.current!;
        v.srcObject = s;
        void v.play();
        const tick = () => {
          if (stopped) return;
          if (v.readyState >= 2 && g && v.videoWidth) {
            canvas.width = v.videoWidth;
            canvas.height = v.videoHeight;
            g.drawImage(v, 0, 0);
            const img = g.getImageData(0, 0, canvas.width, canvas.height);
            const hit = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
            if (hit?.data) return cb.current(hit.data);
          }
          raf = requestAnimationFrame(tick);
        };
        tick();
      })
      .catch(() => setError("Camera blocked. Allow camera access, or paste the code."));
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="space-y-2">
      {error ? <p className="text-sm text-orange">{error}</p> : <video ref={video} playsInline muted className="aspect-square w-full rounded-lg border-2 border-charcoal bg-charcoal object-cover" />}
      <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={2} placeholder="…or paste the code" aria-label="Paste code" className="w-full rounded-lg border-2 border-charcoal bg-cream px-3 py-2 font-mono text-xs" />
      <button disabled={!paste.trim()} onClick={() => onResult(paste.trim())} className="w-full rounded-lg border-2 border-charcoal bg-charcoal py-2 font-bold text-cream disabled:opacity-40">
        Use pasted code
      </button>
    </div>
  );
}
