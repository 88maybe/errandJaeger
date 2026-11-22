"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import type { Map as MlMap, Marker as MlMarker, StyleSpecification } from "maplibre-gl";
import { groupOf, type Found } from "@/lib/nearby/client";

// The map. MapLibre with a free, no-key vector style (OpenFreeMap). If that style can't load, plain OSM tiles.
// Stim mode on = a livelier, more colourful style and a pulsing ring; off = a calmer pale style and fades only.

const STYLE_CALM = "https://tiles.openfreemap.org/styles/positron";
const STYLE_LIVELY = "https://tiles.openfreemap.org/styles/liberty";
const RASTER: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};
const STYLE_TIMEOUT_MS = 8000;

type LatLng = { lat: number; lng: number };

type Props = {
  center: LatLng; // where the search happens
  user: LatLng | null; // your live blue dot (only when you pressed "Use my location")
  results: Found[];
  radiusM: number;
  stim: boolean;
  reducedMotion: boolean;
  searchKey: number; // goes up with each search, to replay the "wave"
  hitIds: string[];
  favIds: string[];
  onPick: (id: string) => void;
};

// A circle as a polygon, for the radius outline.
function circle(c: LatLng, r: number) {
  const pts: [number, number][] = [];
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * 2 * Math.PI;
    const dLat = (r / 111320) * Math.cos(a);
    const dLng = (r / (111320 * Math.cos((c.lat * Math.PI) / 180))) * Math.sin(a);
    pts.push([c.lng + dLng, c.lat + dLat]);
  }
  return { type: "Feature" as const, properties: {}, geometry: { type: "Polygon" as const, coordinates: [pts] } };
}

// How many screen pixels is r metres at this zoom? (MapLibre uses 512-pixel tiles.)
const metresToPx = (r: number, lat: number, zoom: number) => r / ((40075016.686 * Math.cos((lat * Math.PI) / 180)) / (512 * 2 ** zoom));

export default function MapView(props: Props) {
  const { center, user, results, radiusM, stim, reducedMotion, searchKey, hitIds, favIds, onPick } = props;
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const libRef = useRef<typeof import("maplibre-gl") | null>(null);
  const [ready, setReady] = useState(false);
  const [raster, setRaster] = useState(false); // true once we fell back to plain OSM tiles
  const [failed, setFailed] = useState(false); // the map couldn't start at all (no WebGL, for example)
  const markers = useRef<MlMarker[]>([]);
  const userMarker = useRef<MlMarker | null>(null);
  const pulse = useRef<{ marker: MlMarker; el: HTMLDivElement } | null>(null);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;
  const live = useRef({ center, radiusM });
  live.current = { center, radiusM };

  // Start the map once.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    (async () => {
      try {
        const ml = await import("maplibre-gl");
        if (cancelled || !box.current) return;
        ml.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
        libRef.current = ml;
        const map = new ml.Map({
          container: box.current,
          style: stim ? STYLE_LIVELY : STYLE_CALM,
          center: [center.lng, center.lat],
          zoom: 14,
          attributionControl: { compact: true },
          dragRotate: false,
          pitchWithRotate: false,
        });
        map.touchZoomRotate.disableRotation();
        mapRef.current = map;
        let loaded = false;
        const toRaster = () => {
          if (loaded || cancelled) return;
          loaded = true;
          setRaster(true);
          map.setStyle(RASTER);
        };
        timer = setTimeout(toRaster, STYLE_TIMEOUT_MS);
        map.on("error", () => {
          if (!loaded && !map.isStyleLoaded()) toRaster(); // the vector style failed before it loaded
        });
        map.on("load", () => {
          loaded = true;
          clearTimeout(timer);
        });
        // Every new style wipes our own layers, so add the radius outline again.
        map.on("style.load", () => {
          addRadiusLayer(map);
          if (!cancelled) setReady(true);
        });
        map.on("zoom", () => sizePulse());
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      markers.current.forEach((m) => m.remove());
      userMarker.current?.remove();
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addRadiusLayer(map: MlMap) {
    const { center: c, radiusM: r } = live.current;
    if (!map.getSource("radius")) map.addSource("radius", { type: "geojson", data: circle(c, r) });
    if (!map.getLayer("radius-fill")) map.addLayer({ id: "radius-fill", type: "fill", source: "radius", paint: { "fill-color": "#1f5f5b", "fill-opacity": 0.06 } });
    if (!map.getLayer("radius-line"))
      map.addLayer({ id: "radius-line", type: "line", source: "radius", paint: { "line-color": "#1f5f5b", "line-width": 2, "line-opacity": 0.5, "line-dasharray": [2, 2] } });
  }

  function sizePulse() {
    const map = mapRef.current;
    if (!map || !pulse.current) return;
    const px = metresToPx(live.current.radiusM, live.current.center.lat, map.getZoom()) * 2;
    const ring = pulse.current.el;
    ring.style.width = `${px}px`;
    ring.style.height = `${px}px`;
    ring.style.left = `${-px / 2}px`;
    ring.style.top = `${-px / 2}px`;
  }

  // Stim mode switches between the calm and the lively style (unless we are on the plain tiles).
  const firstStyle = useRef(true);
  useEffect(() => {
    if (firstStyle.current) {
      firstStyle.current = false;
      return;
    }
    if (!mapRef.current || raster) return;
    mapRef.current.setStyle(stim ? STYLE_LIVELY : STYLE_CALM);
  }, [stim, raster]);

  // Move to the search spot and redraw the radius outline.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const src = map.getSource("radius") as { setData?: (d: unknown) => void } | undefined;
    src?.setData?.(circle(center, radiusM));
    const dLat = radiusM / 111320;
    const dLng = radiusM / (111320 * Math.cos((center.lat * Math.PI) / 180));
    map.fitBounds(
      [
        [center.lng - dLng, center.lat - dLat],
        [center.lng + dLng, center.lat + dLat],
      ],
      { padding: 24, duration: reducedMotion ? 0 : stim ? 900 : 500 },
    );
  }, [center.lat, center.lng, radiusM, ready, reducedMotion, stim]);

  // Your live blue dot.
  useEffect(() => {
    const ml = libRef.current;
    const map = mapRef.current;
    if (!ml || !map || !ready) return;
    if (!user) {
      userMarker.current?.remove();
      userMarker.current = null;
      return;
    }
    if (!userMarker.current) {
      const el = document.createElement("div");
      el.className = "you-dot";
      el.setAttribute("role", "img");
      el.setAttribute("aria-label", "You are here");
      userMarker.current = new ml.Marker({ element: el }).setLngLat([user.lng, user.lat]).addTo(map);
    } else userMarker.current.setLngLat([user.lng, user.lat]);
  }, [user, ready]);

  // The result markers: they pop in as a wave going outward from the centre (fade only when Stim mode is off).
  useEffect(() => {
    const ml = libRef.current;
    const map = mapRef.current;
    if (!ml || !map || !ready) return;
    markers.current.forEach((m) => m.remove());
    markers.current = [];
    const far = Math.max(1, ...results.map((r) => r.distanceM));
    for (const r of results) {
      // MapLibre moves the outer element; our own pin shape and animation live on the inner button.
      const wrap = document.createElement("div");
      wrap.className = "pin-wrap";
      const el = document.createElement("button");
      el.type = "button";
      wrap.appendChild(el);
      const added = hitIds.includes(r.id);
      el.className = `pin pin-${groupOf(r)} ${stim ? "pin-pop" : "pin-fade"}${added ? " pin-added" : ""}${favIds.includes(r.id) ? " pin-fav" : ""}`;
      el.style.setProperty("--delay", `${reducedMotion ? 0 : Math.round((r.distanceM / far) * (stim ? 700 : 300))}ms`);
      el.setAttribute("aria-label", `${r.name}, about ${r.walkMin} min walk. ${added ? "On your hitlist." : "Tap to add to your hitlist."}`);
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        pickRef.current(r.id);
      });
      markers.current.push(new ml.Marker({ element: wrap, anchor: "bottom" }).setLngLat([r.lng, r.lat]).addTo(map));
    }
    // hitIds/favIds are handled by the cheaper effect below, so the wave doesn't replay on every tap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, searchKey, ready, stim, reducedMotion]);

  // Mark added / starred places without rebuilding the markers.
  useEffect(() => {
    markers.current.forEach((m, i) => {
      const r = results[i];
      if (!r) return;
      const el = m.getElement().firstElementChild as HTMLElement | null;
      if (!el) return;
      el.classList.toggle("pin-added", hitIds.includes(r.id));
      el.classList.toggle("pin-fav", favIds.includes(r.id));
      el.setAttribute("aria-label", `${r.name}, about ${r.walkMin} min walk. ${hitIds.includes(r.id) ? "On your hitlist." : "Tap to add to your hitlist."}`);
    });
  }, [hitIds, favIds, results]);

  // The pulsing ring around the search spot (Stim mode, when motion is OK).
  useEffect(() => {
    const ml = libRef.current;
    const map = mapRef.current;
    pulse.current?.marker.remove();
    pulse.current = null;
    if (!ml || !map || !ready || !stim || reducedMotion || searchKey === 0) return;
    const wrap = document.createElement("div");
    wrap.className = "pulse-wrap";
    wrap.setAttribute("aria-hidden", "true");
    const el = document.createElement("div");
    el.className = "pulse-ring";
    wrap.appendChild(el);
    pulse.current = { marker: new ml.Marker({ element: wrap }).setLngLat([center.lng, center.lat]).addTo(map), el };
    sizePulse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchKey, ready, stim, reducedMotion]);

  if (failed) {
    return (
      <div className="map-box map-failed" role="note">
        The map couldn&apos;t load on this device. You can still search and pick places below.
      </div>
    );
  }
  return (
    <div className="map-box">
      <div ref={box} className="map-canvas" aria-label="Map of places near you" role="region" />
      {raster && <span className="map-note">Simple map (the detailed one didn&apos;t load)</span>}
    </div>
  );
}
