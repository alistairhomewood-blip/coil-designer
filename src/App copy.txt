import { useState, useEffect, useRef, useCallback } from "react";
import * as THREE from "three";

/* ══════════════════════════════════════════════════════════════
   CONSTANTS
   ══════════════════════════════════════════════════════════════ */

const COLORS = [
  "#3b82f6","#ef4444","#22c55e","#f59e0b","#8b5cf6",
  "#ec4899","#06b6d4","#f97316","#a3e635","#fb923c"
];

const AWG_DIAM = {
  4:5.189,6:4.115,8:3.264,10:2.588,12:2.053,14:1.628,16:1.291,
  18:1.024,20:0.812,22:0.644,24:0.511,26:0.405,28:0.321,30:0.255,32:0.202
};
function wireDiam(awg) { return (AWG_DIAM[awg] || 1.628) / 1000; }

const MU0 = 4 * Math.PI * 1e-7;
const CU_RHO = 1.68e-8;
const CU_DENSITY = 8960;

let _id = 1;
function mkId() { return _id++; }

function defaultCoil(o = {}) {
  const id = o.id || mkId();
  return {
    id, type:"circular", name:`Coil ${id}`,
    center:[0,0,0], normal:[0,1,0],
    radius:0.5, semiMajor:0.5, semiMinor:0.3,
    straightLength:0.6, arcRadius:0.3,
    majorRadius:0.1, minorRadius:0.05, extension:0,
    windingIndex:0, totalWindings:12,
    turns:100, current:10, wireGauge:14, channelWidth:0.01,
    ...o, id
  };
}

function calcPacking(c) {
  const wd = wireDiam(c.wireGauge);
  const cw = c.channelWidth || 0.01;
  const tpl = Math.max(1, Math.floor(cw / wd));
  const layers = Math.ceil(c.turns / tpl);
  return { wd, cw, tpl, layers };
}

/* ══════════════════════════════════════════════════════════════
   STADIUM GEOMETRY
   ══════════════════════════════════════════════════════════════ */

function stadiumPerim(r, d) { return 2*Math.PI*r + 2*d; }

function stadiumPt(t, r, d) {
  if (d <= 0) {
    const a = t*2*Math.PI;
    return { dr:r*Math.cos(a), dh:r*Math.sin(a), nr:Math.cos(a), nh:Math.sin(a) };
  }
  const L = stadiumPerim(r, d);
  let s = (((t%1)+1)%1) * L;
  const s1=Math.PI*r, s2=s1+d, s3=s2+Math.PI*r;
  if (s < s1) { const a=s/r; return {dr:r*Math.cos(a),dh:d/2+r*Math.sin(a),nr:Math.cos(a),nh:Math.sin(a)}; }
  if (s < s2) { return {dr:-r,dh:d/2-(s-s1),nr:-1,nh:0}; }
  if (s < s3) { const a=Math.PI+(s-s2)/r; return {dr:r*Math.cos(a),dh:-d/2+r*Math.sin(a),nr:Math.cos(a),nh:Math.sin(a)}; }
  return {dr:r,dh:-d/2+(s-s3),nr:1,nh:0};
}

/* ══════════════════════════════════════════════════════════════
   PATH GENERATION
   ══════════════════════════════════════════════════════════════ */

function basePath(c) {
  const pts=[], N=200;
  if (c.type==="circular") {
    for(let i=0;i<N;i++){const t=(i/N)*2*Math.PI;pts.push(new THREE.Vector3(c.radius*Math.cos(t),0,c.radius*Math.sin(t)));}
  } else if (c.type==="racetrack") {
    const L=c.straightLength/2,R=c.arcRadius,seg=N/4|0;
    for(let i=0;i<seg;i++) pts.push(new THREE.Vector3(-L+(i/seg)*2*L,0,-R));
    for(let i=0;i<seg;i++){const a=(i/seg)*Math.PI;pts.push(new THREE.Vector3(L+R*Math.sin(a),0,-R*Math.cos(a)));}
    for(let i=0;i<seg;i++) pts.push(new THREE.Vector3(L-(i/seg)*2*L,0,R));
    for(let i=0;i<seg;i++){const a=(i/seg)*Math.PI;pts.push(new THREE.Vector3(-L-R*Math.sin(a),0,R*Math.cos(a)));}
  } else if (c.type==="elliptical") {
    for(let i=0;i<N;i++){const t=(i/N)*2*Math.PI;pts.push(new THREE.Vector3(c.semiMajor*Math.cos(t),0,c.semiMinor*Math.sin(t)));}
  } else if (c.type==="toroidal_winding"||c.type==="elongated_toroidal_winding") {
    const R=c.majorRadius,r=c.minorRadius,d=c.type==="elongated_toroidal_winding"?(c.extension||0):0;
    const {dr,dh}=stadiumPt(c.windingIndex/c.totalWindings,r,d);
    const cR=R+dr;
    for(let i=0;i<N;i++){const a=(i/N)*2*Math.PI;pts.push(new THREE.Vector3(cR*Math.cos(a),dh,cR*Math.sin(a)));}
  }
  return pts;
}

function orient(pts, c) {
  const n=new THREE.Vector3(...c.normal).normalize();
  if(n.length()<.001)n.set(0,1,0);
  const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),n);
  const ct=new THREE.Vector3(...c.center);
  return pts.map(p=>p.applyQuaternion(q).add(ct));
}

function fullPath(c) { return orient(basePath(c),c); }

function turnPaths(coil) {
  const {wd,tpl,layers}=calcPacking(coil);
  const paths=[];
  let count=0;
  const isTor=coil.type==="toroidal_winding"||coil.type==="elongated_toroidal_winding";
  for(let lay=0;lay<layers&&count<coil.turns;lay++){
    const n=Math.min(tpl,coil.turns-count);
    for(let j=0;j<n;j++){
      const tOff=(j-n/2+.5)*wd;
      const rOff=(lay+.5)*wd;
      if(isTor){
        const R=coil.majorRadius,r=coil.minorRadius;
        const d=coil.type==="elongated_toroidal_winding"?(coil.extension||0):0;
        const L2=d>0?stadiumPerim(r,d):2*Math.PI*r;
        const tBase=coil.windingIndex/coil.totalWindings;
        const {dr,dh,nr,nh}=stadiumPt(tBase+tOff/L2,r,d);
        const cR=R+dr+nr*rOff, cY=dh+nh*rOff;
        const pts=[];
        for(let i=0;i<128;i++){const a=(i/128)*2*Math.PI;pts.push(new THREE.Vector3(cR*Math.cos(a),cY,cR*Math.sin(a)));}
        paths.push(orient(pts,coil));
      } else {
        const bp=basePath(coil);
        const cen=new THREE.Vector3();
        bp.forEach(p=>cen.add(p));cen.divideScalar(bp.length);
        const up=new THREE.Vector3(0,1,0);
        const op=bp.map(p=>{
          const rd=p.clone().sub(cen).normalize();
          return p.clone().add(up.clone().multiplyScalar(tOff)).add(rd.multiplyScalar(rOff));
        });
        paths.push(orient(op,coil));
      }
      count++;
    }
  }
  return paths;
}

/* ══════════════════════════════════════════════════════════════
   MESH BUILDERS
   ══════════════════════════════════════════════════════════════ */

function tubeMesh(path,tubeR,color,emissive){
  const curve=new THREE.CatmullRomCurve3(path,true);
  const g=new THREE.TubeGeometry(curve,Math.min(200,Math.max(64,path.length)),tubeR,8,true);
  const m=new THREE.MeshStandardMaterial({color:new THREE.Color(color),emissive:new THREE.Color(emissive?color:"#000"),emissiveIntensity:emissive?.5:0,roughness:.4,metalness:.6});
  return new THREE.Mesh(g,m);
}

function buildCoilMeshes(coil,color,sel,showIndiv){
  const meshes=[];
  const wd=wireDiam(coil.wireGauge);
  const vr=wd/2;
  if(showIndiv&&coil.turns>1){
    turnPaths(coil).slice(0,500).forEach(p=>meshes.push(tubeMesh(p,vr,color,sel)));
  } else {
    const path=fullPath(coil);
    const {layers,tpl}=calcPacking(coil);
    const bW=Math.min(coil.turns,tpl)*wd, bH=layers*wd;
    const bR=coil.turns>1?Math.max(Math.sqrt(bW*bH/Math.PI)/2,vr):vr;
    meshes.push(tubeMesh(path,bR,color,sel));
  }
  return meshes;
}

function ghostTorus(R,r,center,normal){
  const g=new THREE.TorusGeometry(R,r,32,100);
  const m=new THREE.MeshStandardMaterial({color:0xffffff,transparent:true,opacity:.07,side:THREE.DoubleSide,depthWrite:false});
  const mesh=new THREE.Mesh(g,m);
  const n=new THREE.Vector3(...normal).normalize();
  if(n.length()<.001)n.set(0,1,0);
  const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),n);
  const fq=new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI/2,0,0));
  mesh.quaternion.copy(q.multiply(fq));
  mesh.position.set(...center);return mesh;
}

function ghostElongTorus(R,r,ext,center,normal){
  const pts=[];
  for(let i=0;i<=64;i++){const{dr,dh}=stadiumPt(i/64,r,ext);pts.push(new THREE.Vector2(R+dr,dh));}
  const g=new THREE.LatheGeometry(pts,100);
  const m=new THREE.MeshStandardMaterial({color:0xffffff,transparent:true,opacity:.07,side:THREE.DoubleSide,depthWrite:false});
  const mesh=new THREE.Mesh(g,m);
  const n=new THREE.Vector3(...normal).normalize();
  if(n.length()<.001)n.set(0,1,0);
  mesh.quaternion.copy(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),n));
  mesh.position.set(...center);return mesh;
}

/* ── Axis scales: ruler-style ticks + minimal labels ──────── */

function buildScales(maxCm) {
  const g = new THREE.Group();
  const axCfg = [
    { dir:[1,0,0], c:0xef4444, perp1:[0,1,0], perp2:[0,0,1] },
    { dir:[0,1,0], c:0x22c55e, perp1:[1,0,0], perp2:[0,0,1] },
    { dir:[0,0,1], c:0x3b82f6, perp1:[0,1,0], perp2:[1,0,0] }
  ];
  const tickLen5 = 0.004;
  const tickLen10 = 0.007;
  const labelNames = ["X","Y","Z"];

  axCfg.forEach(({dir,c,perp1},ai) => {
    const mat = new THREE.LineBasicMaterial({color:c, transparent:true, opacity:0.35});

    // Main axis line
    const axPts = [
      new THREE.Vector3(-dir[0]*maxCm/100, -dir[1]*maxCm/100, -dir[2]*maxCm/100),
      new THREE.Vector3(dir[0]*maxCm/100, dir[1]*maxCm/100, dir[2]*maxCm/100)
    ];
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(axPts), mat.clone()));

    for (let cm = -maxCm; cm <= maxCm; cm += 5) {
      if (cm === 0) continue;
      const pos = new THREE.Vector3(dir[0]*cm/100, dir[1]*cm/100, dir[2]*cm/100);
      const is10 = cm % 10 === 0;
      const tl = is10 ? tickLen10 : tickLen5;
      const p1 = new THREE.Vector3(perp1[0]*tl, perp1[1]*tl, perp1[2]*tl);

      // Tick
      const tickMat = mat.clone();
      tickMat.opacity = is10 ? 0.4 : 0.2;
      g.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([pos.clone().sub(p1), pos.clone().add(p1)]),
        tickMat
      ));

      // Label only every 10cm
      if (is10) {
        const cv = document.createElement("canvas");
        cv.width = 48; cv.height = 20;
        const ctx = cv.getContext("2d");
        const hex = "#" + c.toString(16).padStart(6, "0");
        ctx.fillStyle = hex;
        ctx.font = "bold 14px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(cm + "", 24, 10);
        const tex = new THREE.CanvasTexture(cv);
        tex.minFilter = THREE.LinearFilter;
        // Use sprite so it always faces camera, but very small
        const spMat = new THREE.SpriteMaterial({map:tex, transparent:true, opacity:0.45, depthTest:false, sizeAttenuation:true});
        const sp = new THREE.Sprite(spMat);
        sp.position.copy(pos).add(new THREE.Vector3(perp1[0]*0.018, perp1[1]*0.018, perp1[2]*0.018));
        sp.scale.set(0.03, 0.013, 1);
        g.add(sp);
      }
    }
  });
  return g;
}

function makeLabel(text, pos, color) {
  const cv = document.createElement("canvas"); cv.width=64; cv.height=64;
  const ctx = cv.getContext("2d"); ctx.fillStyle=color; ctx.font="bold 48px monospace";
  ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(text,32,32);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(cv),depthTest:false,sizeAttenuation:true}));
  s.position.copy(pos); s.scale.set(.06,.06,.06); return s;
}

/* ══════════════════════════════════════════════════════════════
   PHYSICS
   ══════════════════════════════════════════════════════════════ */

function coilCircumference(c) {
  if(c.type==="circular") return 2*Math.PI*c.radius;
  if(c.type==="racetrack") return 2*c.straightLength+2*Math.PI*c.arcRadius;
  if(c.type==="elliptical"){const a=c.semiMajor,b=c.semiMinor,h=((a-b)/(a+b))**2;return Math.PI*(a+b)*(1+3*h/(10+Math.sqrt(4-3*h)));}
  if(c.type==="toroidal_winding"||c.type==="elongated_toroidal_winding"){
    const R=c.majorRadius,r=c.minorRadius,d=c.type==="elongated_toroidal_winding"?(c.extension||0):0;
    const{dr}=stadiumPt(c.windingIndex/c.totalWindings,r,d);
    return 2*Math.PI*(R+dr);
  }
  return 0;
}

function calcStats(coils) {
  let totalLen=0,totalPower=0,totalMass=0;
  coils.forEach(c=>{
    const L=coilCircumference(c)*c.turns;
    const A=Math.PI*(wireDiam(c.wireGauge)/2)**2;
    const R=CU_RHO*L/A;
    totalLen+=L;totalPower+=c.current**2*R;totalMass+=L*A*CU_DENSITY;
  });
  return {totalLen,totalPower,totalMass};
}

function getCoilParams(c) {
  const isTor = c.type==="toroidal_winding"||c.type==="elongated_toroidal_winding";
  let R, cen, norm;
  if (isTor) {
    const mr=c.majorRadius,rr=c.minorRadius,d=c.type==="elongated_toroidal_winding"?(c.extension||0):0;
    const {dr,dh}=stadiumPt(c.windingIndex/c.totalWindings,rr,d);
    R=mr+dr; cen=new THREE.Vector3(0,dh,0); norm=new THREE.Vector3(0,1,0);
    const n2=new THREE.Vector3(...c.normal).normalize();
    const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),n2);
    cen.applyQuaternion(q).add(new THREE.Vector3(...c.center));
    norm.applyQuaternion(q);
  } else if(c.type==="circular"){
    R=c.radius;cen=new THREE.Vector3(...c.center);norm=new THREE.Vector3(...c.normal).normalize();
  } else if(c.type==="racetrack"){
    R=Math.sqrt((c.straightLength*2*c.arcRadius+Math.PI*c.arcRadius**2)/Math.PI);
    cen=new THREE.Vector3(...c.center);norm=new THREE.Vector3(...c.normal).normalize();
  } else if(c.type==="elliptical"){
    R=Math.sqrt(c.semiMajor*c.semiMinor);
    cen=new THREE.Vector3(...c.center);norm=new THREE.Vector3(...c.normal).normalize();
  } else return null;
  return { R, cen, norm, NI: c.turns*c.current };
}

function estimateB(coils, pt) {
  let Bx=0,By=0,Bz=0;
  coils.forEach(c=>{
    const p=getCoilParams(c);if(!p)return;
    const{R,cen,norm,NI}=p;
    const rv=pt.clone().sub(cen);
    const dist=rv.length();
    if(dist<1e-10){const Bm=MU0*NI/(2*R);Bx+=Bm*norm.x;By+=Bm*norm.y;Bz+=Bm*norm.z;return;}
    const z=rv.dot(norm);
    const rPerp=rv.clone().sub(norm.clone().multiplyScalar(z));
    const rho=rPerp.length();
    if(rho<0.01*R){
      const Bm=MU0*NI*R*R/(2*Math.pow(R*R+z*z,1.5));
      Bx+=Bm*norm.x;By+=Bm*norm.y;Bz+=Bm*norm.z;
    } else {
      const m=NI*Math.PI*R*R;
      const mV=norm.clone().multiplyScalar(m);
      const rH=rv.clone().normalize();
      const md=mV.dot(rH);
      const co=MU0/(4*Math.PI*dist**3);
      Bx+=co*(3*md*rH.x-mV.x);By+=co*(3*md*rH.y-mV.y);Bz+=co*(3*md*rH.z-mV.z);
    }
  });
  return new THREE.Vector3(Bx,By,Bz);
}

function fmtB(v){
  if(v<1e-9) return (v*1e12).toFixed(2)+" pT";
  if(v<1e-6) return (v*1e9).toFixed(2)+" nT";
  if(v<1e-3) return (v*1e6).toFixed(2)+" µT";
  if(v<1) return (v*1e3).toFixed(2)+" mT";
  return v.toFixed(4)+" T";
}

/* ══════════════════════════════════════════════════════════════
   FIELD LINES — colored by |B| strength, tube geometry
   ══════════════════════════════════════════════════════════════ */

function strengthToColor(t) {
  // t in [0,1]: 0=weak(blue), 0.25=cyan, 0.5=green, 0.75=yellow, 1=red
  if (t < 0.25) { const s=t/0.25; return new THREE.Color(0, s, 1); }
  if (t < 0.5)  { const s=(t-0.25)/0.25; return new THREE.Color(0, 1, 1-s); }
  if (t < 0.75) { const s=(t-0.5)/0.25; return new THREE.Color(s, 1, 0); }
  const s=(t-0.75)/0.25; return new THREE.Color(1, 1-s, 0);
}

function traceFieldLine(coils, start, steps, ds) {
  const pts = []; const mags = [];
  const p = start.clone();
  for (let i = 0; i < steps; i++) {
    const B = estimateB(coils, p);
    const mag = B.length();
    pts.push(p.clone());
    mags.push(mag);
    if (mag < 1e-15) break;
    B.normalize().multiplyScalar(ds);
    p.add(B);
    if (p.length() > 2) break;
  }
  return { pts, mags };
}

function generateFieldLines(coils, density) {
  const lines = [];
  if (coils.length === 0) return lines;
  const seedDists = [0.02, 0.05, 0.1, 0.15, 0.25];
  const heights = [-0.15, -0.08, 0, 0.08, 0.15];
  const nAround = Math.max(4, density);
  const ds = 0.005;
  const steps = 400;

  heights.forEach(y => {
    seedDists.forEach(r => {
      for (let i = 0; i < nAround; i++) {
        const theta = (i/nAround)*2*Math.PI;
        const seed = new THREE.Vector3(r*Math.cos(theta), y, r*Math.sin(theta));
        const fwd = traceFieldLine(coils, seed, steps, ds);
        if (fwd.pts.length > 5) lines.push(fwd);
        const bwd = traceFieldLine(coils, seed, steps, -ds);
        if (bwd.pts.length > 5) lines.push(bwd);
      }
    });
  });
  return lines;
}

function buildFieldLineMeshes(fieldLines) {
  const group = new THREE.Group();
  if (fieldLines.length === 0) return group;

  // Find global min/max |B| for color normalization
  let globalMin = Infinity, globalMax = -Infinity;
  fieldLines.forEach(({mags}) => {
    mags.forEach(m => { if(m>1e-15){if(m<globalMin)globalMin=m;if(m>globalMax)globalMax=m;} });
  });
  if (globalMin >= globalMax) { globalMin = 0; globalMax = 1; }
  // Use log scale for better contrast
  const logMin = Math.log10(Math.max(globalMin, 1e-15));
  const logMax = Math.log10(Math.max(globalMax, 1e-14));
  const logRange = logMax - logMin || 1;

  const tubeRadius = 0.0015;

  fieldLines.forEach(({pts, mags}) => {
    if (pts.length < 3) return;

    // Build curve
    const curve = new THREE.CatmullRomCurve3(pts, false);
    const tubSegs = Math.min(pts.length * 2, 200);
    const geom = new THREE.TubeGeometry(curve, tubSegs, tubeRadius, 5, false);

    // Color each vertex by field strength at nearest point
    const posAttr = geom.getAttribute("position");
    const colorArr = new Float32Array(posAttr.count * 3);
    for (let vi = 0; vi < posAttr.count; vi++) {
      const vx = posAttr.getX(vi), vy = posAttr.getY(vi), vz = posAttr.getZ(vi);
      // Find nearest original point
      let bestIdx = 0, bestDist = Infinity;
      for (let pi = 0; pi < pts.length; pi++) {
        const dx = vx-pts[pi].x, dy = vy-pts[pi].y, dz = vz-pts[pi].z;
        const d2 = dx*dx+dy*dy+dz*dz;
        if (d2 < bestDist) { bestDist=d2; bestIdx=pi; }
      }
      const mag = mags[bestIdx] || 0;
      const logMag = Math.log10(Math.max(mag, 1e-15));
      const t = Math.max(0, Math.min(1, (logMag - logMin) / logRange));
      const col = strengthToColor(t);
      colorArr[vi*3] = col.r; colorArr[vi*3+1] = col.g; colorArr[vi*3+2] = col.b;
    }
    geom.setAttribute("color", new THREE.Float32BufferAttribute(colorArr, 3));

    const mat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
    });
    group.add(new THREE.Mesh(geom, mat));
  });
  return group;
}

/* ══════════════════════════════════════════════════════════════
   CLAUDE API
   ══════════════════════════════════════════════════════════════ */

const SYS_PROMPT=`You are a coil geometry interpreter. Parse plain-English descriptions into a JSON array.

COORDINATE SYSTEM: right-handed, Y up. Units: metres. All geometries centered at origin unless stated otherwise.

COIL TYPES:
1. "circular" — planar circular loop.
2. "racetrack" — two straight segments + semicircular arcs.
3. "elliptical" — planar elliptical loop.
4. "toroidal_winding" — wire on torus surface, toroidal direction, fixed poloidal angle. N windings = N coils with windingIndex 0..N-1.
   majorRadius=(innerRadius+outerRadius)/2, minorRadius=(outerRadius-innerRadius)/2.
5. "elongated_toroidal_winding" — same but cross-section is stadium. extension = straight wall length.

Each coil MUST have ALL fields:
{"type":"...","name":"...","center":[x,y,z],"normal":[nx,ny,nz],"radius":0.5,"semiMajor":0.5,"semiMinor":0.3,"straightLength":0.6,"arcRadius":0.3,"majorRadius":0.1,"minorRadius":0.05,"extension":0.0,"windingIndex":0,"totalWindings":12,"turns":100,"current":10.0,"wireGauge":14,"channelWidth":0.01}

Defaults: turns=100,current=10,wireGauge=14,normal=[0,1,0],channelWidth=0.01,center=[0,0,0].
Respond ONLY with valid JSON array.`;

async function parseWithClaude(prompt){
  const res=await fetch("/api/parse",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:8000,system:SYS_PROMPT,messages:[{role:"user",content:prompt}]})});
  const data=await res.json();
  const text=data.content?.map(b=>b.text||"").join("")||"";
  return JSON.parse(text.replace(/```json|```/g,"").trim());
}

/* ══════════════════════════════════════════════════════════════
   UI COMPONENTS
   ══════════════════════════════════════════════════════════════ */

function Num({label,value,onChange,step=0.01}){
  return(<label className="flex items-center gap-1 text-xs text-gray-300">
    <span className="w-24 text-right text-gray-500 shrink-0">{label}</span>
    <input type="number" step={step} value={value} onChange={e=>onChange(parseFloat(e.target.value)||0)}
      className="w-20 bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-gray-200 text-xs focus:border-blue-500 outline-none"/>
  </label>);
}

function Vec3({label,value,onChange}){
  const s=(i,v)=>{const a=[...value];a[i]=v;onChange(a);};
  return(<div className="flex flex-col gap-0.5"><span className="text-xs text-gray-500 ml-1">{label}</span>
    <div className="flex gap-1 ml-1">{["x","y","z"].map((ax,i)=>(
      <label key={ax} className="flex items-center gap-0.5 text-xs text-gray-400">{ax}
        <input type="number" step={0.01} value={value[i]} onChange={e=>s(i,parseFloat(e.target.value)||0)}
          className="w-14 bg-gray-800 border border-gray-700 rounded px-1 py-0.5 text-gray-200 text-xs focus:border-blue-500 outline-none"/>
      </label>))}</div></div>);
}

function CoilCard({coil,index,selected,multiSelected,onSelect,onShiftSelect,onUpdate,onDelete,onDuplicate}){
  const[open,setOpen]=useState(false);
  const color=COLORS[index%COLORS.length];
  const set=(k,v)=>onUpdate({...coil,[k]:v});
  const isTor=coil.type==="toroidal_winding"||coil.type==="elongated_toroidal_winding";
  const pk=calcPacking(coil);
  const highlight=selected||multiSelected;
  return(
    <div className={`border rounded-lg overflow-hidden mb-1.5 transition-colors ${highlight?"border-blue-500 bg-gray-800/60":"border-gray-700 bg-gray-900/40"}`}>
      <div className="flex items-center gap-2 px-3 py-1.5 cursor-pointer"
        onClick={e=>{if(e.shiftKey)onShiftSelect(coil.id);else{onSelect(coil.id);setOpen(!open);}}}> 
        <div className="w-3 h-3 rounded-full shrink-0" style={{backgroundColor:color}}/>
        <input value={coil.name} onChange={e=>set("name",e.target.value)} onClick={e=>e.stopPropagation()}
          className="flex-1 bg-transparent text-sm text-gray-200 font-medium outline-none"/>
        <span className="text-gray-600 text-xs">{open?"▾":"▸"}</span>
      </div>
      {open&&(
        <div className="px-3 pb-2 flex flex-col gap-1.5 text-xs" onClick={e=>e.stopPropagation()}>
          <label className="flex items-center gap-1 text-gray-400">
            <span className="w-24 text-right text-gray-500">Type</span>
            <select value={coil.type} onChange={e=>set("type",e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-gray-200 text-xs outline-none">
              <option value="circular">Circular</option><option value="racetrack">Racetrack</option>
              <option value="elliptical">Elliptical</option><option value="toroidal_winding">Toroidal Winding</option>
              <option value="elongated_toroidal_winding">Elongated Toroidal</option>
            </select>
          </label>
          <Vec3 label="Center (m)" value={coil.center} onChange={v=>set("center",v)}/>
          <Vec3 label="Normal" value={coil.normal} onChange={v=>set("normal",v)}/>
          {coil.type==="circular"&&<Num label="Radius (m)" value={coil.radius} onChange={v=>set("radius",v)}/>}
          {coil.type==="racetrack"&&<><Num label="Straight (m)" value={coil.straightLength} onChange={v=>set("straightLength",v)}/>
            <Num label="Arc R (m)" value={coil.arcRadius} onChange={v=>set("arcRadius",v)}/></>}
          {coil.type==="elliptical"&&<><Num label="Semi-maj (m)" value={coil.semiMajor} onChange={v=>set("semiMajor",v)}/>
            <Num label="Semi-min (m)" value={coil.semiMinor} onChange={v=>set("semiMinor",v)}/></>}
          {isTor&&<><Num label="Major R (m)" value={coil.majorRadius} onChange={v=>set("majorRadius",v)}/>
            <Num label="Minor R (m)" value={coil.minorRadius} onChange={v=>set("minorRadius",v)}/>
            {coil.type==="elongated_toroidal_winding"&&<Num label="Extension (m)" value={coil.extension} onChange={v=>set("extension",v)}/>}
            <Num label="Winding #" value={coil.windingIndex} onChange={v=>set("windingIndex",v)} step={1}/>
            <Num label="Total winds" value={coil.totalWindings} onChange={v=>set("totalWindings",v)} step={1}/></>}
          <div className="border-t border-gray-800 pt-1.5 mt-1"/>
          <Num label="Turns" value={coil.turns} onChange={v=>set("turns",v)} step={1}/>
          <Num label="Current (A)" value={coil.current} onChange={v=>set("current",v)} step={0.1}/>
          <Num label="AWG" value={coil.wireGauge} onChange={v=>set("wireGauge",v)} step={1}/>
          <Num label="Channel (m)" value={coil.channelWidth} onChange={v=>set("channelWidth",v)} step={0.001}/>
          <div className="bg-gray-800/50 rounded px-2 py-1 text-gray-500 text-xs">
            Wire: {(pk.wd*1000).toFixed(2)}mm | {pk.tpl}/layer | {pk.layers} layers
          </div>
          <div className="flex gap-2 mt-1">
            <button onClick={()=>onDuplicate(coil.id)} className="text-blue-400 hover:text-blue-300 text-xs">Duplicate</button>
            <button onClick={()=>onDelete(coil.id)} className="text-red-400 hover:text-red-300 text-xs ml-auto">Delete</button>
          </div>
        </div>
      )}
    </div>
  );
}

function UniversalPanel({onApply}){
  const[vals,setVals]=useState({turns:100,current:10,wireGauge:14,channelWidth:0.01});
  const[fields,setFields]=useState({turns:true,current:true,wireGauge:true,channelWidth:true});
  const s=(k,v)=>setVals(p=>({...p,[k]:v}));
  const f=(k)=>setFields(p=>({...p,[k]:!p[k]}));
  return(
    <div className="border-t border-gray-800 px-3 py-2 bg-gray-900/30">
      <span className="text-xs text-gray-400 font-medium">Apply to All / Selected</span>
      <div className="flex flex-col gap-1 mt-1.5">
        {[["turns","Turns",1],["current","Current (A)",0.1],["wireGauge","AWG",1],["channelWidth","Channel (m)",0.001]].map(([k,l,st])=>(
          <div key={k} className="flex items-center gap-1">
            <input type="checkbox" checked={fields[k]} onChange={()=>f(k)} className="rounded border-gray-600"/>
            <Num label={l} value={vals[k]} onChange={v=>s(k,v)} step={st}/>
          </div>
        ))}
        <button onClick={()=>onApply(vals,fields)}
          className="mt-1 px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded self-start">Apply</button>
      </div>
    </div>
  );
}

function InfoBox({coils,show,setShow}){
  if(!show||coils.length===0) return(
    <button onClick={()=>setShow(true)} className="absolute bottom-3 right-3 px-2 py-1 bg-gray-800/80 text-gray-400 text-xs rounded hover:bg-gray-700 z-10">Stats</button>
  );
  const stats=calcStats(coils);
  const bO=estimateB(coils,new THREE.Vector3(0,0,0));
  const b30=estimateB(coils,new THREE.Vector3(0.3,0,0));
  return(
    <div className="absolute bottom-3 right-3 bg-gray-900/95 border border-gray-700 rounded-lg p-3 text-xs text-gray-300 z-10 min-w-56 max-w-72">
      <div className="flex justify-between items-center mb-2">
        <span className="font-medium text-gray-200">Stats</span>
        <button onClick={()=>setShow(false)} className="text-gray-500 hover:text-gray-300">✕</button>
      </div>
      <div className="flex flex-col gap-1">
        <div>Wire: <span className="text-gray-100">{stats.totalLen<1?(stats.totalLen*100).toFixed(1)+" cm":stats.totalLen.toFixed(2)+" m"}</span></div>
        <div>Cu mass: <span className="text-gray-100">{stats.totalMass<1?(stats.totalMass*1000).toFixed(1)+" g":stats.totalMass.toFixed(3)+" kg"}</span></div>
        <div>Power: <span className="text-gray-100">{stats.totalPower<1?(stats.totalPower*1000).toFixed(2)+" mW":stats.totalPower.toFixed(3)+" W"}</span></div>
        <div className="border-t border-gray-800 pt-1 mt-1"/>
        <div>|B| origin: <span className="text-yellow-300">{fmtB(bO.length())}</span></div>
        <div>|B| 30cm: <span className="text-yellow-300">{fmtB(b30.length())}</span></div>
        <div className="text-gray-600 mt-1 italic">Dipole/on-axis approx.</div>
      </div>
    </div>
  );
}

function SaveLoadPanel({coils,onLoad}){
  const[name,setName]=useState("");
  const[open,setOpen]=useState(false);
  const[,refresh]=useState(0);
  const getSaved=()=>{try{return JSON.parse(localStorage.getItem("coilConfigs")||"{}");}catch{return{};}};
  const save=()=>{if(!name.trim())return;const s=getSaved();s[name.trim()]=coils.map(({id,...r})=>r);localStorage.setItem("coilConfigs",JSON.stringify(s));setName("");refresh(n=>n+1);};
  const load=(k)=>{const s=getSaved();if(s[k])onLoad(s[k].map(c=>defaultCoil(c)));};
  const del=(k)=>{const s=getSaved();delete s[k];localStorage.setItem("coilConfigs",JSON.stringify(s));refresh(n=>n+1);};
  const keys=Object.keys(getSaved());
  return(
    <div className="border-t border-gray-800 px-3 py-2 bg-gray-900/30">
      <div className="flex items-center justify-between cursor-pointer" onClick={()=>setOpen(!open)}>
        <span className="text-xs text-gray-400 font-medium">Save / Load</span>
        <span className="text-gray-600 text-xs">{open?"▾":"▸"}</span>
      </div>
      {open&&(
        <div className="mt-1.5 flex flex-col gap-1.5">
          <div className="flex gap-1">
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="Config name..."
              className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-gray-200 text-xs outline-none"/>
            <button onClick={save} className="px-2 py-0.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded">Save</button>
          </div>
          {keys.length>0&&<div className="flex flex-col gap-0.5 max-h-24 overflow-y-auto">
            {keys.map(k=>(
              <div key={k} className="flex items-center justify-between bg-gray-800/50 rounded px-2 py-0.5">
                <button onClick={()=>load(k)} className="text-xs text-gray-300 hover:text-white">{k}</button>
                <button onClick={()=>del(k)} className="text-red-500 hover:text-red-400 text-xs">✕</button>
              </div>
            ))}
          </div>}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN APP
   ══════════════════════════════════════════════════════════════ */

export default function App(){
  const[coils,setCoils]=useState([]);
  const[selectedId,setSelectedId]=useState(null);
  const[multiSel,setMultiSel]=useState(new Set());
  const[prompt,setPrompt]=useState("");
  const[loading,setLoading]=useState(false);
  const[error,setError]=useState(null);
  const[showScales,setShowScales]=useState(true);
  const[showIndiv,setShowIndiv]=useState(false);
  const[showStats,setShowStats]=useState(true);
  const[showField,setShowField]=useState(false);
  const[fieldDensity,setFieldDensity]=useState(6);
  const[fieldLoading,setFieldLoading]=useState(false);

  const histRef=useRef([[]]);
  const histIdx=useRef(0);
  const skipHist=useRef(false);

  const pushCoils=useCallback((nc)=>{
    if(!skipHist.current){
      histRef.current=histRef.current.slice(0,histIdx.current+1);
      histRef.current.push(JSON.parse(JSON.stringify(nc)));
      histIdx.current++;
    }
    setCoils(nc);
  },[]);

  useEffect(()=>{
    const handler=(e)=>{
      if((e.metaKey||e.ctrlKey)&&e.key==="z"){
        e.preventDefault();skipHist.current=true;
        if(e.shiftKey){if(histIdx.current<histRef.current.length-1){histIdx.current++;setCoils(JSON.parse(JSON.stringify(histRef.current[histIdx.current])));}}
        else{if(histIdx.current>0){histIdx.current--;setCoils(JSON.parse(JSON.stringify(histRef.current[histIdx.current])));}}
        setTimeout(()=>{skipHist.current=false;},0);
      }
    };
    window.addEventListener("keydown",handler);
    return()=>window.removeEventListener("keydown",handler);
  },[]);

  const containerRef=useRef(null);
  const sceneRef=useRef(null);
  const cameraRef=useRef(null);
  const rendererRef=useRef(null);
  const coilGroupRef=useRef(null);
  const fieldGroupRef=useRef(null);
  const scaleGroupRef=useRef(null);
  const frameRef=useRef(null);
  const orbitRef=useRef({theta:Math.PI/4,phi:Math.PI/3,dist:1.5,target:new THREE.Vector3(),dragging:false,panning:false,lastX:0,lastY:0});

  useEffect(()=>{
    const el=containerRef.current;if(!el)return;
    const scene=new THREE.Scene();scene.background=new THREE.Color("#0d1117");sceneRef.current=scene;
    const camera=new THREE.PerspectiveCamera(50,el.clientWidth/el.clientHeight,.001,200);cameraRef.current=camera;
    const renderer=new THREE.WebGLRenderer({antialias:true});
    renderer.setSize(el.clientWidth,el.clientHeight);renderer.setPixelRatio(window.devicePixelRatio);
    el.appendChild(renderer.domElement);rendererRef.current=renderer;

    scene.add(new THREE.AmbientLight(0xffffff,.5));
    const d=new THREE.DirectionalLight(0xffffff,.8);d.position.set(3,5,4);scene.add(d);
    scene.add(new THREE.HemisphereLight(0x4488ff,0x222244,.3));
    scene.add(new THREE.GridHelper(2,40,0x222222,0x161625));
    scene.add(new THREE.AxesHelper(.5));
    scene.add(makeLabel("X",new THREE.Vector3(.55,0,0),"#ef4444"));
    scene.add(makeLabel("Y",new THREE.Vector3(0,.55,0),"#22c55e"));
    scene.add(makeLabel("Z",new THREE.Vector3(0,0,.55),"#3b82f6"));

    const cg=new THREE.Group();scene.add(cg);coilGroupRef.current=cg;
    const fg=new THREE.Group();fg.visible=false;scene.add(fg);fieldGroupRef.current=fg;
    const sg=buildScales(50);scene.add(sg);scaleGroupRef.current=sg;

    const o=orbitRef.current;
    camera.position.set(o.target.x+o.dist*Math.sin(o.phi)*Math.cos(o.theta),o.target.y+o.dist*Math.cos(o.phi),o.target.z+o.dist*Math.sin(o.phi)*Math.sin(o.theta));
    camera.lookAt(o.target);

    function animate(){frameRef.current=requestAnimationFrame(animate);renderer.render(scene,camera);}
    animate();

    const onResize=()=>{camera.aspect=el.clientWidth/el.clientHeight;camera.updateProjectionMatrix();renderer.setSize(el.clientWidth,el.clientHeight);};
    window.addEventListener("resize",onResize);
    return()=>{cancelAnimationFrame(frameRef.current);window.removeEventListener("resize",onResize);renderer.dispose();if(el.contains(renderer.domElement))el.removeChild(renderer.domElement);};
  },[]);

  useEffect(()=>{
    const el=containerRef.current;if(!el)return;
    function updateCam(){
      const o=orbitRef.current,cam=cameraRef.current;if(!cam)return;
      cam.position.set(o.target.x+o.dist*Math.sin(o.phi)*Math.cos(o.theta),o.target.y+o.dist*Math.cos(o.phi),o.target.z+o.dist*Math.sin(o.phi)*Math.sin(o.theta));
      cam.lookAt(o.target);
    }
    const onDown=e=>{
      if(e.button===2||e.shiftKey)orbitRef.current.panning=true;
      else orbitRef.current.dragging=true;
      orbitRef.current.lastX=e.clientX;orbitRef.current.lastY=e.clientY;
    };
    const onMove=e=>{
      const o=orbitRef.current;
      const dx=e.clientX-o.lastX,dy=e.clientY-o.lastY;
      if(o.dragging){o.theta-=dx*.005;o.phi=Math.max(.1,Math.min(Math.PI-.1,o.phi-dy*.005));}
      else if(o.panning){
        const cam=cameraRef.current;if(!cam)return;
        const fwd=new THREE.Vector3();cam.getWorldDirection(fwd);
        const right=new THREE.Vector3().crossVectors(fwd,cam.up).normalize();
        const up=new THREE.Vector3().crossVectors(right,fwd).normalize();
        const ps=o.dist*.001;
        o.target.add(right.multiplyScalar(-dx*ps)).add(up.multiplyScalar(dy*ps));
      }
      o.lastX=e.clientX;o.lastY=e.clientY;
      if(o.dragging||o.panning)updateCam();
    };
    const onUp=()=>{orbitRef.current.dragging=false;orbitRef.current.panning=false;};
    const onWheel=e=>{e.preventDefault();orbitRef.current.dist=Math.max(.01,Math.min(50,orbitRef.current.dist*(e.deltaY>0?1.08:1/1.08)));updateCam();};
    const onCtx=e=>e.preventDefault();
    el.addEventListener("mousedown",onDown);window.addEventListener("mousemove",onMove);
    window.addEventListener("mouseup",onUp);el.addEventListener("wheel",onWheel,{passive:false});
    el.addEventListener("contextmenu",onCtx);
    return()=>{el.removeEventListener("mousedown",onDown);window.removeEventListener("mousemove",onMove);window.removeEventListener("mouseup",onUp);el.removeEventListener("wheel",onWheel);el.removeEventListener("contextmenu",onCtx);};
  },[]);

  useEffect(()=>{if(scaleGroupRef.current)scaleGroupRef.current.visible=showScales;},[showScales]);

  useEffect(()=>{
    const cg=coilGroupRef.current;if(!cg)return;
    while(cg.children.length){const c=cg.children[0];if(c.geometry)c.geometry.dispose();if(c.material)c.material.dispose();cg.remove(c);}
    coils.forEach((coil,i)=>{
      try{
        const sel=coil.id===selectedId||multiSel.has(coil.id);
        buildCoilMeshes(coil,COLORS[i%COLORS.length],sel,showIndiv).forEach(m=>cg.add(m));
      }catch(e){console.warn(e);}
    });
    const tk=new Map();
    coils.filter(c=>c.type==="toroidal_winding"||c.type==="elongated_toroidal_winding").forEach(c=>{
      const k=`${c.type}_${c.majorRadius}_${c.minorRadius}_${c.extension||0}_${c.center}_${c.normal}`;
      if(!tk.has(k))tk.set(k,c);
    });
    tk.forEach(c=>{
      try{
        if(c.type==="elongated_toroidal_winding"&&c.extension>0)cg.add(ghostElongTorus(c.majorRadius,c.minorRadius,c.extension,c.center,c.normal));
        else cg.add(ghostTorus(c.majorRadius,c.minorRadius,c.center,c.normal));
      }catch(e){console.warn(e);}
    });
  },[coils,selectedId,multiSel,showIndiv]);

  useEffect(()=>{
    const fg=fieldGroupRef.current;if(!fg)return;
    while(fg.children.length){const c=fg.children[0];if(c.geometry)c.geometry.dispose();if(c.material)c.material.dispose();fg.remove(c);}
    if(showField&&coils.length>0){
      setFieldLoading(true);
      setTimeout(()=>{
        const lines=generateFieldLines(coils,fieldDensity);
        const meshGroup=buildFieldLineMeshes(lines);
        meshGroup.children.forEach(c=>fg.add(c));
        fg.visible=true;
        setFieldLoading(false);
      },50);
    } else { fg.visible=false; setFieldLoading(false); }
  },[showField,coils,fieldDensity]);

  const fitView=useCallback(()=>{
    if(coils.length===0)return;
    const box=new THREE.Box3();
    coils.forEach(c=>{fullPath(c).forEach(p=>box.expandByPoint(p));});
    const center=new THREE.Vector3();box.getCenter(center);
    const size=box.getSize(new THREE.Vector3()).length();
    const o=orbitRef.current;o.target.copy(center);o.dist=Math.max(size*1.2,.1);
    const cam=cameraRef.current;if(!cam)return;
    cam.position.set(o.target.x+o.dist*Math.sin(o.phi)*Math.cos(o.theta),o.target.y+o.dist*Math.cos(o.phi),o.target.z+o.dist*Math.sin(o.phi)*Math.sin(o.theta));
    cam.lookAt(o.target);
  },[coils]);

  const addCoil=()=>{const c=defaultCoil();pushCoils([...coils,c]);setSelectedId(c.id);};
  const updateCoil=u=>pushCoils(coils.map(c=>c.id===u.id?u:c));
  const deleteCoil=id=>{pushCoils(coils.filter(c=>c.id!==id));if(selectedId===id)setSelectedId(null);setMultiSel(s=>{const n=new Set(s);n.delete(id);return n;});};
  const duplicateCoil=id=>{const src=coils.find(c=>c.id===id);if(!src)return;const dup=defaultCoil({...src,name:src.name+" copy"});pushCoils([...coils,dup]);setSelectedId(dup.id);};
  const shiftSelect=id=>{setMultiSel(s=>{const n=new Set(s);if(n.has(id))n.delete(id);else n.add(id);return n;});};

  const applyUniversal=(vals,fields)=>{
    const targets=multiSel.size>0?coils.filter(c=>multiSel.has(c.id)||c.id===selectedId):coils;
    const ids=new Set(targets.map(c=>c.id));
    pushCoils(coils.map(c=>{
      if(!ids.has(c.id))return c;
      const u={...c};
      if(fields.turns)u.turns=vals.turns;if(fields.current)u.current=vals.current;
      if(fields.wireGauge)u.wireGauge=vals.wireGauge;if(fields.channelWidth)u.channelWidth=vals.channelWidth;
      return u;
    }));
  };

  const handleParse=async()=>{
    if(!prompt.trim())return;setLoading(true);setError(null);
    try{
      const parsed=await parseWithClaude(prompt);
      if(!Array.isArray(parsed))throw new Error("Expected JSON array");
      const nc=parsed.map(p=>defaultCoil(p));
      pushCoils(nc);setSelectedId(nc[0]?.id||null);setMultiSel(new Set());
    }catch(e){setError("Parse failed: "+e.message);}
    finally{setLoading(false);}
  };

  const exportConfig=()=>{
    const cfg=coils.map(({id,...r})=>r);
    const a=document.createElement("a");
    a.href=URL.createObjectURL(new Blob([JSON.stringify(cfg,null,2)],{type:"application/json"}));
    a.download="coil_config.json";a.click();
  };

  return(
    <div className="flex flex-col h-screen bg-gray-950 text-gray-200 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-900 border-b border-gray-800 shrink-0">
        <input value={prompt} onChange={e=>setPrompt(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&handleParse()}
          placeholder="Describe your coil geometry in plain English..."
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-gray-200 placeholder-gray-500 outline-none focus:border-blue-500"/>
        <button onClick={handleParse} disabled={loading||!prompt.trim()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium rounded-lg shrink-0">
          {loading?"Parsing...":"Parse with Claude"}
        </button>
      </div>
      {error&&<div className="px-4 py-1.5 bg-red-900/30 border-b border-red-800 text-red-300 text-xs">{error}</div>}

      <div className="flex flex-1 overflow-hidden">
        <div className="w-72 bg-gray-900/50 border-r border-gray-800 flex flex-col overflow-hidden shrink-0">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
            <span className="text-sm font-medium text-gray-300">Coils ({coils.length})</span>
            <div className="flex gap-1">
              <button onClick={addCoil} className="px-2 py-0.5 bg-gray-800 hover:bg-gray-700 text-xs text-gray-300 rounded">+ Add</button>
              <button onClick={fitView} className="px-2 py-0.5 bg-gray-800 hover:bg-gray-700 text-xs text-gray-300 rounded">Fit</button>
              {coils.length>0&&<button onClick={exportConfig} className="px-2 py-0.5 bg-gray-800 hover:bg-gray-700 text-xs text-gray-300 rounded">Export</button>}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {coils.length===0&&<div className="text-center text-gray-600 text-xs mt-8 px-4 leading-relaxed">Describe coils above, or click + Add.</div>}
            {coils.map((c,i)=><CoilCard key={c.id} coil={c} index={i}
              selected={c.id===selectedId} multiSelected={multiSel.has(c.id)}
              onSelect={id=>{setSelectedId(id);setMultiSel(new Set());}}
              onShiftSelect={shiftSelect} onUpdate={updateCoil}
              onDelete={deleteCoil} onDuplicate={duplicateCoil}/>)}
          </div>

          <div className="border-t border-gray-800 px-3 py-2 bg-gray-900/30 flex flex-col gap-1">
            <span className="text-xs text-gray-400 font-medium">Display</span>
            <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
              <input type="checkbox" checked={showScales} onChange={e=>setShowScales(e.target.checked)} className="rounded border-gray-600"/>
              Axis scales (cm)
            </label>
            <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
              <input type="checkbox" checked={showIndiv} onChange={e=>setShowIndiv(e.target.checked)} className="rounded border-gray-600"/>
              Individual turns
            </label>
            <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
              <input type="checkbox" checked={showField} onChange={e=>setShowField(e.target.checked)} className="rounded border-gray-600"/>
              Field lines {fieldLoading&&<span className="text-yellow-500">(computing...)</span>}
            </label>
            {showField&&(
              <label className="flex flex-col gap-0.5 text-xs text-gray-500 ml-5">
                <span>Density: {fieldDensity}</span>
                <input type="range" min="3" max="16" step="1" value={fieldDensity}
                  onChange={e=>setFieldDensity(parseInt(e.target.value))}
                  className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"/>
              </label>
            )}
          </div>

          <UniversalPanel onApply={applyUniversal}/>
          <SaveLoadPanel coils={coils} onLoad={(nc)=>{pushCoils(nc);setSelectedId(nc[0]?.id||null);}}/>
        </div>

        <div className="flex-1 relative">
          <div ref={containerRef} className="absolute inset-0"/>
          <InfoBox coils={coils} show={showStats} setShow={setShowStats}/>
          <div className="absolute bottom-3 left-3 text-xs text-gray-600 pointer-events-none select-none">
            Drag: rotate · Shift+drag: pan · Scroll: zoom · Cmd+Z: undo
          </div>
          <div className="absolute top-3 right-3 text-xs text-gray-600 pointer-events-none select-none bg-gray-900/60 rounded px-2 py-1">
            <span className="text-red-400">X</span> <span className="text-green-400">Y</span>(up) <span className="text-blue-400">Z</span> · cm
          </div>
        </div>
      </div>
    </div>
  );
}