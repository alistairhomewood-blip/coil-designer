import { useState, useEffect, useRef } from "react";
import * as THREE from "three";

/* ── Constants ────────────────────────────────────────────── */

const COLORS = [
  "#3b82f6","#ef4444","#22c55e","#f59e0b","#8b5cf6",
  "#ec4899","#06b6d4","#f97316","#a3e635","#fb923c"
];

const AWG_DIAMETER_M = {
  4:0.005189, 6:0.004115, 8:0.003264, 10:0.002588, 12:0.002053,
  14:0.001628, 16:0.001291, 18:0.001024, 20:0.000812, 22:0.000644,
  24:0.000511, 26:0.000405, 28:0.000321, 30:0.000255, 32:0.000202,
};

function getWireDiam(awg) { return AWG_DIAMETER_M[awg] || 0.001628; }

let _nextId = 1;
function makeId() { return _nextId++; }

function defaultCoil(overrides = {}) {
  const id = overrides.id || makeId();
  return {
    id, type: "circular", name: `Coil ${id}`,
    center: [0,0,0], normal: [0,1,0],
    radius: 0.5, semiMajor: 0.5, semiMinor: 0.3,
    straightLength: 0.6, arcRadius: 0.3,
    majorRadius: 0.1, minorRadius: 0.05,
    extension: 0.0,
    windingIndex: 0, totalWindings: 12,
    turns: 100, current: 10, wireGauge: 14, windingLayers: 1,
    channelWidth: 0.01,
    ...overrides, id,
  };
}

/* ── Packing calculation ──────────────────────────────────── */

function calcPacking(coil) {
  const wd = getWireDiam(coil.wireGauge);
  const cw = coil.channelWidth || 0.01;
  const turnsPerLayer = Math.max(1, Math.floor(cw / wd));
  const numLayers = Math.ceil(coil.turns / turnsPerLayer);
  const actualLastLayerTurns = coil.turns - (numLayers - 1) * turnsPerLayer;
  return { wd, cw, turnsPerLayer, numLayers, actualLastLayerTurns };
}

/* ── Stadium perimeter utilities (for elongated toroid) ──── */

function stadiumPerimeter(r, d) { return 2 * Math.PI * r + 2 * d; }

function stadiumPoint(t, r, d) {
  if (d <= 0) {
    const angle = t * 2 * Math.PI;
    return { dr: r*Math.cos(angle), dh: r*Math.sin(angle), nr: Math.cos(angle), nh: Math.sin(angle) };
  }
  const L = stadiumPerimeter(r, d);
  let s = ((t % 1) + 1) % 1 * L;
  const s1 = Math.PI * r;
  const s2 = s1 + d;
  const s3 = s2 + Math.PI * r;
  if (s < s1) {
    const a = s / r;
    return { dr: r*Math.cos(a), dh: d/2 + r*Math.sin(a), nr: Math.cos(a), nh: Math.sin(a) };
  } else if (s < s2) {
    return { dr: -r, dh: d/2 - (s - s1), nr: -1, nh: 0 };
  } else if (s < s3) {
    const a = Math.PI + (s - s2) / r;
    return { dr: r*Math.cos(a), dh: -d/2 + r*Math.sin(a), nr: Math.cos(a), nh: Math.sin(a) };
  } else {
    return { dr: r, dh: -d/2 + (s - s3), nr: 1, nh: 0 };
  }
}

/* ── Path generation ──────────────────────────────────────── */

function generateBasePath(coil) {
  const pts = [], N = 200;
  if (coil.type === "circular") {
    for (let i = 0; i < N; i++) {
      const t = (i/N)*2*Math.PI;
      pts.push(new THREE.Vector3(coil.radius*Math.cos(t), 0, coil.radius*Math.sin(t)));
    }
  } else if (coil.type === "racetrack") {
    const L = coil.straightLength/2, R = coil.arcRadius, seg = Math.floor(N/4);
    for (let i=0;i<seg;i++) pts.push(new THREE.Vector3(-L+(i/seg)*2*L,0,-R));
    for (let i=0;i<seg;i++){const a=(i/seg)*Math.PI;pts.push(new THREE.Vector3(L+R*Math.sin(a),0,-R*Math.cos(a)));}
    for (let i=0;i<seg;i++) pts.push(new THREE.Vector3(L-(i/seg)*2*L,0,R));
    for (let i=0;i<seg;i++){const a=(i/seg)*Math.PI;pts.push(new THREE.Vector3(-L-R*Math.sin(a),0,R*Math.cos(a)));}
  } else if (coil.type === "elliptical") {
    for (let i = 0; i < N; i++) {
      const t=(i/N)*2*Math.PI;
      pts.push(new THREE.Vector3(coil.semiMajor*Math.cos(t),0,coil.semiMinor*Math.sin(t)));
    }
  } else if (coil.type === "toroidal_winding" || coil.type === "elongated_toroidal_winding") {
    const R = coil.majorRadius, r = coil.minorRadius;
    const d = coil.type === "elongated_toroidal_winding" ? (coil.extension || 0) : 0;
    const t = coil.windingIndex / coil.totalWindings;
    const { dr, dh } = stadiumPoint(t, r, d);
    const circleR = R + dr;
    const circleY = dh;
    for (let i = 0; i < N; i++) {
      const a = (i/N)*2*Math.PI;
      pts.push(new THREE.Vector3(circleR*Math.cos(a), circleY, circleR*Math.sin(a)));
    }
  }
  return pts;
}

function applyOrientation(pts, coil) {
  const n = new THREE.Vector3(...coil.normal).normalize();
  if (n.length() < 0.001) n.set(0,1,0);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0), n);
  const c = new THREE.Vector3(...coil.center);
  return pts.map(p => p.applyQuaternion(q).add(c));
}

function generatePath(coil) {
  return applyOrientation(generateBasePath(coil), coil);
}

/* ── Individual turn paths ────────────────────────────────── */

function generateTurnPaths(coil) {
  const { wd, turnsPerLayer, numLayers } = calcPacking(coil);
  const paths = [];
  let turnCount = 0;
  const isToroidal = coil.type === "toroidal_winding" || coil.type === "elongated_toroidal_winding";

  for (let layer = 0; layer < numLayers && turnCount < coil.turns; layer++) {
    const turnsThisLayer = Math.min(turnsPerLayer, coil.turns - turnCount);
    for (let j = 0; j < turnsThisLayer; j++) {
      const tangentialOff = (j - turnsThisLayer/2 + 0.5) * wd;
      const radialOff = (layer + 0.5) * wd;

      if (isToroidal) {
        const R = coil.majorRadius, r = coil.minorRadius;
        const d = coil.type === "elongated_toroidal_winding" ? (coil.extension || 0) : 0;
        const L = d > 0 ? stadiumPerimeter(r, d) : 2 * Math.PI * r;
        const tBase = coil.windingIndex / coil.totalWindings;
        const tOff = tangentialOff / L;
        const { dr, dh, nr, nh } = stadiumPoint(tBase + tOff, r, d);
        const circleR = R + dr + nr * radialOff;
        const circleY = dh + nh * radialOff;
        const pts = [];
        for (let i = 0; i < 128; i++) {
          const a = (i/128)*2*Math.PI;
          pts.push(new THREE.Vector3(circleR*Math.cos(a), circleY, circleR*Math.sin(a)));
        }
        paths.push(applyOrientation(pts, coil));
      } else {
        const basePts = generateBasePath(coil);
        const centroid = new THREE.Vector3();
        basePts.forEach(p => centroid.add(p));
        centroid.divideScalar(basePts.length);
        const normalDir = new THREE.Vector3(0, 1, 0);
        const offsetPts = basePts.map(p => {
          const radialDir = p.clone().sub(centroid).normalize();
          return p.clone()
            .add(normalDir.clone().multiplyScalar(tangentialOff))
            .add(radialDir.multiplyScalar(radialOff));
        });
        paths.push(applyOrientation(offsetPts, coil));
      }
      turnCount++;
    }
  }
  return paths;
}

/* ── Mesh builders ────────────────────────────────────────── */

function buildTubeMesh(path, tubeR, color, emissive) {
  const curve = new THREE.CatmullRomCurve3(path, true);
  const segs = Math.min(200, Math.max(64, path.length));
  const geom = new THREE.TubeGeometry(curve, segs, tubeR, 8, true);
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    emissive: new THREE.Color(emissive ? color : "#000"),
    emissiveIntensity: emissive ? 0.5 : 0,
    roughness: 0.4, metalness: 0.6,
  });
  return new THREE.Mesh(geom, mat);
}

function buildCoilMeshes(coil, color, selected, visualScale, showIndividual) {
  const meshes = [];
  const wd = getWireDiam(coil.wireGauge);
  const baseVisualR = wd / 2 * visualScale;

  if (showIndividual && coil.turns > 1) {
    const turnPaths = generateTurnPaths(coil);
    const limit = 500;
    const pathsToRender = turnPaths.slice(0, limit);
    pathsToRender.forEach(tp => {
      meshes.push(buildTubeMesh(tp, baseVisualR, color, selected));
    });
  } else {
    const path = generatePath(coil);
    const { numLayers, turnsPerLayer } = calcPacking(coil);
    const bundleW = Math.min(coil.turns, turnsPerLayer) * wd;
    const bundleH = numLayers * wd;
    const bundleR = Math.sqrt(bundleW * bundleH / Math.PI) / 2;
    const tubeR = coil.turns > 1 ? Math.max(bundleR * visualScale, baseVisualR) : baseVisualR;
    meshes.push(buildTubeMesh(path, tubeR, color, selected));
  }
  return meshes;
}

/* ── Ghost surfaces ───────────────────────────────────────── */

function buildGhostTorus(majorR, minorR, center, normal) {
  const geom = new THREE.TorusGeometry(majorR, minorR, 32, 100);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff, transparent: true, opacity: 0.07,
    side: THREE.DoubleSide, depthWrite: false,
  });
  const mesh = new THREE.Mesh(geom, mat);
  const n = new THREE.Vector3(...normal).normalize();
  if (n.length() < 0.001) n.set(0,1,0);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0), n);
  const flipQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI/2, 0, 0));
  mesh.quaternion.copy(q.multiply(flipQ));
  mesh.position.set(...center);
  return mesh;
}

function buildGhostElongatedTorus(majorR, minorR, ext, center, normal) {
  const profilePts = [];
  const nSeg = 64;
  for (let i = 0; i <= nSeg; i++) {
    const t = i / nSeg;
    const { dr, dh } = stadiumPoint(t, minorR, ext);
    profilePts.push(new THREE.Vector2(majorR + dr, dh));
  }
  const geom = new THREE.LatheGeometry(profilePts, 100);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff, transparent: true, opacity: 0.07,
    side: THREE.DoubleSide, depthWrite: false,
  });
  const mesh = new THREE.Mesh(geom, mat);
  const n = new THREE.Vector3(...normal).normalize();
  if (n.length() < 0.001) n.set(0,1,0);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0), n);
  mesh.quaternion.copy(q);
  mesh.position.set(...center);
  return mesh;
}

/* ── Scale markers ────────────────────────────────────────── */

function buildScaleMarkers(maxRange) {
  const group = new THREE.Group();
  const axes = [
    { dir: new THREE.Vector3(1,0,0), color: "#ef4444", label: "X" },
    { dir: new THREE.Vector3(0,1,0), color: "#22c55e", label: "Y" },
    { dir: new THREE.Vector3(0,0,1), color: "#3b82f6", label: "Z" },
  ];
  axes.forEach(({ dir, color }) => {
    for (let i = -maxRange; i <= maxRange; i++) {
      if (i === 0) continue;
      const pos = dir.clone().multiplyScalar(i);
      // Tick mark
      const tickGeom = new THREE.SphereGeometry(0.02, 8, 8);
      const tickMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity: 0.5 });
      const tick = new THREE.Mesh(tickGeom, tickMat);
      tick.position.copy(pos);
      group.add(tick);
      // Label
      const canvas = document.createElement("canvas");
      canvas.width = 64; canvas.height = 32;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = color; ctx.font = "bold 24px monospace";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(String(i), 32, 16);
      const spriteMat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), depthTest: false, transparent: true, opacity: 0.6 });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.position.copy(pos).add(new THREE.Vector3(0, 0.08, 0));
      sprite.scale.set(0.12, 0.06, 0.12);
      group.add(sprite);
    }
  });
  return group;
}

function makeLabel(text, pos, color) {
  const canvas = document.createElement("canvas");
  canvas.width = 64; canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = color; ctx.font = "bold 48px monospace";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(text, 32, 32);
  const mat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.position.copy(pos); sprite.scale.set(0.15,0.15,0.15);
  return sprite;
}

/* ── Claude API ───────────────────────────────────────────── */

const SYSTEM_PROMPT = `You are a coil geometry interpreter. Parse the user's plain-English description into a JSON array.

COORDINATE SYSTEM: right-handed, Y is up. Units: metres.

COIL TYPES:

1. "circular" — planar circular loop.
2. "racetrack" — two straight segments joined by semicircular arcs.
3. "elliptical" — planar elliptical loop.
4. "toroidal_winding" — a wire loop on the surface of a standard torus, tracing a toroidal-direction circle at a fixed poloidal angle. For N windings, output N coils with windingIndex 0 to N-1.
   majorRadius = (innerRadius + outerRadius) / 2
   minorRadius = (outerRadius - innerRadius) / 2
5. "elongated_toroidal_winding" — same as toroidal_winding but the torus cross-section is a stadium shape (two semicircles connected by straight walls). The extension parameter is the length of the straight wall section (distance the two halves are pulled apart). For N windings, output N coils with windingIndex 0 to N-1.
   majorRadius, minorRadius computed same as toroidal_winding.
   extension = the separation distance between the two halves.

Each coil MUST contain ALL fields:
{"type":"circular"|"racetrack"|"elliptical"|"toroidal_winding"|"elongated_toroidal_winding","name":"label","center":[x,y,z],"normal":[nx,ny,nz],"radius":0.5,"semiMajor":0.5,"semiMinor":0.3,"straightLength":0.6,"arcRadius":0.3,"majorRadius":0.1,"minorRadius":0.05,"extension":0.0,"windingIndex":0,"totalWindings":12,"turns":100,"current":10.0,"wireGauge":14,"windingLayers":1,"channelWidth":0.01}

Always include every field with sensible defaults for unused ones.
Defaults if unspecified: turns=100, current=10, wireGauge=14, windingLayers=1, normal=[0,1,0], channelWidth=0.01.
Respond with ONLY valid JSON array. No markdown, no backticks, no explanation.`;

async function parseWithClaude(prompt) {
  const res = await fetch("/api/parse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  const text = data.content?.map(b => b.text || "").join("") || "";
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

/* ── UI components ────────────────────────────────────────── */

function Num({ label, value, onChange, step = 0.01 }) {
  return (
    <label className="flex items-center gap-1 text-xs text-gray-300">
      <span className="w-24 text-right text-gray-500 shrink-0">{label}</span>
      <input type="number" step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className="w-20 bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-gray-200 text-xs focus:border-blue-500 outline-none" />
    </label>
  );
}

function Vec3({ label, value, onChange }) {
  const set = (i, v) => { const a = [...value]; a[i] = v; onChange(a); };
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-gray-500 ml-1">{label}</span>
      <div className="flex gap-1 ml-1">
        {["x","y","z"].map((ax, i) => (
          <label key={ax} className="flex items-center gap-0.5 text-xs text-gray-400">
            {ax}<input type="number" step={0.01} value={value[i]}
              onChange={e => set(i, parseFloat(e.target.value) || 0)}
              className="w-14 bg-gray-800 border border-gray-700 rounded px-1 py-0.5 text-gray-200 text-xs focus:border-blue-500 outline-none" />
          </label>
        ))}
      </div>
    </div>
  );
}

function CoilCard({ coil, index, selected, onSelect, onUpdate, onDelete }) {
  const [open, setOpen] = useState(true);
  const color = COLORS[index % COLORS.length];
  const set = (k, v) => onUpdate({ ...coil, [k]: v });
  const packing = calcPacking(coil);
  const isToroidal = coil.type === "toroidal_winding" || coil.type === "elongated_toroidal_winding";

  return (
    <div className={`border rounded-lg overflow-hidden mb-2 transition-colors ${selected ? "border-blue-500 bg-gray-800/60" : "border-gray-700 bg-gray-900/40"}`}>
      <div className="flex items-center gap-2 px-3 py-2 cursor-pointer" onClick={() => { setOpen(!open); onSelect(coil.id); }}>
        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <input value={coil.name} onChange={e => set("name", e.target.value)} onClick={e => e.stopPropagation()}
          className="flex-1 bg-transparent text-sm text-gray-200 font-medium outline-none" />
        <span className="text-gray-600 text-xs">{open ? "▾" : "▸"}</span>
      </div>
      {open && (
        <div className="px-3 pb-3 flex flex-col gap-2 text-xs" onClick={e => e.stopPropagation()}>
          <label className="flex items-center gap-1 text-gray-400">
            <span className="w-24 text-right text-gray-500">Type</span>
            <select value={coil.type} onChange={e => set("type", e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-gray-200 text-xs outline-none">
              <option value="circular">Circular</option>
              <option value="racetrack">Racetrack</option>
              <option value="elliptical">Elliptical</option>
              <option value="toroidal_winding">Toroidal Winding</option>
              <option value="elongated_toroidal_winding">Elongated Toroidal</option>
            </select>
          </label>
          <Vec3 label="Center (m)" value={coil.center} onChange={v => set("center", v)} />
          <Vec3 label="Normal" value={coil.normal} onChange={v => set("normal", v)} />

          {coil.type === "circular" && <Num label="Radius (m)" value={coil.radius} onChange={v => set("radius", v)} />}
          {coil.type === "racetrack" && <>
            <Num label="Straight (m)" value={coil.straightLength} onChange={v => set("straightLength", v)} />
            <Num label="Arc R (m)" value={coil.arcRadius} onChange={v => set("arcRadius", v)} />
          </>}
          {coil.type === "elliptical" && <>
            <Num label="Semi-maj (m)" value={coil.semiMajor} onChange={v => set("semiMajor", v)} />
            <Num label="Semi-min (m)" value={coil.semiMinor} onChange={v => set("semiMinor", v)} />
          </>}
          {isToroidal && <>
            <Num label="Major R (m)" value={coil.majorRadius} onChange={v => set("majorRadius", v)} />
            <Num label="Minor R (m)" value={coil.minorRadius} onChange={v => set("minorRadius", v)} />
            {coil.type === "elongated_toroidal_winding" &&
              <Num label="Extension (m)" value={coil.extension} onChange={v => set("extension", v)} />
            }
            <Num label="Winding #" value={coil.windingIndex} onChange={v => set("windingIndex", v)} step={1} />
            <Num label="Total winds" value={coil.totalWindings} onChange={v => set("totalWindings", v)} step={1} />
          </>}

          <div className="border-t border-gray-800 pt-2 mt-1" />
          <Num label="Turns" value={coil.turns} onChange={v => set("turns", v)} step={1} />
          <Num label="Current (A)" value={coil.current} onChange={v => set("current", v)} step={0.1} />
          <Num label="AWG" value={coil.wireGauge} onChange={v => set("wireGauge", v)} step={1} />
          <Num label="Channel (m)" value={coil.channelWidth} onChange={v => set("channelWidth", v)} step={0.001} />

          {/* Packing info */}
          <div className="bg-gray-800/50 rounded px-2 py-1 text-gray-500 text-xs">
            Wire: {(packing.wd*1000).toFixed(2)}mm | {packing.turnsPerLayer}/layer | {packing.numLayers} layers
          </div>

          <button onClick={() => onDelete(coil.id)} className="mt-1 text-red-400 hover:text-red-300 text-xs self-end">Delete</button>
        </div>
      )}
    </div>
  );
}

/* ── Settings panel ───────────────────────────────────────── */

function SettingsPanel({ showScales, setShowScales, showIndividual, setShowIndividual, visualScale, setVisualScale }) {
  return (
    <div className="border-t border-gray-800 px-3 py-2 flex flex-col gap-2 bg-gray-900/30">
      <span className="text-xs text-gray-400 font-medium">Display Settings</span>
      <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
        <input type="checkbox" checked={showScales} onChange={e => setShowScales(e.target.checked)}
          className="rounded border-gray-600" />
        Axis scales
      </label>
      <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
        <input type="checkbox" checked={showIndividual} onChange={e => setShowIndividual(e.target.checked)}
          className="rounded border-gray-600" />
        Individual turns
      </label>
      <label className="flex flex-col gap-1 text-xs text-gray-400">
        <span>Visual wire width: {visualScale.toFixed(1)}x</span>
        <input type="range" min="0.5" max="20" step="0.5" value={visualScale}
          onChange={e => setVisualScale(parseFloat(e.target.value))}
          className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
      </label>
    </div>
  );
}

/* ── Main app ─────────────────────────────────────────────── */

export default function App() {
  const [coils, setCoils] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showScales, setShowScales] = useState(false);
  const [showIndividual, setShowIndividual] = useState(false);
  const [visualScale, setVisualScale] = useState(5);

  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const coilGroupRef = useRef(null);
  const scaleGroupRef = useRef(null);
  const frameRef = useRef(null);
  const orbitRef = useRef({ theta: Math.PI/4, phi: Math.PI/3, dist: 4, target: new THREE.Vector3(), dragging: false, panning: false, lastX: 0, lastY: 0 });

  /* ── Init Three.js ───────────────────────────────────── */
  useEffect(() => {
    const el = containerRef.current; if (!el) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#0d1117");
    sceneRef.current = scene;
    const camera = new THREE.PerspectiveCamera(50, el.clientWidth/el.clientHeight, 0.001, 200);
    cameraRef.current = camera;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    el.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(3,5,4); scene.add(dir);
    scene.add(new THREE.HemisphereLight(0x4488ff, 0x222244, 0.3));
    scene.add(new THREE.GridHelper(6, 30, 0x333333, 0x1a1a2e));
    scene.add(new THREE.AxesHelper(1.5));
    scene.add(makeLabel("X", new THREE.Vector3(1.65,0,0), "#ef4444"));
    scene.add(makeLabel("Y", new THREE.Vector3(0,1.65,0), "#22c55e"));
    scene.add(makeLabel("Z", new THREE.Vector3(0,0,1.65), "#3b82f6"));

    const cg = new THREE.Group(); scene.add(cg); coilGroupRef.current = cg;
    const sg = new THREE.Group(); sg.visible = false; scene.add(sg); scaleGroupRef.current = sg;

    const o = orbitRef.current;
    camera.position.set(o.dist*Math.sin(o.phi)*Math.cos(o.theta), o.dist*Math.cos(o.phi), o.dist*Math.sin(o.phi)*Math.sin(o.theta));
    camera.lookAt(o.target);

    function animate() { frameRef.current = requestAnimationFrame(animate); renderer.render(scene, camera); }
    animate();

    const onResize = () => { camera.aspect=el.clientWidth/el.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(el.clientWidth, el.clientHeight); };
    window.addEventListener("resize", onResize);
    return () => { cancelAnimationFrame(frameRef.current); window.removeEventListener("resize", onResize); renderer.dispose(); if(el.contains(renderer.domElement)) el.removeChild(renderer.domElement); };
  }, []);

  /* ── Orbit + pan controls ────────────────────────────── */
  useEffect(() => {
    const el = containerRef.current; if (!el) return;
    function updateCam() {
      const o = orbitRef.current, cam = cameraRef.current; if(!cam) return;
      cam.position.set(
        o.target.x + o.dist*Math.sin(o.phi)*Math.cos(o.theta),
        o.target.y + o.dist*Math.cos(o.phi),
        o.target.z + o.dist*Math.sin(o.phi)*Math.sin(o.theta)
      );
      cam.lookAt(o.target);
    }
    const onDown = e => {
      if (e.button === 2 || e.shiftKey) { orbitRef.current.panning=true; }
      else { orbitRef.current.dragging=true; }
      orbitRef.current.lastX=e.clientX; orbitRef.current.lastY=e.clientY;
    };
    const onMove = e => {
      const o=orbitRef.current;
      const dx = e.clientX-o.lastX, dy = e.clientY-o.lastY;
      if (o.dragging) {
        o.theta-=dx*0.005;
        o.phi=Math.max(0.1,Math.min(Math.PI-0.1,o.phi-dy*0.005));
      } else if (o.panning) {
        const cam = cameraRef.current; if(!cam) return;
        const right = new THREE.Vector3(); cam.getWorldDirection(right);
        const up = new THREE.Vector3(0,1,0);
        right.cross(up).normalize();
        const panSpeed = o.dist * 0.002;
        o.target.add(right.multiplyScalar(-dx * panSpeed));
        o.target.y += dy * panSpeed;
      }
      o.lastX=e.clientX; o.lastY=e.clientY;
      if (o.dragging || o.panning) updateCam();
    };
    const onUp = () => { orbitRef.current.dragging=false; orbitRef.current.panning=false; };
    const onWheel = e => { e.preventDefault(); orbitRef.current.dist=Math.max(0.05,Math.min(50,orbitRef.current.dist*Math.pow(1.001,e.deltaY))); updateCam(); };
    const onCtx = e => e.preventDefault();
    el.addEventListener("mousedown", onDown); window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp); el.addEventListener("wheel", onWheel, {passive:false});
    el.addEventListener("contextmenu", onCtx);
    return () => { el.removeEventListener("mousedown", onDown); window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); el.removeEventListener("wheel", onWheel); el.removeEventListener("contextmenu", onCtx); };
  }, []);

  /* ── Scale markers ───────────────────────────────────── */
  useEffect(() => {
    const sg = scaleGroupRef.current; if (!sg) return;
    while (sg.children.length) { const c=sg.children[0]; c.geometry?.dispose(); c.material?.dispose(); sg.remove(c); }
    if (showScales) {
      const markers = buildScaleMarkers(3);
      markers.children.forEach(c => sg.add(c.clone()));
    }
    sg.visible = showScales;
  }, [showScales]);

  /* ── Update coil meshes ──────────────────────────────── */
  useEffect(() => {
    const cg = coilGroupRef.current; if (!cg) return;
    while (cg.children.length) {
      const c=cg.children[0];
      if (c.geometry) c.geometry.dispose();
      if (c.material) c.material.dispose();
      cg.remove(c);
    }

    coils.forEach((coil, i) => {
      try {
        const meshes = buildCoilMeshes(coil, COLORS[i%COLORS.length], coil.id===selectedId, visualScale, showIndividual);
        meshes.forEach(m => cg.add(m));
      } catch(e) { console.warn("Mesh error:", coil.name, e); }
    });

    // Ghost surfaces
    const torusKeys = new Map();
    coils.filter(c => c.type === "toroidal_winding" || c.type === "elongated_toroidal_winding").forEach(c => {
      const key = `${c.type}_${c.majorRadius}_${c.minorRadius}_${c.extension||0}_${c.center.join(",")}_${c.normal.join(",")}`;
      if (!torusKeys.has(key)) torusKeys.set(key, c);
    });
    torusKeys.forEach(c => {
      try {
        if (c.type === "elongated_toroidal_winding" && c.extension > 0) {
          cg.add(buildGhostElongatedTorus(c.majorRadius, c.minorRadius, c.extension, c.center, c.normal));
        } else {
          cg.add(buildGhostTorus(c.majorRadius, c.minorRadius, c.center, c.normal));
        }
      } catch(e) { console.warn("Ghost error:", e); }
    });
  }, [coils, selectedId, visualScale, showIndividual]);

  /* ── Handlers ────────────────────────────────────────── */
  const addCoil = () => { const c=defaultCoil(); setCoils(p=>[...p,c]); setSelectedId(c.id); };
  const updateCoil = u => setCoils(p => p.map(c => c.id===u.id ? u : c));
  const deleteCoil = id => { setCoils(p => p.filter(c => c.id!==id)); if(selectedId===id) setSelectedId(null); };

  const handleParse = async () => {
    if (!prompt.trim()) return;
    setLoading(true); setError(null);
    try {
      const parsed = await parseWithClaude(prompt);
      if (!Array.isArray(parsed)) throw new Error("Expected JSON array");
      const nc = parsed.map(p => defaultCoil(p));
      setCoils(nc); setSelectedId(nc[0]?.id || null);
    } catch (e) { setError("Parse failed: " + e.message); }
    finally { setLoading(false); }
  };

  const exportConfig = () => {
    const cfg = coils.map(({id, ...r}) => r);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(cfg,null,2)], {type:"application/json"}));
    a.download = "coil_config.json"; a.click();
  };

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-200 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-900 border-b border-gray-800 shrink-0">
        <input value={prompt} onChange={e => setPrompt(e.target.value)}
          onKeyDown={e => e.key==="Enter" && !e.shiftKey && handleParse()}
          placeholder="Describe your coil geometry in plain English..."
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-gray-200 placeholder-gray-500 outline-none focus:border-blue-500" />
        <button onClick={handleParse} disabled={loading || !prompt.trim()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium rounded-lg shrink-0">
          {loading ? "Parsing..." : "Parse with Claude"}
        </button>
      </div>
      {error && <div className="px-4 py-2 bg-red-900/30 border-b border-red-800 text-red-300 text-xs">{error}</div>}
      <div className="flex flex-1 overflow-hidden">
        <div className="w-72 bg-gray-900/50 border-r border-gray-800 flex flex-col overflow-hidden shrink-0">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
            <span className="text-sm font-medium text-gray-300">Coils ({coils.length})</span>
            <div className="flex gap-1.5">
              <button onClick={addCoil} className="px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-xs text-gray-300 rounded">+ Add</button>
              {coils.length > 0 && <button onClick={exportConfig} className="px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-xs text-gray-300 rounded">Export</button>}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {coils.length === 0 && <div className="text-center text-gray-600 text-xs mt-8 px-4 leading-relaxed">Describe coils above, or click + Add.</div>}
            {coils.map((c, i) => <CoilCard key={c.id} coil={c} index={i} selected={c.id===selectedId} onSelect={setSelectedId} onUpdate={updateCoil} onDelete={deleteCoil} />)}
          </div>
          <SettingsPanel showScales={showScales} setShowScales={setShowScales}
            showIndividual={showIndividual} setShowIndividual={setShowIndividual}
            visualScale={visualScale} setVisualScale={setVisualScale} />
        </div>
        <div className="flex-1 relative">
          <div ref={containerRef} className="absolute inset-0" />
          <div className="absolute bottom-3 left-3 text-xs text-gray-600 pointer-events-none select-none">
            Drag: rotate · Shift+drag: pan · Scroll: zoom
          </div>
          <div className="absolute top-3 right-3 text-xs text-gray-600 pointer-events-none select-none bg-gray-900/60 rounded px-2 py-1">
            <span className="text-red-400">X</span> <span className="text-green-400">Y</span>(up) <span className="text-blue-400">Z</span>
          </div>
        </div>
      </div>
    </div>
  );
}