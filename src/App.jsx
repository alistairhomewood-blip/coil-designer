import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import * as THREE from "three";

/* ══════════════════════════════════════════════════════════════
   CONSTANTS — enamelled copper wire
   ══════════════════════════════════════════════════════════════ */

const COLORS = [
  "#3b82f6","#ef4444","#22c55e","#f59e0b","#8b5cf6",
  "#ec4899","#06b6d4","#f97316","#a3e635","#fb923c"
];

// AWG: bare diameter (mm), enamel outer diameter (mm)
const AWG_TABLE = {
  4:{bare:5.189,enamel:5.385}, 6:{bare:4.115,enamel:4.305},
  8:{bare:3.264,enamel:3.429}, 10:{bare:2.588,enamel:2.741},
  12:{bare:2.053,enamel:2.184}, 14:{bare:1.628,enamel:1.753},
  16:{bare:1.291,enamel:1.397}, 18:{bare:1.024,enamel:1.118},
  20:{bare:0.812,enamel:0.894}, 22:{bare:0.644,enamel:0.714},
  24:{bare:0.511,enamel:0.572}, 26:{bare:0.405,enamel:0.457},
  28:{bare:0.321,enamel:0.366}, 30:{bare:0.255,enamel:0.295},
  32:{bare:0.202,enamel:0.241}
};
function wireBare(awg){return(AWG_TABLE[awg]||AWG_TABLE[14]).bare/1000;}
function wireEnamel(awg){return(AWG_TABLE[awg]||AWG_TABLE[14]).enamel/1000;}

const MU0=4*Math.PI*1e-7;
const CU_RHO=1.68e-8;
const CU_DENSITY=8960;
const BIOT_SEGS=128;

let _id=1;
function mkId(){return _id++;}

function defaultCoil(o={}){
  const id=o.id||mkId();
  return{
    id,type:"circular",name:`Coil ${id}`,
    center:[0,0,0],normal:[0,1,0],
    radius:0.5,semiMajor:0.5,semiMinor:0.3,
    straightLength:0.6,arcRadius:0.3,
    majorRadius:0.1,minorRadius:0.05,extension:0,
    windingIndex:0,totalWindings:12,
    turns:100,current:10,wireGauge:14,channelWidth:0.01,
    ...o,id
  };
}

function calcPacking(c){
  const wd=wireEnamel(c.wireGauge);
  const cw=c.channelWidth||0.01;
  const tpl=Math.max(1,Math.floor(cw/wd));
  const layers=Math.ceil(c.turns/tpl);
  return{wd,cw,tpl,layers,bare:wireBare(c.wireGauge)};
}

/* ══════════════════════════════════════════════════════════════
   STADIUM GEOMETRY
   ══════════════════════════════════════════════════════════════ */

function stadiumPerim(r,d){return 2*Math.PI*r+2*d;}

function stadiumPt(t,r,d){
  if(d<=0){const a=t*2*Math.PI;return{dr:r*Math.cos(a),dh:r*Math.sin(a),nr:Math.cos(a),nh:Math.sin(a)};}
  const L=stadiumPerim(r,d);let s=(((t%1)+1)%1)*L;
  const s1=Math.PI*r,s2=s1+d,s3=s2+Math.PI*r;
  if(s<s1){const a=s/r;return{dr:r*Math.cos(a),dh:d/2+r*Math.sin(a),nr:Math.cos(a),nh:Math.sin(a)};}
  if(s<s2){return{dr:-r,dh:d/2-(s-s1),nr:-1,nh:0};}
  if(s<s3){const a=Math.PI+(s-s2)/r;return{dr:r*Math.cos(a),dh:-d/2+r*Math.sin(a),nr:Math.cos(a),nh:Math.sin(a)};}
  return{dr:r,dh:-d/2+(s-s3),nr:1,nh:0};
}

/* ══════════════════════════════════════════════════════════════
   PATH GENERATION
   ══════════════════════════════════════════════════════════════ */

function basePath(c,N=200){
  const pts=[];
  if(c.type==="circular"){
    for(let i=0;i<N;i++){const t=(i/N)*2*Math.PI;pts.push(new THREE.Vector3(c.radius*Math.cos(t),0,c.radius*Math.sin(t)));}
  }else if(c.type==="racetrack"){
    const L=c.straightLength/2,R=c.arcRadius,seg=N/4|0;
    for(let i=0;i<seg;i++)pts.push(new THREE.Vector3(-L+(i/seg)*2*L,0,-R));
    for(let i=0;i<seg;i++){const a=(i/seg)*Math.PI;pts.push(new THREE.Vector3(L+R*Math.sin(a),0,-R*Math.cos(a)));}
    for(let i=0;i<seg;i++)pts.push(new THREE.Vector3(L-(i/seg)*2*L,0,R));
    for(let i=0;i<seg;i++){const a=(i/seg)*Math.PI;pts.push(new THREE.Vector3(-L-R*Math.sin(a),0,R*Math.cos(a)));}
  }else if(c.type==="elliptical"){
    for(let i=0;i<N;i++){const t=(i/N)*2*Math.PI;pts.push(new THREE.Vector3(c.semiMajor*Math.cos(t),0,c.semiMinor*Math.sin(t)));}
  }else if(c.type==="toroidal_winding"||c.type==="elongated_toroidal_winding"){
    const R=c.majorRadius,r=c.minorRadius,d=c.type==="elongated_toroidal_winding"?(c.extension||0):0;
    const{dr,dh}=stadiumPt(c.windingIndex/c.totalWindings,r,d);
    const cR=R+dr;
    for(let i=0;i<N;i++){const a=(i/N)*2*Math.PI;pts.push(new THREE.Vector3(cR*Math.cos(a),dh,cR*Math.sin(a)));}
  }
  return pts;
}

function orient(pts,c){
  const n=new THREE.Vector3(...c.normal).normalize();
  if(n.length()<.001)n.set(0,1,0);
  const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),n);
  const ct=new THREE.Vector3(...c.center);
  return pts.map(p=>p.applyQuaternion(q).add(ct));
}

function fullPath(c,N){return orient(basePath(c,N),c);}

function turnPaths(coil){
  const{wd,tpl,layers}=calcPacking(coil);
  const paths=[];let count=0;
  const isTor=coil.type==="toroidal_winding"||coil.type==="elongated_toroidal_winding";
  for(let lay=0;lay<layers&&count<coil.turns;lay++){
    const n=Math.min(tpl,coil.turns-count);
    for(let j=0;j<n;j++){
      const tOff=(j-n/2+.5)*wd,rOff=(lay+.5)*wd;
      if(isTor){
        const R=coil.majorRadius,r=coil.minorRadius;
        const d=coil.type==="elongated_toroidal_winding"?(coil.extension||0):0;
        const L2=d>0?stadiumPerim(r,d):2*Math.PI*r;
        const tBase=coil.windingIndex/coil.totalWindings;
        const{dr,dh,nr,nh}=stadiumPt(tBase+tOff/L2,r,d);
        const cR=R+dr+nr*rOff,cY=dh+nh*rOff;
        const pts=[];
        for(let i=0;i<128;i++){const a=(i/128)*2*Math.PI;pts.push(new THREE.Vector3(cR*Math.cos(a),cY,cR*Math.sin(a)));}
        paths.push(orient(pts,coil));
      }else{
        const bp=basePath(coil);
        const cen=new THREE.Vector3();bp.forEach(p=>cen.add(p));cen.divideScalar(bp.length);
        const up=new THREE.Vector3(0,1,0);
        const op=bp.map(p=>{const rd=p.clone().sub(cen).normalize();return p.clone().add(up.clone().multiplyScalar(tOff)).add(rd.multiplyScalar(rOff));});
        paths.push(orient(op,coil));
      }
      count++;
    }
  }
  return paths;
}

/* ══════════════════════════════════════════════════════════════
   BIOT-SAVART FIELD (128 segments per coil)
   ══════════════════════════════════════════════════════════════ */

function biotSavartB(coils,pt){
  let Bx=0,By=0,Bz=0;
  const px=pt.x,py=pt.y,pz=pt.z;
  coils.forEach(c=>{
    const path=fullPath(c,BIOT_SEGS);
    const NI=c.turns*c.current;
    const coeff=MU0*NI/(4*Math.PI);
    for(let i=0;i<path.length;i++){
      const p1=path[i],p2=path[(i+1)%path.length];
      const dlx=p2.x-p1.x,dly=p2.y-p1.y,dlz=p2.z-p1.z;
      const mx=(p1.x+p2.x)/2,my=(p1.y+p2.y)/2,mz=(p1.z+p2.z)/2;
      const rx=px-mx,ry=py-my,rz=pz-mz;
      const r2=rx*rx+ry*ry+rz*rz;
      if(r2<1e-20)continue;
      const r=Math.sqrt(r2);
      const r3=r2*r;
      // dl × r
      const cx2=dly*rz-dlz*ry;
      const cy2=dlz*rx-dlx*rz;
      const cz2=dlx*ry-dly*rx;
      Bx+=coeff*cx2/r3;
      By+=coeff*cy2/r3;
      Bz+=coeff*cz2/r3;
    }
  });
  return new THREE.Vector3(Bx,By,Bz);
}

function fmtB(v){
  if(v<1e-9)return(v*1e12).toFixed(2)+" pT";
  if(v<1e-6)return(v*1e9).toFixed(2)+" nT";
  if(v<1e-3)return(v*1e6).toFixed(2)+" µT";
  if(v<1)return(v*1e3).toFixed(2)+" mT";
  return v.toFixed(4)+" T";
}

/* ── Interior volume sampling ─────────────────────────────── */

function getTorusParams(coils){
  const tor=coils.filter(c=>c.type==="toroidal_winding"||c.type==="elongated_toroidal_winding");
  if(tor.length===0)return null;
  const c=tor[0];
  return{R:c.majorRadius,r:c.minorRadius,ext:c.type==="elongated_toroidal_winding"?(c.extension||0):0,
    center:new THREE.Vector3(...c.center),normal:new THREE.Vector3(...c.normal).normalize()};
}

function isInsideTorus(pt,tp){
  const rel=pt.clone().sub(tp.center);
  const y=rel.dot(tp.normal);
  const radial=rel.clone().sub(tp.normal.clone().multiplyScalar(y));
  const rho=radial.length();
  const distFromTube=rho-tp.R;
  if(tp.ext<=0){
    return distFromTube*distFromTube+y*y<tp.r*tp.r;
  }else{
    if(y>tp.ext/2){return distFromTube*distFromTube+(y-tp.ext/2)*(y-tp.ext/2)<tp.r*tp.r;}
    if(y<-tp.ext/2){return distFromTube*distFromTube+(y+tp.ext/2)*(y+tp.ext/2)<tp.r*tp.r;}
    return Math.abs(distFromTube)<tp.r;
  }
}

function avgBInside(coils,nSamples=200){
  const tp=getTorusParams(coils);
  if(!tp)return null;
  const samples=[];
  let attempts=0;
  while(samples.length<nSamples&&attempts<nSamples*20){
    attempts++;
    const theta=Math.random()*2*Math.PI;
    const phi=Math.random()*2*Math.PI;
    const rr=Math.random()*tp.r*0.9;
    let y,distFromAxis;
    if(tp.ext>0){
      const hRange=tp.ext+2*tp.r;
      const rawY=(Math.random()-0.5)*hRange;
      y=rawY;
      distFromAxis=tp.R+(Math.random()-0.5)*2*tp.r*0.9;
    }else{
      y=rr*Math.sin(phi);
      distFromAxis=tp.R+rr*Math.cos(phi);
    }
    const pt=new THREE.Vector3(distFromAxis*Math.cos(theta),y,distFromAxis*Math.sin(theta));
    // Apply orientation
    const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),tp.normal);
    pt.applyQuaternion(q).add(tp.center);
    if(isInsideTorus(pt,tp))samples.push(pt);
  }
  if(samples.length<10)return null;
  let sum=0;
  samples.forEach(p=>{sum+=biotSavartB(coils,p).length();});
  return{avg:sum/samples.length,n:samples.length};
}

/* ══════════════════════════════════════════════════════════════
   COIL STATS
   ══════════════════════════════════════════════════════════════ */

function coilCircumference(c){
  if(c.type==="circular")return 2*Math.PI*c.radius;
  if(c.type==="racetrack")return 2*c.straightLength+2*Math.PI*c.arcRadius;
  if(c.type==="elliptical"){const a=c.semiMajor,b=c.semiMinor,h=((a-b)/(a+b))**2;return Math.PI*(a+b)*(1+3*h/(10+Math.sqrt(4-3*h)));}
  if(c.type==="toroidal_winding"||c.type==="elongated_toroidal_winding"){
    const R=c.majorRadius,r=c.minorRadius,d=c.type==="elongated_toroidal_winding"?(c.extension||0):0;
    const{dr}=stadiumPt(c.windingIndex/c.totalWindings,r,d);
    return 2*Math.PI*(R+dr);
  }
  return 0;
}

function calcStats(coils){
  let totalLen=0,totalPower=0,totalMass=0;
  coils.forEach(c=>{
    const L=coilCircumference(c)*c.turns;
    const A=Math.PI*(wireBare(c.wireGauge)/2)**2;
    const R=CU_RHO*L/A;
    totalLen+=L;totalPower+=c.current**2*R;totalMass+=L*A*CU_DENSITY;
  });
  return{totalLen,totalPower,totalMass};
}

/* ══════════════════════════════════════════════════════════════
   3D MESH BUILDERS
   ══════════════════════════════════════════════════════════════ */

function tubeMesh(path,tubeR,color,emissive){
  const curve=new THREE.CatmullRomCurve3(path,true);
  const g=new THREE.TubeGeometry(curve,Math.min(200,Math.max(64,path.length)),tubeR,8,true);
  const m=new THREE.MeshStandardMaterial({color:new THREE.Color(color),emissive:new THREE.Color(emissive?color:"#000"),emissiveIntensity:emissive?.5:0,roughness:.4,metalness:.6});
  return new THREE.Mesh(g,m);
}

function buildCoilMeshes(coil,color,sel,showIndiv){
  const meshes=[];
  const wd=wireEnamel(coil.wireGauge);
  const vr=wd/2;
  if(showIndiv&&coil.turns>1){
    turnPaths(coil).slice(0,500).forEach(p=>meshes.push(tubeMesh(p,vr,color,sel)));
  }else{
    const path=fullPath(coil);
    const{layers,tpl}=calcPacking(coil);
    const bW=Math.min(coil.turns,tpl)*wd,bH=layers*wd;
    const bR=coil.turns>1?Math.max(Math.sqrt(bW*bH/Math.PI)/2,vr):vr;
    meshes.push(tubeMesh(path,bR,color,sel));
  }
  return meshes;
}

/* ── Current direction arrows ─────────────────────────────── */

function buildCurrentArrows(coil,color){
  const group=new THREE.Group();
  const path=fullPath(coil,64);
  const nArrows=12;
  const step=Math.floor(path.length/nArrows);
  const arrowLen=0.02;
  const arrowR=0.008;
  for(let i=0;i<nArrows;i++){
    const idx=i*step;
    const p=path[idx];
    const pNext=path[(idx+1)%path.length];
    const dir=pNext.clone().sub(p).normalize();
    if(coil.current<0)dir.negate();
    const cone=new THREE.ConeGeometry(arrowR,arrowLen,8);
    const mat=new THREE.MeshStandardMaterial({color:new THREE.Color(color),emissive:new THREE.Color(color),emissiveIntensity:0.8});
    const mesh=new THREE.Mesh(cone,mat);
    mesh.position.copy(p).add(dir.clone().multiplyScalar(arrowLen/2));
    const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),dir);
    mesh.quaternion.copy(q);
    group.add(mesh);
  }
  return group;
}

/* ── Ghost surfaces ───────────────────────────────────────── */

function ghostTorus(R,r,center,normal){
  const g=new THREE.TorusGeometry(R,r,32,100);
  const m=new THREE.MeshStandardMaterial({color:0xffffff,transparent:true,opacity:.07,side:THREE.DoubleSide,depthWrite:false});
  const mesh=new THREE.Mesh(g,m);
  const n=new THREE.Vector3(...normal).normalize();if(n.length()<.001)n.set(0,1,0);
  const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),n);
  const fq=new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI/2,0,0));
  mesh.quaternion.copy(q.multiply(fq));mesh.position.set(...center);return mesh;
}

function ghostElongTorus(R,r,ext,center,normal){
  const pts=[];for(let i=0;i<=64;i++){const{dr,dh}=stadiumPt(i/64,r,ext);pts.push(new THREE.Vector2(R+dr,dh));}
  const g=new THREE.LatheGeometry(pts,100);
  const m=new THREE.MeshStandardMaterial({color:0xffffff,transparent:true,opacity:.07,side:THREE.DoubleSide,depthWrite:false});
  const mesh=new THREE.Mesh(g,m);
  const n=new THREE.Vector3(...normal).normalize();if(n.length()<.001)n.set(0,1,0);
  mesh.quaternion.copy(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),n));
  mesh.position.set(...center);return mesh;
}

function buildEnclosedVolume(R,r,ext,center,normal){
  let g;
  if(ext>0){
    const pts=[];for(let i=0;i<=64;i++){const{dr,dh}=stadiumPt(i/64,r,ext);pts.push(new THREE.Vector2(R+dr,dh));}
    g=new THREE.LatheGeometry(pts,100);
  }else{g=new THREE.TorusGeometry(R,r,32,100);}
  const m=new THREE.MeshStandardMaterial({color:0x00ff88,transparent:true,opacity:0.12,side:THREE.DoubleSide,depthWrite:false});
  const mesh=new THREE.Mesh(g,m);
  const n=new THREE.Vector3(...normal).normalize();if(n.length()<.001)n.set(0,1,0);
  if(ext>0){mesh.quaternion.copy(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),n));}
  else{const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),n);const fq=new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI/2,0,0));mesh.quaternion.copy(q.multiply(fq));}
  mesh.position.set(...center);return mesh;
}

/* ── Scale markers ────────────────────────────────────────── */

function buildScales(maxCm){
  const g=new THREE.Group();
  const axCfg=[{dir:[1,0,0],c:0xef4444,perp:[0,1,0]},{dir:[0,1,0],c:0x22c55e,perp:[1,0,0]},{dir:[0,0,1],c:0x3b82f6,perp:[0,1,0]}];
  axCfg.forEach(({dir,c,perp})=>{
    const mat=new THREE.LineBasicMaterial({color:c,transparent:true,opacity:0.35});
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-dir[0]*maxCm/100,-dir[1]*maxCm/100,-dir[2]*maxCm/100),
      new THREE.Vector3(dir[0]*maxCm/100,dir[1]*maxCm/100,dir[2]*maxCm/100)]),mat.clone()));
    for(let cm=-maxCm;cm<=maxCm;cm+=5){
      if(cm===0)continue;
      const pos=new THREE.Vector3(dir[0]*cm/100,dir[1]*cm/100,dir[2]*cm/100);
      const is10=cm%10===0;
      const tl=is10?0.007:0.004;
      const p1=new THREE.Vector3(perp[0]*tl,perp[1]*tl,perp[2]*tl);
      const tm=mat.clone();tm.opacity=is10?0.4:0.2;
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([pos.clone().sub(p1),pos.clone().add(p1)]),tm));
      if(is10){
        const cv=document.createElement("canvas");cv.width=48;cv.height=20;
        const ctx=cv.getContext("2d");ctx.fillStyle="#"+c.toString(16).padStart(6,"0");
        ctx.font="bold 14px monospace";ctx.textAlign="center";ctx.textBaseline="middle";
        ctx.fillText(cm+"",24,10);
        const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(cv),transparent:true,opacity:0.45,depthTest:false,sizeAttenuation:true}));
        sp.position.copy(pos).add(new THREE.Vector3(perp[0]*0.018,perp[1]*0.018,perp[2]*0.018));
        sp.scale.set(0.03,0.013,1);g.add(sp);
      }
    }
  });
  return g;
}

function makeLabel(text,pos,color){
  const cv=document.createElement("canvas");cv.width=64;cv.height=64;
  const ctx=cv.getContext("2d");ctx.fillStyle=color;ctx.font="bold 48px monospace";
  ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(text,32,32);
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(cv),depthTest:false,sizeAttenuation:true}));
  s.position.copy(pos);s.scale.set(.06,.06,.06);return s;
}

/* ══════════════════════════════════════════════════════════════
   FIELD LINES (Biot-Savart, colored by strength)
   ══════════════════════════════════════════════════════════════ */

function strengthToColor(t){
  if(t<0.25){const s=t/0.25;return new THREE.Color(0,s,1);}
  if(t<0.5){const s=(t-0.25)/0.25;return new THREE.Color(0,1,1-s);}
  if(t<0.75){const s=(t-0.5)/0.25;return new THREE.Color(s,1,0);}
  const s=(t-0.75)/0.25;return new THREE.Color(1,1-s,0);
}

function traceFieldLine(coils,start,steps,ds){
  const pts=[],mags=[];const p=start.clone();
  const baseDs=Math.abs(ds);
  const sign=ds>0?1:-1;
  let prevDir=null;
  for(let i=0;i<steps;i++){
    const B=biotSavartB(coils,p);const mag=B.length();
    pts.push(p.clone());mags.push(mag);
    if(mag<1e-15)break;
    const dir=B.clone().normalize();
    // Check for sharp reversals (>90 degrees) which indicate numerical issues near coils
    if(prevDir&&dir.dot(prevDir)<0){
      // We've hit a near-wire singularity, stop this line
      break;
    }
    // Adaptive step: smaller steps where field is stronger (near coils)
    const adaptDs=baseDs*Math.min(1,0.001/Math.max(mag,1e-10));
    const stepSize=Math.max(baseDs*0.1,Math.min(baseDs*2,adaptDs));
    p.add(dir.multiplyScalar(sign*stepSize));
    prevDir=B.clone().normalize();
    if(p.length()>2)break;
  }
  return{pts,mags};
}

function generateFieldLines(coils,density){
  const lines=[];if(coils.length===0)return lines;
  const seedDists=[0.02,0.05,0.1,0.15,0.25];
  const heights=[-0.15,-0.08,0,0.08,0.15];
  const nAround=Math.max(4,density);
  heights.forEach(y=>{seedDists.forEach(r=>{
    for(let i=0;i<nAround;i++){
      const theta=(i/nAround)*2*Math.PI;
      const seed=new THREE.Vector3(r*Math.cos(theta),y,r*Math.sin(theta));
      const fwd=traceFieldLine(coils,seed,400,0.005);if(fwd.pts.length>5)lines.push(fwd);
      const bwd=traceFieldLine(coils,seed,400,-0.005);if(bwd.pts.length>5)lines.push(bwd);
    }
  });});
  return lines;
}

function buildFieldLineMeshes(fieldLines){
  const group=new THREE.Group();if(fieldLines.length===0)return group;
  let gMin=Infinity,gMax=-Infinity;
  fieldLines.forEach(({mags})=>mags.forEach(m=>{if(m>1e-15){if(m<gMin)gMin=m;if(m>gMax)gMax=m;}}));
  if(gMin>=gMax){gMin=0;gMax=1;}
  const logMin=Math.log10(Math.max(gMin,1e-15)),logMax=Math.log10(Math.max(gMax,1e-14)),logRange=logMax-logMin||1;
  fieldLines.forEach(({pts,mags})=>{
    if(pts.length<3)return;
    const curve=new THREE.CatmullRomCurve3(pts,false);
    const geom=new THREE.TubeGeometry(curve,Math.min(pts.length*2,200),0.0015,5,false);
    const posAttr=geom.getAttribute("position");
    const colorArr=new Float32Array(posAttr.count*3);
    for(let vi=0;vi<posAttr.count;vi++){
      const vx=posAttr.getX(vi),vy=posAttr.getY(vi),vz=posAttr.getZ(vi);
      let bestIdx=0,bestDist=Infinity;
      for(let pi=0;pi<pts.length;pi++){const dx=vx-pts[pi].x,dy=vy-pts[pi].y,dz=vz-pts[pi].z;const d2=dx*dx+dy*dy+dz*dz;if(d2<bestDist){bestDist=d2;bestIdx=pi;}}
      const t=Math.max(0,Math.min(1,(Math.log10(Math.max(mags[bestIdx],1e-15))-logMin)/logRange));
      const col=strengthToColor(t);colorArr[vi*3]=col.r;colorArr[vi*3+1]=col.g;colorArr[vi*3+2]=col.b;
    }
    geom.setAttribute("color",new THREE.Float32BufferAttribute(colorArr,3));
    group.add(new THREE.Mesh(geom,new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,opacity:0.7})));
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
          className="flex-1 bg-transparent text-sm text-gray-200 font-medium outline-none truncate"/>
        <span className="text-gray-500 text-xs font-mono">{coil.current.toFixed(1)}A</span>
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
            Enamelled Cu {coil.wireGauge}AWG: bare {(pk.bare*1000).toFixed(2)}mm, coated {(pk.wd*1000).toFixed(2)}mm | {pk.tpl}/layer | {pk.layers} layers
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

/* ── Current Editor with bar chart + cross-section ────────── */

function CurrentEditor({coils,onUpdateCoils,highlightId,setHighlightId}){
  const canvasRef=useRef(null);
  const crossRef=useRef(null);
  const dragging=useRef(null);

  const maxI=useMemo(()=>Math.max(1,...coils.map(c=>Math.abs(c.current)))*1.3,[coils]);

  const dpr=typeof window!=='undefined'?window.devicePixelRatio||1:1;
  const CW=500,CH=180,XW=500,XH=150;

  useEffect(()=>{
    const cv=canvasRef.current;if(!cv)return;
    cv.width=CW*dpr;cv.height=CH*dpr;
    cv.style.width=CW+"px";cv.style.height=CH+"px";
    const ctx=cv.getContext("2d");
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,CW,CH);
    if(coils.length===0)return;

    const barW=Math.min(30,Math.max(6,(CW-50)/coils.length-2));
    const startX=40;
    const zeroY=CH-20;
    const scaleH=zeroY-15;

    ctx.strokeStyle="#444";ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(startX,10);ctx.lineTo(startX,zeroY);ctx.lineTo(CW-5,zeroY);ctx.stroke();

    ctx.fillStyle="#666";ctx.font="10px monospace";ctx.textAlign="right";
    const yStep=Math.max(1,Math.ceil(maxI/6));
    for(let a=0;a<=maxI;a+=yStep){
      const y=zeroY-(a/maxI)*scaleH;
      ctx.fillText(a.toFixed(0)+"A",startX-4,y+3);
      ctx.strokeStyle="#2a2a2a";ctx.beginPath();ctx.moveTo(startX,y);ctx.lineTo(CW-5,y);ctx.stroke();
    }

    coils.forEach((c,i)=>{
      const x=startX+4+i*(barW+2);
      const barH=(Math.abs(c.current)/maxI)*scaleH;
      const y=zeroY-barH;
      const isHL=c.id===highlightId;
      const col=COLORS[i%COLORS.length];

      ctx.fillStyle=isHL?col:col+"88";
      ctx.fillRect(x,y,barW,barH);
      if(isHL){ctx.strokeStyle="#fff";ctx.lineWidth=1.5;ctx.strokeRect(x-0.5,y-0.5,barW+1,barH+1);ctx.lineWidth=1;}

      ctx.fillStyle=isHL?"#eee":"#777";ctx.font="9px monospace";ctx.textAlign="center";
      ctx.fillText(c.current.toFixed(1),x+barW/2,y-4);

      ctx.fillStyle="#555";ctx.font="7px monospace";
      ctx.fillText(i+"",x+barW/2,zeroY+10);
    });
  },[coils,highlightId,maxI,dpr]);

  useEffect(()=>{
    const cv=crossRef.current;if(!cv)return;
    cv.width=XW*dpr;cv.height=XH*dpr;
    cv.style.width=XW+"px";cv.style.height=XH+"px";
    const ctx=cv.getContext("2d");
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,XW,XH);

    const tor=coils.filter(c=>c.type==="toroidal_winding"||c.type==="elongated_toroidal_winding");
    if(tor.length===0){
      ctx.fillStyle="#444";ctx.font="11px sans-serif";ctx.textAlign="center";
      ctx.fillText("Cross-section (toroidal only)",XW/2,XH/2);return;
    }

    const c0=tor[0];
    const R=c0.majorRadius,r=c0.minorRadius,ext=c0.type==="elongated_toroidal_winding"?(c0.extension||0):0;
    const totalH=2*r+(ext>0?ext:0);
    const totalW=2*(R+r);
    const scale=Math.min((XW-40)/totalW,(XH-30)/totalH)*0.8;
    const cx=XW/2,cy=XH/2;

    ctx.strokeStyle="#444";ctx.lineWidth=1;
    const outerX=cx+R*scale;
    const innerX=cx-R*scale;

    [outerX,innerX].forEach(px=>{
      if(ext>0){
        ctx.beginPath();
        ctx.arc(px,cy-ext/2*scale,r*scale,Math.PI,0);
        ctx.lineTo(px+r*scale,cy+ext/2*scale);
        ctx.arc(px,cy+ext/2*scale,r*scale,0,Math.PI);
        ctx.closePath();ctx.stroke();
      }else{
        ctx.beginPath();ctx.arc(px,cy,r*scale,0,2*Math.PI);ctx.stroke();
      }
    });

    ctx.strokeStyle="#333";ctx.setLineDash([3,3]);
    ctx.beginPath();ctx.moveTo(cx,5);ctx.lineTo(cx,XH-5);ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle="#555";ctx.font="8px monospace";ctx.textAlign="center";
    ctx.fillText("axis",cx,XH-2);

    tor.forEach(c=>{
      const{dr,dh}=stadiumPt(c.windingIndex/c.totalWindings,r,ext);
      const px1=cx+(R+dr)*scale;
      const px2=cx-(R+dr)*scale;
      const py=cy-dh*scale;
      const isHL=c.id===highlightId;
      const col=COLORS[coils.indexOf(c)%COLORS.length];
      const dotR=isHL?5:3;
      [px1,px2].forEach(px=>{
        ctx.beginPath();ctx.arc(px,py,dotR,0,2*Math.PI);
        ctx.fillStyle=isHL?col:col+"66";ctx.fill();
        if(isHL){ctx.strokeStyle="#fff";ctx.lineWidth=1.5;ctx.stroke();ctx.lineWidth=1;}
      });
    });
  },[coils,highlightId,dpr]);

  const getBarIndex=(e)=>{
    const cv=canvasRef.current;if(!cv||coils.length===0)return-1;
    const rect=cv.getBoundingClientRect();
    const x=(e.clientX-rect.left)*(CW/rect.width);
    const barW=Math.min(30,Math.max(6,(CW-50)/coils.length-2));
    const startX=40;
    return Math.floor((x-startX-4)/(barW+2));
  };

  const getBarCurrent=(e)=>{
    const cv=canvasRef.current;if(!cv)return 0;
    const rect=cv.getBoundingClientRect();
    const y=(e.clientY-rect.top)*(CH/rect.height);
    const zeroY=CH-20;
    const scaleH=zeroY-15;
    return Math.max(0,Math.round(((zeroY-y)/scaleH)*maxI*10)/10);
  };

  const handleDown=e=>{
    const idx=getBarIndex(e);
    if(idx>=0&&idx<coils.length){
      dragging.current=idx;
      setHighlightId(coils[idx].id);
      const newI=getBarCurrent(e);
      const updated=[...coils];updated[idx]={...updated[idx],current:Math.min(newI,maxI*2)};
      onUpdateCoils(updated);
    }
  };

  const handleMove=e=>{
    if(dragging.current!==null&&dragging.current>=0&&dragging.current<coils.length){
      const di=dragging.current;
      const newI=getBarCurrent(e);
      const updated=[...coils];updated[di]={...updated[di],current:Math.min(newI,maxI*2)};
      onUpdateCoils(updated);
    }else{
      const idx=getBarIndex(e);
      if(idx>=0&&idx<coils.length)setHighlightId(coils[idx].id);
    }
  };

  return(
    <div className="flex flex-col gap-2">
      <div className="text-xs text-gray-400 font-medium px-1">Current Editor — drag bars to adjust</div>
      <canvas ref={canvasRef}
        className="bg-gray-900/50 rounded border border-gray-800 cursor-crosshair"
        style={{width:CW,height:CH}}
        onMouseDown={handleDown}
        onMouseMove={handleMove}
        onMouseUp={()=>{dragging.current=null;}}
        onMouseLeave={()=>{dragging.current=null;}}
      />
      <div className="text-xs text-gray-400 font-medium px-1">Cross-section — highlighted coil shown</div>
      <canvas ref={crossRef}
        className="bg-gray-900/50 rounded border border-gray-800"
        style={{width:XW,height:XH}}
      />
      <GradientTool coils={coils} onUpdateCoils={onUpdateCoils}/>
    </div>
  );
}

/* ── Gradient Tool ────────────────────────────────────────── */

function GradientTool({coils,onUpdateCoils}){
  const[innerI,setInnerI]=useState(15);
  const[outerI,setOuterI]=useState(5);

  const apply=()=>{
    const tor=coils.filter(c=>c.type==="toroidal_winding"||c.type==="elongated_toroidal_winding");
    if(tor.length===0)return;
    const c0=tor[0];
    const R=c0.majorRadius,r=c0.minorRadius,ext=c0.type==="elongated_toroidal_winding"?(c0.extension||0):0;

    // Compute cR for each toroidal coil
    const radii=tor.map(c=>{
      const{dr}=stadiumPt(c.windingIndex/c.totalWindings,r,ext);
      return{id:c.id,cR:R+dr};
    });
    const minR=Math.min(...radii.map(r=>r.cR));
    const maxR=Math.max(...radii.map(r=>r.cR));
    const range=maxR-minR||1;

    const idMap=new Map();
    radii.forEach(({id,cR})=>{
      const t=(cR-minR)/range; // 0=inner, 1=outer
      const current=innerI+(outerI-innerI)*t;
      idMap.set(id,Math.round(current*10)/10);
    });

    onUpdateCoils(coils.map(c=>idMap.has(c.id)?{...c,current:idMap.get(c.id)}:c));
  };

  return(
    <div className="bg-gray-800/30 rounded p-2 flex flex-col gap-1.5">
      <span className="text-xs text-gray-400 font-medium">Current Gradient (inner → outer)</span>
      <div className="flex gap-2 items-center">
        <label className="text-xs text-gray-500">Inner:
          <input type="number" step={0.1} value={innerI} onChange={e=>setInnerI(parseFloat(e.target.value)||0)}
            className="w-16 ml-1 bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-gray-200 text-xs outline-none"/>
        </label>
        <span className="text-gray-600">→</span>
        <label className="text-xs text-gray-500">Outer:
          <input type="number" step={0.1} value={outerI} onChange={e=>setOuterI(parseFloat(e.target.value)||0)}
            className="w-16 ml-1 bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-gray-200 text-xs outline-none"/>
        </label>
        <button onClick={apply} className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded">Apply</button>
      </div>
    </div>
  );
}

/* ── Universal settings ───────────────────────────────────── */

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

/* ── Info box ─────────────────────────────────────────────── */

function InfoBox({coils,show,setShow,avgBInside:avgBVal,computingAvgB}){
  if(!show||coils.length===0)return(
    <button onClick={()=>setShow(true)} className="absolute bottom-3 right-3 px-2 py-1 bg-gray-800/80 text-gray-400 text-xs rounded hover:bg-gray-700 z-10">Stats</button>
  );
  const stats=calcStats(coils);
  const bO=biotSavartB(coils,new THREE.Vector3(0,0,0));
  const b30=biotSavartB(coils,new THREE.Vector3(0.3,0,0));
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
        {avgBVal!==null&&<div>Avg |B| interior: <span className="text-green-300">{fmtB(avgBVal.avg)}</span> <span className="text-gray-600">({avgBVal.n} pts)</span></div>}
        {computingAvgB&&<div className="text-yellow-500">Computing interior avg...</div>}
        <div className="text-gray-600 mt-1 italic">Biot-Savart, {BIOT_SEGS} segs/coil</div>
      </div>
    </div>
  );
}

/* ── Save/Load ────────────────────────────────────────────── */

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
  const[promptOpen,setPromptOpen]=useState(false);
  const[loading,setLoading]=useState(false);
  const[error,setError]=useState(null);
  const[showScales,setShowScales]=useState(true);
  const[showIndiv,setShowIndiv]=useState(false);
  const[showStats,setShowStats]=useState(true);
  const[showField,setShowField]=useState(false);
  const[showArrows,setShowArrows]=useState(false);
  const[showVolume,setShowVolume]=useState(false);
  const[showCurrentEditor,setShowCurrentEditor]=useState(false);
  const[fieldDensity,setFieldDensity]=useState(6);
  const[fieldLoading,setFieldLoading]=useState(false);
  const[avgBVal,setAvgBVal]=useState(null);
  const[computingAvgB,setComputingAvgB]=useState(false);
  const[barHighlight,setBarHighlight]=useState(null);

  // Undo/redo
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

  // Three.js refs
  const containerRef=useRef(null);const sceneRef=useRef(null);const cameraRef=useRef(null);
  const rendererRef=useRef(null);const coilGroupRef=useRef(null);const fieldGroupRef=useRef(null);
  const arrowGroupRef=useRef(null);const volumeGroupRef=useRef(null);const scaleGroupRef=useRef(null);
  const frameRef=useRef(null);
  const orbitRef=useRef({theta:Math.PI/4,phi:Math.PI/3,dist:1.5,target:new THREE.Vector3(),dragging:false,panning:false,lastX:0,lastY:0});

  /* ── Init Three.js ───────────────────────────────────── */
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
    const ag=new THREE.Group();ag.visible=false;scene.add(ag);arrowGroupRef.current=ag;
    const vg=new THREE.Group();vg.visible=false;scene.add(vg);volumeGroupRef.current=vg;
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

  /* ── Orbit controls ──────────────────────────────────── */
  useEffect(()=>{
    const el=containerRef.current;if(!el)return;
    function updateCam(){
      const o=orbitRef.current,cam=cameraRef.current;if(!cam)return;
      cam.position.set(o.target.x+o.dist*Math.sin(o.phi)*Math.cos(o.theta),o.target.y+o.dist*Math.cos(o.phi),o.target.z+o.dist*Math.sin(o.phi)*Math.sin(o.theta));
      cam.lookAt(o.target);
    }
    const onDown=e=>{
      if(e.button===2||e.shiftKey)orbitRef.current.panning=true;else orbitRef.current.dragging=true;
      orbitRef.current.lastX=e.clientX;orbitRef.current.lastY=e.clientY;
    };
    const onMove=e=>{
      const o=orbitRef.current;const dx=e.clientX-o.lastX,dy=e.clientY-o.lastY;
      if(o.dragging){o.theta+=dx*.005;o.phi=Math.max(.1,Math.min(Math.PI-.1,o.phi+dy*.005));}
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

  /* ── Update coil meshes ──────────────────────────────── */
  useEffect(()=>{
    const cg=coilGroupRef.current;if(!cg)return;
    while(cg.children.length){const c=cg.children[0];if(c.geometry)c.geometry.dispose();if(c.material)c.material.dispose();cg.remove(c);}
    coils.forEach((coil,i)=>{
      try{
        const sel=coil.id===selectedId||multiSel.has(coil.id)||coil.id===barHighlight;
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
  },[coils,selectedId,multiSel,showIndiv,barHighlight]);

  /* ── Current direction arrows ────────────────────────── */
  useEffect(()=>{
    const ag=arrowGroupRef.current;if(!ag)return;
    while(ag.children.length){const c=ag.children[0];if(c.geometry)c.geometry.dispose();if(c.material)c.material.dispose();ag.remove(c);}
    if(showArrows){coils.forEach((c,i)=>{try{const arrows=buildCurrentArrows(c,COLORS[i%COLORS.length]);arrows.children.forEach(a=>ag.add(a));}catch(e){console.warn(e);}});}
    ag.visible=showArrows;
  },[showArrows,coils]);

  /* ── Enclosed volume ─────────────────────────────────── */
  useEffect(()=>{
    const vg=volumeGroupRef.current;if(!vg)return;
    while(vg.children.length){const c=vg.children[0];if(c.geometry)c.geometry.dispose();if(c.material)c.material.dispose();vg.remove(c);}
    if(showVolume){
      const tp=getTorusParams(coils);
      if(tp){try{vg.add(buildEnclosedVolume(tp.R,tp.r,tp.ext,[...Object.values(tp.center)].slice(0,3),
        [...Object.values(tp.normal)].slice(0,3)));}catch(e){console.warn(e);}}
    }
    vg.visible=showVolume;
  },[showVolume,coils]);

  /* ── Field lines ─────────────────────────────────────── */
  useEffect(()=>{
    const fg=fieldGroupRef.current;if(!fg)return;
    while(fg.children.length){const c=fg.children[0];if(c.geometry)c.geometry.dispose();if(c.material)c.material.dispose();fg.remove(c);}
    if(showField&&coils.length>0){
      setFieldLoading(true);
      setTimeout(()=>{
        const lines=generateFieldLines(coils,fieldDensity);
        buildFieldLineMeshes(lines).children.forEach(c=>fg.add(c));
        fg.visible=true;setFieldLoading(false);
      },50);
    }else{fg.visible=false;setFieldLoading(false);}
  },[showField,coils,fieldDensity]);

  /* ── Compute avg B inside ────────────────────────────── */
  const computeAvgB=useCallback(()=>{
    setComputingAvgB(true);setAvgBVal(null);
    setTimeout(()=>{
      const result=avgBInside(coils,200);
      setAvgBVal(result);setComputingAvgB(false);
    },50);
  },[coils]);

  /* ── Fit view ────────────────────────────────────────── */
  const fitView=useCallback(()=>{
    if(coils.length===0)return;
    const box=new THREE.Box3();coils.forEach(c=>{fullPath(c).forEach(p=>box.expandByPoint(p));});
    const center=new THREE.Vector3();box.getCenter(center);
    const size=box.getSize(new THREE.Vector3()).length();
    const o=orbitRef.current;o.target.copy(center);o.dist=Math.max(size*1.2,.1);
    const cam=cameraRef.current;if(!cam)return;
    cam.position.set(o.target.x+o.dist*Math.sin(o.phi)*Math.cos(o.theta),o.target.y+o.dist*Math.cos(o.phi),o.target.z+o.dist*Math.sin(o.phi)*Math.sin(o.theta));
    cam.lookAt(o.target);
  },[coils]);

  /* ── Handlers ────────────────────────────────────────── */
  const addCoil=()=>{const c=defaultCoil();pushCoils([...coils,c]);setSelectedId(c.id);};
  const updateCoil=u=>pushCoils(coils.map(c=>c.id===u.id?u:c));
  const deleteCoil=id=>{pushCoils(coils.filter(c=>c.id!==id));if(selectedId===id)setSelectedId(null);setMultiSel(s=>{const n=new Set(s);n.delete(id);return n;});};
  const duplicateCoil=id=>{const src=coils.find(c=>c.id===id);if(!src)return;const dup=defaultCoil({...src,name:src.name+" copy"});pushCoils([...coils,dup]);setSelectedId(dup.id);};
  const shiftSelect=id=>{setMultiSel(s=>{const n=new Set(s);if(n.has(id))n.delete(id);else n.add(id);return n;});};

  const applyUniversal=(vals,fields)=>{
    const targets=multiSel.size>0?coils.filter(c=>multiSel.has(c.id)||c.id===selectedId):coils;
    const ids=new Set(targets.map(c=>c.id));
    pushCoils(coils.map(c=>{
      if(!ids.has(c.id))return c;const u={...c};
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

  /* ── RENDER ──────────────────────────────────────────── */
  return(
    <div className="flex flex-col h-screen bg-gray-950 text-gray-200 overflow-hidden">

      {/* ── Collapsible prompt panel ─────────────────────── */}
      <div className="bg-gray-900 border-b border-gray-800 shrink-0">
        <div className="flex items-center justify-between px-4 py-1.5 cursor-pointer" onClick={()=>setPromptOpen(!promptOpen)}>
          <span className="text-xs text-gray-400 font-medium">Describe Geometry (Claude AI)</span>
          <span className="text-gray-600 text-xs">{promptOpen?"▾":"▸"}</span>
        </div>
        {promptOpen&&(
          <div className="px-4 pb-3 flex flex-col gap-2">
            <textarea value={prompt} onChange={e=>setPrompt(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter"&&e.metaKey)handleParse();}}
              placeholder="Describe your coil geometry in plain English... (Cmd+Enter to parse)"
              rows={4}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-gray-200 placeholder-gray-500 outline-none focus:border-blue-500 resize-y"/>
            <div className="flex items-center gap-2">
              <button onClick={handleParse} disabled={loading||!prompt.trim()}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium rounded-lg">
                {loading?"Parsing...":"Parse with Claude"}
              </button>
              <span className="text-xs text-gray-600">Cmd+Enter to submit</span>
            </div>
          </div>
        )}
      </div>
      {error&&<div className="px-4 py-1.5 bg-red-900/30 border-b border-red-800 text-red-300 text-xs">{error}</div>}

      <div className="flex flex-1 overflow-hidden">
        {/* ── Left panel ─────────────────────────────────── */}
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

          {/* ── Display toggles ──────────────────────────── */}
          <div className="border-t border-gray-800 px-3 py-2 bg-gray-900/30 flex flex-col gap-1">
            <span className="text-xs text-gray-400 font-medium">Display</span>
            {[
              ["Axis scales",showScales,setShowScales],
              ["Individual turns",showIndiv,setShowIndiv],
              ["Current direction",showArrows,setShowArrows],
              ["Enclosed volume",showVolume,setShowVolume],
            ].map(([l,v,s])=>(
              <label key={l} className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                <input type="checkbox" checked={v} onChange={e=>s(e.target.checked)} className="rounded border-gray-600"/>{l}
              </label>
            ))}
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
            {showVolume&&(
              <button onClick={computeAvgB} disabled={computingAvgB}
                className="ml-5 px-2 py-0.5 bg-gray-800 hover:bg-gray-700 text-xs text-gray-300 rounded disabled:text-gray-600">
                {computingAvgB?"Computing...":"Compute avg |B| inside"}
              </button>
            )}
          </div>

          {/* ── Current editor toggle ────────────────────── */}
          <div className="border-t border-gray-800 px-3 py-2 bg-gray-900/30">
            <div className="flex items-center justify-between cursor-pointer" onClick={()=>setShowCurrentEditor(!showCurrentEditor)}>
              <span className="text-xs text-gray-400 font-medium">Current Editor</span>
              <span className="text-gray-600 text-xs">{showCurrentEditor?"▾":"▸"}</span>
            </div>
          </div>

          <UniversalPanel onApply={applyUniversal}/>
          <SaveLoadPanel coils={coils} onLoad={(nc)=>{pushCoils(nc);setSelectedId(nc[0]?.id||null);}}/>
        </div>

        {/* ── 3D viewer ──────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 relative">
            <div ref={containerRef} className="absolute inset-0"/>
            <InfoBox coils={coils} show={showStats} setShow={setShowStats} avgBInside={avgBVal} computingAvgB={computingAvgB}/>
            <div className="absolute bottom-3 left-3 text-xs text-gray-600 pointer-events-none select-none">
              Drag: rotate · Shift+drag: pan · Scroll: zoom · Cmd+Z: undo
            </div>
            <div className="absolute top-3 right-3 text-xs text-gray-600 pointer-events-none select-none bg-gray-900/60 rounded px-2 py-1">
              <span className="text-red-400">X</span> <span className="text-green-400">Y</span>(up) <span className="text-blue-400">Z</span> · cm
            </div>
          </div>

          {/* ── Current editor panel (bottom of viewer) ──── */}
          {showCurrentEditor&&coils.length>0&&(
            <div className="h-96 border-t border-gray-800 bg-gray-950 overflow-y-auto p-3">
              <CurrentEditor coils={coils} onUpdateCoils={pushCoils}
                highlightId={barHighlight} setHighlightId={setBarHighlight}/>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}