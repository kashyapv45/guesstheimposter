"use client";
import { useEffect } from "react";

export function useWakeLock(active = true) {
  useEffect(() => {
    if (!active || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let released = false;

    const requestLock = async () => {
      try {
        if (!released && document.visibilityState === "visible") {
          lock = await navigator.wakeLock.request("screen");
        }
      } catch {}
    };

    void requestLock();

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void requestLock();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      released = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      lock?.release().catch(() => {});
    };
  }, [active]);
}
