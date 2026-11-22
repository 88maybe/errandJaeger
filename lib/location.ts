// Remembers, for this browser tab only, that you turned on "Use my location" (never the location itself).
// Other screens then follow your location without asking again.
const KEY = "errandjaeger:location-on";

export function setLocationOn(on: boolean): void {
  try {
    if (on) window.sessionStorage.setItem(KEY, "1");
    else window.sessionStorage.removeItem(KEY);
  } catch {
    // blocked storage: screens just won't follow your location
  }
}

export function isLocationOn(): boolean {
  try {
    return window.sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}
