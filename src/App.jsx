import { useState, useEffect, useRef } from "react";
import * as THREE from "three";

const COLORS = [
  "#3b82f6","#ef4444","#22c55e","#f59e0b","#8b5cf6",
  "#ec4899","#06b6d4","#f97316","#a3e635","#fb923c"
];

let _nextId = 1;
function makeId() { return _nextId++; }

function defaultCoil(overrides = {}) {
  const id = overrides.id || makeId();
  return {
    id, type: "circular", name: `Coil ${id}`,
    center: [0,0,0], normal: [0,1,0],
    radius: 0.5, semiMajor: 0.5, semiMinor: 0.3,
    straightLength: 0.6, arcRadius: 0.3,
    turns: 100, current: 10, wireGauge: 14, windingLayers: 1,
    ...overrides, id,
  };
}

function generatePath(coil) {
  const pts = [], N = 128;
  if (coil.type === "circular") {
    for (let i = 0; i < N; i++) {
      const t = (i/N)*2*Math.PI;
      pts.push(new THREE.Vector3(coil.radius*Math.cos(t), 0, coil.radius*Math.sin(t)));
    }
  } else if (coil.type === "racetrack") {
    const L = coil.straightLength/2, R = coil.arcRadius, seg = Math.floor(N/4);
    for (let i=0; i<seg; i++) pts.push(new THREE.Vector3(-L+(i/seg)*2*L, 0, -R));
    for (let i=0; i<seg; i++) { const a=(i/seg)*Math.PI; pts.push(new THREE.Vector3(L+R*Math.sin(a), 0, -R*Math.cos(a))); }
    for (let i=0; i<seg; i++) pts.push(new THREE.Vector3(L-(i/seg)*2*L, 0, R));
    for (let i=0; i<seg; i++) { const a=(i/seg)*Math.PI; pts.push(new THREE.Vector3(-L-R*Math.sin(a), 0, R*Math.cos(a))); }
  } else if (coil.type === "elliptical") {
    for (let i = 0; i < N; i++) {
      const t = (i/N)*2*Math.PI;
      pts.push(new THREE.Vector3(coil.semiMajor*Math.cos(t), 0, coil.semiMinor*Math.sin(t)));
    }
  }
  const n = new THREE.Vector3(...coil.normal).normalize();
  if (n.length() < 0.001) n.set(0,1,0);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0), n);
  const c = new THREE.Vector3(...coil.center);
  return pts.map(p => p.applyQuaternion(q).add(c));
}

function buildCoilMesh(coil, color, selected) {
  const path = generatePath(coil);
  const curve = new THREE.CatmullRomCurve3(path, true);
  const tubeR = Math.max(0.008, (coil.radius || coil.arcRadius || 0.3)*0.03);
  const geom = new THREE.TubeGeometry(curve, 200, tubeR, 12, true);
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    emissive: new THREE.Color(selected ? color : "#000"),
    emissiveIntensity: selected ? 0.5 : 0,
    roughness: 0.4, metalness: 0.6,
  });
  return new THREE.Mesh(geom, mat);
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

const SYSTEM_PROMPT = `You are a coil geometry interpreter. Parse the user's plain-English description of electromagnetic coil configurations into a JSON array.

COORDINATE SYSTEM: right-handed, Y is up. Units: metres.

Each coil object MUST contain ALL these fields:
{"type":"circular"|"racetrack"|"elliptical","name":"label","center":[x,y,z],"normal":[nx,ny,nz],"radius":0.5,"semiMajor":0.5,"semiMinor":0.3,"straightLength":0.6,"arcRadius":0.3,"turns":100,"current":10.0,"wireGauge":14,"windingLayers":1}

Always include every field (use sensible defaults for unused ones).
If unspecified: turns=100, current=10, wireGauge=14, windingLayers=1, normal=[0,1,0].
For arrangements (rings, Halbach arrays, etc.) compute each individual coil position and normal vector.
Respond with ONLY valid JSON array. No markdown, no backticks, no explanation.`;

async function parseWithClaude(prompt) {
  const res = await fetch("/api/parse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  const text = data.content?.map(b => b.text || "").join("") || "";
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

function Num({ label, value, onChange, step = 0.01 }) {
  return (
    <label className="flex items-center gap-1 text-xs text-gray-300">
      <span className="w-20 text-right text-gray-500 shrink-0">{label}</span>
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
            <span className="w-20 text-right text-gray-500">Type</span>
            <select value={coil.type} onChange={e => set("type", e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-gray-200 text-xs outline-none">
              <option value="circular">Circular</option>
              <option value="racetrack">Racetrack</option>
              <option value="elliptical">Elliptical</option>
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
          <div className="border-t border-gray-800 pt-2 mt-1" />
          <Num label="Turns" value={coil.turns} onChange={v => set("turns", v)} step={1} />
          <Num label="Current (A)" value={coil.current} onChange={v => set("current", v)} step={0.1} />
          <Num label="AWG" value={coil.wireGauge} onChange={v => set("wireGauge", v)} step={1} />
          <Num label="Layers" value={coil.windingLayers} onChange={v => set("windingLayers", v)} step={1} />
          <button onClick={() => onDelete(coil.id)} className="mt-1 text-red-400 hover:text-red-300 text-xs self-end">Delete</button>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [coils, setCoils] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const coilGroupRef = useRef(null);
  const frameRef = useRef(null);
  const orbitRef = useRef({ theta: Math.PI/4, phi: Math.PI/3, dist: 4, dragging: false, lastX: 0, lastY: 0 });

  useEffect(() => {
    const el = containerRef.current; if (!el) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#0d1117");
    sceneRef.current = scene;
    const camera = new THREE.PerspectiveCamera(50, el.clientWidth/el.clientHeight, 0.01, 100);
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

    const o = orbitRef.current;
    camera.position.set(o.dist*Math.sin(o.phi)*Math.cos(o.theta), o.dist*Math.cos(o.phi), o.dist*Math.sin(o.phi)*Math.sin(o.theta));
    camera.lookAt(0,0,0);

    function animate() { frameRef.current = requestAnimationFrame(animate); renderer.render(scene, camera); }
    animate();

    const onResize = () => { camera.aspect=el.clientWidth/el.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(el.clientWidth, el.clientHeight); };
    window.addEventListener("resize", onResize);
    return () => { cancelAnimationFrame(frameRef.current); window.removeEventListener("resize", onResize); renderer.dispose(); if(el.contains(renderer.domElement)) el.removeChild(renderer.domElement); };
  }, []);

  useEffect(() => {
    const el = containerRef.current; if (!el) return;
    function updateCam() {
      const o = orbitRef.current, cam = cameraRef.current; if(!cam) return;
      cam.position.set(o.dist*Math.sin(o.phi)*Math.cos(o.theta), o.dist*Math.cos(o.phi), o.dist*Math.sin(o.phi)*Math.sin(o.theta));
      cam.lookAt(0,0,0);
    }
    const onDown = e => { orbitRef.current.dragging=true; orbitRef.current.lastX=e.clientX; orbitRef.current.lastY=e.clientY; };
    const onMove = e => { const o=orbitRef.current; if(!o.dragging) return; o.theta-=(e.clientX-o.lastX)*0.005; o.phi=Math.max(0.1,Math.min(Math.PI-0.1,o.phi-(e.clientY-o.lastY)*0.005)); o.lastX=e.clientX; o.lastY=e.clientY; updateCam(); };
    const onUp = () => { orbitRef.current.dragging=false; };
    const onWheel = e => { e.preventDefault(); orbitRef.current.dist=Math.max(0.5,Math.min(20,orbitRef.current.dist+e.deltaY*0.005)); updateCam(); };
    el.addEventListener("mousedown", onDown); window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp); el.addEventListener("wheel", onWheel, {passive:false});
    return () => { el.removeEventListener("mousedown", onDown); window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); el.removeEventListener("wheel", onWheel); };
  }, []);

  useEffect(() => {
    const cg = coilGroupRef.current; if (!cg) return;
    while (cg.children.length) { const c=cg.children[0]; c.geometry?.dispose(); c.material?.dispose(); cg.remove(c); }
    coils.forEach((coil, i) => { try { cg.add(buildCoilMesh(coil, COLORS[i%COLORS.length], coil.id===selectedId)); } catch(e) { console.warn(e); } });
  }, [coils, selectedId]);

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
        </div>
        <div className="flex-1 relative">
          <div ref={containerRef} className="absolute inset-0" />
          <div className="absolute bottom-3 left-3 text-xs text-gray-600 pointer-events-none select-none">Drag to rotate · Scroll to zoom</div>
          <div className="absolute top-3 right-3 text-xs text-gray-600 pointer-events-none select-none bg-gray-900/60 rounded px-2 py-1">
            <span className="text-red-400">X</span> <span className="text-green-400">Y</span>(up) <span className="text-blue-400">Z</span>
          </div>
        </div>
      </div>
    </div>
  );
}
