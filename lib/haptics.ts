// Mobile vibration helpers (navigator.vibrate)

export function vibrate(pattern: number | number[]) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {}
  }
}

export const hapticTap = () => vibrate(18);
export const hapticConfirm = () => vibrate([20, 40, 20]);
export const hapticUrgent = () => vibrate(30);
export const hapticReveal = (isAlert: boolean) =>
  isAlert ? vibrate([40, 60, 40, 60, 80]) : vibrate(35);
export const hapticEnd = () => vibrate([60, 80, 100]);
