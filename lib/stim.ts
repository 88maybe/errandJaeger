// Stim mode changes the look of the whole app (brighter accents, livelier motion). This sets it on <html>.
export function applyStim(on: boolean): void {
  if (typeof document !== "undefined") document.documentElement.dataset.stim = on ? "on" : "off";
}
