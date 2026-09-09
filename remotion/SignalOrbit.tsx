import React from 'react';
import {AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame} from 'remotion';

const ease = Easing.bezier(.76,0,.24,1);
const move = (f:number,a:number,b:number) => interpolate(f,[a,b],[0,1],{easing:ease,extrapolateLeft:'clamp',extrapolateRight:'clamp'});

export const SignalOrbit:React.FC = () => {
  const f=useCurrentFrame();
  const opening=move(f,28,70);
  const collapse=move(f,132,204);
  const lock=move(f,229,280);
  const ringOpacity=move(f,40,65)*(1-move(f,183,213));
  const emblem=move(f,187,218);
  return <AbsoluteFill style={{background:'#f7f4ed',color:'#1c302b',overflow:'hidden',fontFamily:'Arial, sans-serif'}}>
    <div style={{position:'absolute',left:80,top:68,fontSize:14,letterSpacing:4,opacity:1-lock}}>N / EVIDENCE INTELLIGENCE</div>
    <div style={{position:'absolute',right:80,top:68,width:7,height:7,borderRadius:'50%',background:'#942938'}}/>
    <div style={{position:'absolute',left:0,top:310,width:'100%',textAlign:'center',fontSize:270,fontWeight:800,letterSpacing:-20,lineHeight:1,translate:`${-opening*2100}px 0px`,opacity:1-opening}}>Look closer<span style={{color:'#942938'}}>.</span></div>
    <svg width="1920" height="1080" style={{position:'absolute',opacity:ringOpacity}}>
      <g transform={`translate(960 540) rotate(${f*1.4})`}>
        {[0,1,2,3,4,5].map(i=><g key={i} transform={`rotate(${i*30})`}>
          <ellipse cx="0" cy="0" rx={(460-i*22)*(1-collapse)+70*collapse} ry={(92+i*17)*(1-collapse)+70*collapse} fill="none" stroke={i%2===0?'#942938':'#203b32'} strokeWidth={i%2===0?3:1.4}/>
          <circle cx={(460-i*22)*(1-collapse)+70*collapse} cy="0" r={i%2===0?8:4} fill="#942938"/>
        </g>)}
      </g>
    </svg>
    <div style={{position:'absolute',left:0,top:488,width:'100%',textAlign:'center',fontSize:72,fontWeight:700,letterSpacing:-3,opacity:move(f,78,94)*(1-move(f,123,144))}}>Find the signal.</div>
    <div style={{position:'absolute',left:960-4,top:540-4,width:8,height:8,borderRadius:'50%',background:'#942938',scale:interpolate(f,[145,182,208],[1,10,1],{easing: ease,extrapolateLeft:'clamp',extrapolateRight:'clamp'}),opacity:move(f,140,151)*(1-emblem)}}/>
    <div style={{position:'absolute',left:960-92-280*lock,top:448,width:184,height:184,borderRadius:'50%',overflow:'hidden',opacity:emblem,scale:interpolate(f,[187,218,230],[.2,1.08,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'})}}>
      <Img src={staticFile('intro/niriksh-logo.svg')} style={{position:'absolute',width:903.27,height:344.1,maxWidth:'none',left:-37.04,top:-77.66}}/>
    </div>
    <div style={{position:'absolute',left:812,top:439,width:640,height:210,overflow:'hidden'}}>
      <div style={{fontFamily:'Georgia, serif',fontWeight:700,fontSize:154,letterSpacing:-8,lineHeight:1.1,translate:`0px ${220*(1-lock)}px`}}>Niriksh</div>
    </div>
    <div style={{position:'absolute',left:817,top:625,fontSize:17,letterSpacing:6,color:'#69736b',opacity:move(f,277,304)}}>EVIDENCE INTELLIGENCE</div>
    <div style={{position:'absolute',bottom:175,width:'100%',textAlign:'center',fontSize:25,letterSpacing:1,color:'#56635a',opacity:move(f,306,336)}}>Understand. Learn. Prevent.</div>
    <div style={{position:'absolute',left:80,bottom:65,fontSize:13,letterSpacing:3,color:'#8e9389',opacity:move(f,311,339)}}>AI-ASSISTED. HUMAN-REVIEWED.</div>
    <div style={{position:'absolute',right:80,bottom:65,fontSize:13,letterSpacing:3,color:'#8e9389',opacity:move(f,311,339)}}>NIRIKSH / 01</div>
  </AbsoluteFill>;
};
