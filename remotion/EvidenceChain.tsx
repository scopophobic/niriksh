import React from 'react';
import {AbsoluteFill, Img, interpolate, Easing, staticFile, useCurrentFrame} from 'remotion';

const ease = Easing.bezier(0.22, 1, 0.36, 1);
const progress = (f: number, a: number, b: number) => interpolate(f, [a, b], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease});
const hash = (n: number) => {const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v);};

// Shared vertices and edges make a true honeycomb, not overlapping hexagons.
const vertices: {x: number; y: number}[] = [];
const edges: [number, number][] = [];
const lookup = new Map<string, number>();
const edgeKeys = new Set<string>();
for (let q = -10; q <= 10; q++) for (let r = -8; r <= 8; r++) {
  const cx = 960 + q * 111;
  const cy = 540 + Math.sqrt(3) * 74 * (r + q / 2);
  if (cx < -160 || cx > 2080 || cy < -160 || cy > 1240) continue;
  const ids = Array.from({length: 6}, (_, k) => {
    const x = cx + 74 * Math.cos(k * Math.PI / 3);
    const y = cy + 74 * Math.sin(k * Math.PI / 3);
    const key = `${x.toFixed(2)},${y.toFixed(2)}`;
    if (!lookup.has(key)) {lookup.set(key, vertices.length); vertices.push({x, y});}
    return lookup.get(key)!;
  });
  ids.forEach((a, i) => {const b = ids[(i + 1) % 6]; const key = [a,b].sort((x,y) => x-y).join(':'); if (!edgeKeys.has(key)) {edgeKeys.add(key); edges.push([a,b]);}});
}

export const EvidenceChain: React.FC = () => {
  const frame = useCurrentFrame();
  const align = progress(frame, 90, 173);
  const push = progress(frame, 180, 282);
  const settle = progress(frame, 296, 355);
  const light = progress(frame, 248, 320);
  const logoScale = interpolate(frame, [180, 230, 288, 350], [0.015, 1.13, 1.13, 1], {extrapolateLeft:'clamp', extrapolateRight:'clamp', easing:ease});
  const logoX = 960 - 450 * settle;
  const points = vertices.map((p, i) => {
    const dx = p.x - 960, dy = p.y - 540;
    const d = Math.max(1, Math.hypot(dx, dy));
    const scatterX = (hash(i+3)-0.5)*290 + Math.sin(frame*0.021+i)*27;
    const scatterY = (hash(i+907)-0.5)*230 + Math.cos(frame*0.017+i*2)*23;
    return {x:p.x + scatterX*(1-align) + dx/d*push*410, y:p.y + scatterY*(1-align) + dy/d*push*410};
  });
  const pulseRadius = interpolate(frame, [90, 175], [0, 1300], {extrapolateLeft:'clamp',extrapolateRight:'clamp'});
  return <AbsoluteFill style={{background:'#191d20', overflow:'hidden'}}>
    <AbsoluteFill style={{background:'radial-gradient(ellipse at 50% 48%, #353a3c 0%, #202527 43%, #14181b 100%)'}} />
    <svg width="1920" height="1080" style={{position:'absolute',opacity:interpolate(frame,[0,30,220,310],[0,1,1,0],{extrapolateLeft:'clamp',extrapolateRight:'clamp'})}}>
      <defs><radialGradient id="halo"><stop stopColor="#c7d8d4" stopOpacity=".12"/><stop offset="1" stopColor="#c7d8d4" stopOpacity="0"/></radialGradient></defs>
      <circle cx="960" cy="540" r="650" fill="url(#halo)"/>
      {edges.map(([a,b],i) => <line key={i} x1={points[a].x} y1={points[a].y} x2={points[b].x} y2={points[b].y} stroke={i%13===0?'#b8d1cb':'#99a5aa'} strokeWidth={i%13===0?1.5:0.8} opacity={(0.09+align*0.18)*(0.55+hash(i)*0.45)}/>)}
      {points.map((p,i) => <circle key={i} cx={p.x} cy={p.y} r={i%11===0?3:1.7} fill={i%11===0?'#e3eae7':'#adbdbe'} opacity={0.2+hash(i)*0.45}/>)}
      <circle cx="960" cy="540" r={pulseRadius} fill="none" stroke="#d9e9e1" strokeWidth="1.4" opacity={interpolate(frame,[90,105,170],[0,0.5,0],{extrapolateLeft:'clamp',extrapolateRight:'clamp'})}/>
      <circle cx="960" cy="540" r={pulseRadius*0.86} fill="none" stroke="#942938" strokeWidth="2" opacity={interpolate(frame,[90,113,175],[0,0.5,0],{extrapolateLeft:'clamp',extrapolateRight:'clamp'})}/>
    </svg>
    <AbsoluteFill style={{background:'#FEFCF8',opacity:light}}/>
    <AbsoluteFill style={{background:'radial-gradient(ellipse at 38% 51%, rgba(148,41,56,.09), transparent 45%)',opacity:light}}/>
    <div style={{position:'absolute',left:logoX-220,top:320,width:440,height:440,borderRadius:'50%',background:'#942938',filter:'blur(65px)',opacity:progress(frame,180,215)*(1-light)*0.28,scale:logoScale}}/>
    {/* The supplied SVG is preserved byte-for-byte. A circular viewport isolates its emblem. */}
    <div style={{position:'absolute',left:logoX-154,top:386,width:308,height:308,borderRadius:'50%',overflow:'hidden',scale:logoScale,opacity:progress(frame,180,191),boxShadow:'0 16px 65px rgba(55,18,24,0.10)'}}>
      <Img src={staticFile('intro/niriksh-logo.svg')} style={{position:'absolute',width:1512,height:576,maxWidth:'none',left:-62,top:-130}} />
    </div>
    {/* A second viewport reveals the original lettering, without recreating the font. */}
    <div style={{position:'absolute',left:706,top:378,width:970,height:330,overflow:'hidden',opacity:interpolate(frame,[300,353],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp',easing:ease}),translate:interpolate(frame,[300,353],['26px 0px','0px 0px'],{extrapolateLeft:'clamp',extrapolateRight:'clamp',easing:ease})}}>
      <Img src={staticFile('intro/niriksh-logo.svg')} style={{position:'absolute',width:1512,height:576,maxWidth:'none',left:-412,top:-126}} />
    </div>
    <div style={{position:'absolute',left:706,top:746,width:760,height:1,background:'linear-gradient(90deg, #94293855, transparent)',opacity:progress(frame,354,384)}}/>
  </AbsoluteFill>;
};
