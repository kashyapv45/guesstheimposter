"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

// While `active`, the phone/browser back button calls `onBack` (e.g. "Leave the game?") instead of
// leaving the page. Works by adding one extra history entry and re-adding it when back is pressed.
// The entry copies Next's own history state so the router keeps working.
export function useBackGuard(active: boolean, onBack: () => void) {
  const router = useRouter();
  const cb = useRef(onBack);
  const listening = useRef(false);
  useEffect(() => {
    cb.current = onBack;
  }, [onBack]);

  const onPop = useCallback(() => {
    history.pushState({ ...history.state, backGuard: true }, "");
    cb.current();
  }, []);

  useEffect(() => {
    if (!active) return;
    history.pushState({ ...history.state, backGuard: true }, "");
    window.addEventListener("popstate", onPop);
    listening.current = true;
    return () => {
      if (!listening.current) return;
      window.removeEventListener("popstate", onPop);
      listening.current = false;
      if (history.state?.backGuard) history.back(); // drop our extra entry if we're still on it
    };
  }, [active, onPop]);

  // Confirmed leave: stop guarding, then go.
  return useCallback(
    (href: string) => {
      window.removeEventListener("popstate", onPop);
      listening.current = false;
      router.replace(href);
    },
    [onPop, router],
  );
}
