(() => {
const C = window.CONFIG || {};
const REGION = C.REGION || "us-east-1";
const KEY = C.API_KEY || "";
const WHATS = (C.WHATSAPP || "").replace(/\D/g, "");
const CENTER = C.CENTER || [-50.1633, -25.0945];

// Categorias do OpenStreetMap (tag "leisure") e uma sugestão de treino genérica para cada uma.
const CATS = {
  fitness_station: { n: "Academia ao ar livre", c: "#FF6B2C", t: "Circuito de barras, paralelas e abdominal: 3 voltas de 8 a 12 repetições." },
  pitch:           { n: "Quadra ou campo",      c: "#2E9CFF", t: "Aquecimento de 10 min, tiros curtos de 20 a 30 m e jogo de 20 min." },
  track:           { n: "Pista",                c: "#B65CFF", t: "6 tiros de 400 m com 1 min de descanso e 10 min de caminhada." },
  sports_centre:   { n: "Centro esportivo",     c: "#22C7A9", t: "Treino de força e alongamento, conforme os equipamentos do local." },
  park:            { n: "Parque",               c: "#6BCB3D", t: "Corrida leve de 25 a 30 min e alongamento no final." },
  playground:      { n: "Parquinho",            c: "#FFC02E", t: "Circuito funcional leve com barras e degraus: 3 voltas." }
};
const SPORTS = { soccer: "Futebol", futsal: "Futsal", basketball: "Basquete", volleyball: "Vôlei", tennis: "Tênis",
  running: "Corrida", athletics: "Atletismo", skateboard: "Skate", handball: "Handebol", beachvolleyball: "Vôlei de praia",
  multi: "Vários esportes", fitness: "Funcional", calisthenics: "Calistenia", swimming: "Natação" };

const $ = (s) => document.querySelector(s);
const state = { all: [], on: new Set(Object.keys(CATS)), q: "", origin: CENTER.slice(), label: "Centro da cidade (padrão)", sel: null, picking: false, routeId: 0 };

// ---------- mapa ----------
const BLANK = { version: 8, sources: {}, layers: [{ id: "bg", type: "background", paint: { "background-color": "#dfe5ee" } }] };
const style = KEY ? `https://maps.geo.${REGION}.amazonaws.com/v2/styles/Standard/descriptor?key=${KEY}&color-scheme=Light` : BLANK;
const map = new maplibregl.Map({ container: "map", style, center: CENTER, zoom: 12, attributionControl: { compact: true } });
map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

function banner(msg) { const b = $("#banner"); b.textContent = msg; b.hidden = false; }
if (!KEY) banner("Mapa base indisponível: falta a chave do Amazon Location em config.js. Os pontos aparecem, mas sem o desenho das ruas.");
let warned = false;
map.on("error", (e) => {
  if (!KEY || warned) return;
  const s = e && e.error && e.error.status;
  if (s === 401 || s === 403) { warned = true; banner("O Amazon Location recusou a chave (erro " + s + "). Verifique as permissões e a data de expiração."); }
});

const meEl = document.createElement("div"); meEl.className = "me";
const meMarker = new maplibregl.Marker({ element: meEl }).setLngLat(state.origin).addTo(map);

// ---------- dados ----------
function centerOf(g) {
  if (!g) return null;
  const mean = (pts) => { const n = pts.length; return [pts.reduce((a, p) => a + p[0], 0) / n, pts.reduce((a, p) => a + p[1], 0) / n]; };
  switch (g.type) {
    case "Point": return g.coordinates;
    case "LineString": return mean(g.coordinates);
    case "Polygon": return mean(g.coordinates[0]);
    case "MultiPolygon": return mean(g.coordinates[0][0]);
    case "MultiLineString": return mean(g.coordinates[0]);
    default: return null;
  }
}
async function loadData() {
  const g = await (await fetch("pontos.geojson")).json();
  const seen = new Set();
  (g.features || []).forEach((f) => {
    const p = f.properties || {};
    const cat = p.leisure;
    const c = centerOf(f.geometry);
    if (!CATS[cat] || !c) return;
    const k = cat + c[0].toFixed(5) + c[1].toFixed(5);
    if (seen.has(k)) return; seen.add(k);
    state.all.push({ id: state.all.length, cat, name: p.name || "", sport: p.sport || "", lng: c[0], lat: c[1] });
  });
}
function filtered() {
  const q = state.q.trim().toLowerCase();
  return state.all.filter((d) => state.on.has(d.cat) && (!q || d.name.toLowerCase().includes(q)));
}
function km(a, b) {
  const R = 6371, r = Math.PI / 180;
  const dLat = (b[1] - a[1]) * r, dLng = (b[0] - a[0]) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
const fmtKm = (k) => (k < 1 ? Math.round(k * 1000) + " m" : k.toFixed(1).replace(".", ",") + " km");
const fmtMin = (s) => { const m = Math.max(1, Math.round(s / 60)); return m < 60 ? m + " min" : Math.floor(m / 60) + " h " + (m % 60) + " min"; };
const title = (d) => d.name || "Sem nome (" + CATS[d.cat].n.toLowerCase() + ")";

// ---------- camadas ----------
const colorExpr = ["match", ["get", "cat"]];
Object.entries(CATS).forEach(([k, v]) => colorExpr.push(k, v.c)); colorExpr.push("#888");
const toGeo = (arr) => ({ type: "FeatureCollection", features: arr.map((d) => ({ type: "Feature", geometry: { type: "Point", coordinates: [d.lng, d.lat] }, properties: { id: d.id, cat: d.cat } })) });

let markers = {}, onScreen = {};
function clearMarkers() { Object.values(onScreen).forEach((m) => m.remove()); markers = {}; onScreen = {}; }
function updateMarkers() {
  const feats = map.querySourceFeatures("pts", { filter: ["has", "point_count"] });
  const seen = {};
  feats.forEach((f) => {
    const id = f.properties.cluster_id; if (seen[id]) return; seen[id] = true;
    let m = markers[id];
    if (!m) {
      const el = document.createElement("button"); el.className = "cl"; el.textContent = f.properties.point_count;
      el.setAttribute("aria-label", f.properties.point_count + " lugares, aproximar");
      const coords = f.geometry.coordinates.slice();
      el.onclick = () => map.getSource("pts").getClusterExpansionZoom(id).then((z) => map.easeTo({ center: coords, zoom: z + 0.3 }));
      m = markers[id] = new maplibregl.Marker({ element: el }).setLngLat(coords);
    }
    if (!onScreen[id]) m.addTo(map);
  });
  Object.keys(onScreen).forEach((id) => { if (!seen[id]) onScreen[id].remove(); });
  onScreen = {}; Object.keys(seen).forEach((id) => { onScreen[id] = markers[id]; });
}

function refresh() {
  const arr = filtered();
  const src = map.getSource("pts");
  if (src) { clearMarkers(); src.setData(toGeo(arr)); }
  renderChips(); renderList(arr);
}

map.on("load", () => {
  map.addSource("pts", { type: "geojson", data: toGeo(filtered()), cluster: true, clusterRadius: 48, clusterMaxZoom: 15 });
  map.addSource("route", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  map.addSource("sel", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  map.addLayer({ id: "route-case", type: "line", source: "route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#fff", "line-width": 9 } });
  map.addLayer({ id: "route", type: "line", source: "route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#FF6B2C", "line-width": 5 } });
  map.addLayer({ id: "pt", type: "circle", source: "pts", filter: ["!", ["has", "point_count"]], paint: { "circle-radius": 8, "circle-color": colorExpr, "circle-stroke-width": 2.5, "circle-stroke-color": "#fff" } });
  map.addLayer({ id: "sel", type: "circle", source: "sel", paint: { "circle-radius": 13, "circle-color": "rgba(0,0,0,0)", "circle-stroke-width": 3, "circle-stroke-color": "#111" } });
  map.on("click", "pt", (e) => select(e.features[0].properties.id, false));
  map.on("mouseenter", "pt", () => (map.getCanvas().style.cursor = "pointer"));
  map.on("mouseleave", "pt", () => (map.getCanvas().style.cursor = ""));
  map.on("render", () => { if (map.isSourceLoaded("pts")) updateMarkers(); });
  fitAll();
});
function fitAll() {
  const arr = filtered(); if (!arr.length) return;
  const b = new maplibregl.LngLatBounds();
  arr.forEach((d) => b.extend([d.lng, d.lat]));
  map.fitBounds(b, { padding: 50, maxZoom: 14, duration: 0 });
}

// ---------- interface ----------
function renderChips() {
  const cnt = {}; state.all.forEach((d) => { cnt[d.cat] = (cnt[d.cat] || 0) + 1; });
  const box = $("#chips"); box.innerHTML = "";
  Object.entries(CATS).forEach(([k, v]) => {
    if (!cnt[k]) return;
    const b = document.createElement("button"); b.type = "button"; b.className = "chip"; b.style.setProperty("--c", v.c);
    b.setAttribute("aria-pressed", state.on.has(k));
    b.innerHTML = "<i></i>" + v.n + " <small>" + cnt[k] + "</small>";
    b.onclick = () => { state.on.has(k) ? state.on.delete(k) : state.on.add(k); refresh(); };
    box.appendChild(b);
  });
}
function renderList(arr) {
  $("#count").textContent = "(" + arr.length + ")";
  const items = arr.map((d) => ({ d, k: km(state.origin, [d.lng, d.lat]) })).sort((a, b) => a.k - b.k).slice(0, 60);
  const ul = $("#list"); ul.innerHTML = "";
  items.forEach(({ d, k }) => {
    const li = document.createElement("li"), b = document.createElement("button");
    b.type = "button"; b.style.setProperty("--c", CATS[d.cat].c);
    if (state.sel === d.id) b.setAttribute("aria-current", "true");
    const i = document.createElement("i"), s = document.createElement("span"), em = document.createElement("em");
    s.textContent = title(d); const sm = document.createElement("small"); sm.textContent = CATS[d.cat].n; s.appendChild(sm);
    em.textContent = fmtKm(k);
    b.append(i, s, em); b.onclick = () => select(d.id, true);
    li.appendChild(b); ul.appendChild(li);
  });
  if (!items.length) ul.innerHTML = '<li class="hint" style="color:#9AA3B2">Nenhum lugar com esses filtros.</li>';
}

async function routeTo(o, d) {
  const straight = () => { const k = km(o, d); return { coords: [o, d], dist: k * 1000, dur: (k * 1000) / 1.25, aws: false }; };
  if (!KEY) return straight();
  try {
    const r = await fetch(`https://routes.geo.${REGION}.amazonaws.com/v2/routes?key=${KEY}`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ Origin: o, Destination: d, TravelMode: "Pedestrian", LegGeometryFormat: "Simple" })
    });
    if (!r.ok) return straight();
    const j = await r.json(); const rt = j.Routes && j.Routes[0]; if (!rt) return straight();
    const coords = rt.Legs.flatMap((l) => (l.Geometry && l.Geometry.LineString) || []);
    if (coords.length < 2) return straight();
    const sum = rt.Legs.map((l) => l.PedestrianLegDetails && l.PedestrianLegDetails.Summary && l.PedestrianLegDetails.Summary.Overview);
    const real = sum.every((s) => s && s.Distance != null && s.Duration != null);
    let dist = real ? sum.reduce((a, s) => a + s.Distance, 0) : null;
    if (dist == null) { dist = 0; for (let i = 1; i < coords.length; i++) dist += km(coords[i - 1], coords[i]) * 1000; }
    const dur = real ? sum.reduce((a, s) => a + s.Duration, 0) : dist / 1.25;
    return { coords, dist, dur, aws: true };
  } catch (e) { return straight(); }
}

async function select(id, fly) {
  const d = state.all[id]; if (!d) return;
  state.sel = id; const my = ++state.routeId;
  map.getSource("sel") && map.getSource("sel").setData({ type: "Feature", geometry: { type: "Point", coordinates: [d.lng, d.lat] } });
  const cat = CATS[d.cat], card = $("#card"); card.hidden = false;
  const sport = d.sport ? d.sport.split(";").map((s) => SPORTS[s] || s).join(", ") : "";
  card.innerHTML = "";
  const h = document.createElement("h3"); h.textContent = title(d);
  const bd = document.createElement("div"); bd.className = "badge"; bd.style.setProperty("--c", cat.c);
  bd.innerHTML = "<i></i>"; bd.append(cat.n + (sport ? " · " + sport : ""));
  const rt = document.createElement("div"); rt.className = "route"; rt.innerHTML = "<div>...<small>a pé</small></div>";
  const tip = document.createElement("div"); tip.className = "tip"; tip.innerHTML = "<b>Sugestão de treino:</b> "; tip.append(cat.t);
  const src = document.createElement("p"); src.className = "src";
  const act = document.createElement("div"); act.className = "actions";
  const gm = document.createElement("a"); gm.className = "alt"; gm.target = "_blank"; gm.rel = "noopener"; gm.textContent = "Abrir no Google Maps";
  gm.href = `https://www.google.com/maps/dir/?api=1&destination=${d.lat},${d.lng}&travelmode=walking`; act.appendChild(gm);
  if (WHATS) { const w = document.createElement("a"); w.target = "_blank"; w.rel = "noopener"; w.textContent = "Treinar com a Motion";
    w.href = `https://wa.me/${WHATS}?text=` + encodeURIComponent("Oi! Quero treinar em: " + title(d)); act.appendChild(w); }
  card.append(h, bd, rt, src, tip, act);
  renderList(filtered());
  const res = await routeTo(state.origin, [d.lng, d.lat]);
  if (my !== state.routeId) return;
  map.getSource("route") && map.getSource("route").setData({ type: "Feature", geometry: { type: "LineString", coordinates: res.coords } });
  rt.innerHTML = `<div>${fmtKm(res.dist / 1000)}<small>distância</small></div><div>${fmtMin(res.dur)}<small>a pé</small></div>`;
  src.textContent = res.aws ? "Rota calculada pelo Amazon Location Service, a partir de: " + state.label + "." : "Distância em linha reta a partir de: " + state.label + ".";
  const b = new maplibregl.LngLatBounds(state.origin, state.origin); res.coords.forEach((c) => b.extend(c)); b.extend([d.lng, d.lat]);
  map.fitBounds(b, { padding: 70, maxZoom: 16, duration: 700 });
}

function setOrigin(pos, label) {
  state.origin = pos; state.label = label; meMarker.setLngLat(pos); $("#originLabel").textContent = label;
  const arr = filtered(); renderList(arr);
  if (state.sel != null) select(state.sel, false);
}
function hint(msg) { const h = $("#hint"); h.textContent = msg; h.hidden = !msg; }

$("#btnGeo").onclick = () => {
  hint("");
  if (!navigator.geolocation) return hint("Seu navegador não tem localização.");
  navigator.geolocation.getCurrentPosition(
    (p) => { setOrigin([p.coords.longitude, p.coords.latitude], "Sua localização"); map.easeTo({ center: state.origin, zoom: 14 }); },
    () => hint("Não consegui pegar sua localização. Digite um endereço ou escolha no mapa."),
    { enableHighAccuracy: true, timeout: 10000 });
};
$("#btnPick").onclick = () => {
  state.picking = !state.picking; $("#btnPick").classList.toggle("on", state.picking);
  hint(state.picking ? "Toque no mapa onde você está." : ""); map.getCanvas().style.cursor = state.picking ? "crosshair" : "";
};
map.on("click", (e) => {
  if (!state.picking) return;
  state.picking = false; $("#btnPick").classList.remove("on"); hint(""); map.getCanvas().style.cursor = "";
  setOrigin([e.lngLat.lng, e.lngLat.lat], "Ponto escolhido no mapa");
});
$("#addrForm").onsubmit = async (e) => {
  e.preventDefault(); const q = $("#addr").value.trim(); if (!q) return;
  if (!KEY) return hint("A busca por endereço precisa da chave do Amazon Location.");
  hint("Buscando...");
  try {
    const r = await fetch(`https://places.geo.${REGION}.amazonaws.com/v2/search-text?key=${KEY}`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ QueryText: q + ", Ponta Grossa", BiasPosition: CENTER, MaxResults: 1 })
    });
    const j = await r.json(); const it = j.ResultItems && j.ResultItems[0];
    if (!it) return hint("Não encontrei esse endereço.");
    hint(""); setOrigin(it.Position, (it.Title || q)); map.easeTo({ center: it.Position, zoom: 14 });
  } catch (err) { hint("A busca por endereço não está disponível agora."); }
};
$("#q").oninput = (e) => { state.q = e.target.value; refresh(); };

loadData().then(() => { renderChips(); renderList(filtered()); if (map.loaded()) { refresh(); fitAll(); } })
  .catch(() => banner("Não encontrei o arquivo pontos.geojson. Coloque-o na mesma pasta do index.html."));
})();
