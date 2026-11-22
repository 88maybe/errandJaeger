// Copies MapLibre's map worker into public/ so the browser can load it from our own site.
// (The bundler can't find it next to the bundled map code.) Runs before dev and build.
import { copyFileSync, mkdirSync } from "node:fs";

mkdirSync("public/maplibre", { recursive: true });
copyFileSync("node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs", "public/maplibre/maplibre-gl-worker.mjs");
