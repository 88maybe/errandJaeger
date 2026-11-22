// Light / Dark / Auto, remembered in this browser. Default: Light.
export type ThemeChoice = "light" | "dark" | "auto";
export const THEME_KEY = "errandjaeger:v1:theme";

export function getTheme(): ThemeChoice {
  try {
    const t = window.localStorage.getItem(THEME_KEY);
    return t === "dark" || t === "auto" ? t : "light";
  } catch {
    return "light";
  }
}

export function resolveTheme(choice: ThemeChoice): "light" | "dark" {
  if (choice !== "auto") return choice;
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(choice: ThemeChoice): void {
  document.documentElement.dataset.theme = resolveTheme(choice);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", resolveTheme(choice) === "dark" ? "#161514" : "#fbf6ee");
}

export function setTheme(choice: ThemeChoice): void {
  try {
    window.localStorage.setItem(THEME_KEY, choice);
  } catch {
    // storage blocked: the choice lasts until the page closes
  }
  applyTheme(choice);
  window.dispatchEvent(new Event("ej-theme"));
}

// Runs in <head> before the first paint, so the page never flashes the wrong theme or Stim colours.
export const BEFORE_PAINT_SCRIPT = `(function(){try{var d=document.documentElement;var t=localStorage.getItem("${THEME_KEY}");if(t==="auto"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}d.setAttribute("data-theme",t==="dark"?"dark":"light");var p=JSON.parse(localStorage.getItem("errandjaeger:v1:prefs")||"{}");d.setAttribute("data-stim",p&&p.stim?"on":"off")}catch(e){}})()`;
