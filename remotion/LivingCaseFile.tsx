import React from 'react';
import {AbsoluteFill, Img, interpolate, interpolateColors, Easing, staticFile, useCurrentFrame} from 'remotion';

const curve = Easing.bezier(.22,1,.36,1);
const p = (f:number,a:number,b:number) => interpolate(f,[a,b],[0,1],{easing:curve,extrapolateLeft:'clamp',extrapolateRight:'clamp'});
const ink='#203831', red='#942938';

function Seal({size=110}:{size?:number}) {
  return <div style={{width:size,height:size,borderRadius:'50%',overflow:'hidden',position:'relative',flexShrink:0}}><Img src={staticFile('intro/niriksh-logo.svg')} style={{position:'absolute',maxWidth:'none',width:size*378/77,height:size*144/77,left:-size*15.5/77,top:-size*32.5/77}}/></div>;
}

export const LivingCaseFile:React.FC = () => {
  const f=useCurrentFrame();
  const gather=p(f,180,242), close=p(f,231,281), end=p(f,279,323);
  return <AbsoluteFill style={{background:'#f5f2eb',color:ink,fontFamily:'Arial, sans-serif',overflow:'hidden'}}>
    <AbsoluteFill style={{background:'radial-gradient(ellipse at 50% 40%, #fffefa 0%, #f5f2eb 65%, #e8e3d9 100%)'}}/>
    <div style={{position:'absolute',left:110,top:82,fontSize:17,letterSpacing:4,color:'#8d938a',opacity:1-end}}>NIRIKSH / EVIDENCE INTELLIGENCE</div>
    <div style={{position:'absolute',right:110,top:82,fontSize:17,letterSpacing:3,color:'#8d938a',opacity:1-end}}>01 — UNDERSTAND</div>
    <div style={{position:'absolute',top:167,width:'100%',textAlign:'center',fontSize:57,fontFamily:'Georgia, serif',letterSpacing:-2,opacity:p(f,5,34)*(1-p(f,170,201)),translate:`0 ${18*(1-p(f,5,34))}px`}}>Every detail has a story.</div>
    <div style={{position:'absolute',left:630,top:340,width:660,height:450,borderRadius:18,background:'#e4d9c6',boxShadow:'0 35px 85px #30281722',opacity:p(f,175,207)*(1-end)}}/>
    {[0,1,2].map((i)=>{
      const enter=p(f,8+i*12,54+i*12);
      const x=[237,741,1245][i]*(1-gather)+740*gather;
      const y=[350,310,367][i]*(1-gather)+(355+i*9)*gather;
      return <div key={i} style={{position:'absolute',left:x,top:y+70*(1-enter),width:440,height:365,padding:34,boxSizing:'border-box',background:'#fffefa',border:'1px solid #ddd8cc',borderRadius:6,boxShadow:'0 24px 45px #30281715',rotate:`${[-5,2,-3][i]*(1-gather)}deg`,opacity:enter*(1-close),scale:1-.03*gather}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',color:red,fontSize:15,letterSpacing:2,fontWeight:700}}><span>{['MESSAGE','PAYMENT RECEIPT','VOICE NOTE'][i]}</span><span style={{color:'#9d9d92'}}>0{i+1}</span></div>
        <div style={{height:1,background:'#e6e3da',margin:'25px 0'}}/>
        {i===0?<><div style={{fontFamily:'Georgia, serif',fontSize:29,lineHeight:1.4}}>“They asked me to pay<br/>a verification fee.”</div><div style={{fontSize:18,color:'#899087',marginTop:19}}>Submitted message</div></>:i===1?<><div style={{fontSize:16,color:'#899087'}}>AMOUNT TRANSFERRED</div><div style={{fontFamily:'Georgia, serif',fontSize:52,marginTop:9}}>₹25,000<span style={{fontSize:23,color:'#8a9289'}}>.00</span></div><div style={{fontSize:18,color:'#899087',marginTop:10}}>Transaction evidence</div></>:<><div style={{height:81,display:'flex',gap:6,alignItems:'center'}}>{Array.from({length:36},(_,k)=><div key={k} style={{width:4,borderRadius:3,background:'#68877b',height:12+Math.abs(Math.sin(k*1.7))*(26+22*Math.sin(k*.23+f*.07)*(1-gather))}}/>)}</div><div style={{fontSize:18,color:'#899087',marginTop:12}}>“The same payment address…”</div></>}
        <div style={{marginTop:25,padding:'13px 14px',borderRadius:4,background:interpolateColors(p(f,97+i*7,123+i*7),[0,1],['#f2f1eb','#f3dfe0']),color:red,fontSize:21,fontWeight:600}}>demo-invest@upi</div>
      </div>;
    })}
    <svg width="1920" height="1080" style={{position:'absolute',opacity:p(f,115,139)*(1-p(f,178,202))}}>
      <path d="M460 694 C650 810 737 810 961 671 S1320 763 1465 700" fill="none" stroke={red} strokeWidth="2" pathLength="1" strokeDasharray="1" strokeDashoffset={1-p(f,118,170)}/>
      {[ [460,694],[961,671],[1465,700] ].map(([x,y],i)=><circle key={i} cx={x} cy={y} r="6" fill={red} opacity={p(f,116+i*13,132+i*13)}/>)}
    </svg>
    <div style={{position:'absolute',top:882,width:'100%',textAlign:'center',fontSize:20,letterSpacing:2,color:red,opacity:p(f,130,155)*(1-p(f,185,205))}}>ONE SHARED DETAIL. A CLEARER PICTURE.</div>
    <div style={{position:'absolute',left:630,top:340,width:660,height:450,boxSizing:'border-box',borderRadius:18,background:'linear-gradient(135deg,#eee4d2,#dacfba)',border:'1px solid #cfc1a8',boxShadow:'0 30px 70px #342d231c',opacity:close*(1-end),scale:1-.1*end,transformOrigin:'left center',rotate:`${-6*(1-close)}deg`}}>
      <div style={{position:'absolute',top:35,left:42,fontSize:14,letterSpacing:3,color:'#8f8270'}}>NIRIKSH / CASE INTELLIGENCE</div>
      <div style={{position:'absolute',top:140,left:275}}><Seal/></div>
      <div style={{position:'absolute',top:282,width:'100%',textAlign:'center',fontFamily:'Georgia, serif',fontSize:31}}>The evidence, brought together.</div>
      <div style={{position:'absolute',bottom:35,left:42,fontSize:15,color:'#8f8270',letterSpacing:2}}>SOURCE-BACKED · HUMAN-REVIEWED</div>
    </div>
    <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',opacity:end,translate:`0 ${24*(1-end)}px`}}>
      <div style={{display:'flex',alignItems:'center',gap:33}}><Seal size={144}/><div><div style={{fontFamily:'Georgia, serif',fontWeight:700,fontSize:112,letterSpacing:-5,lineHeight:1.05}}>Niriksh</div><div style={{fontSize:17,letterSpacing:5.7,marginTop:16,color:'#899087'}}>EVIDENCE INTELLIGENCE</div></div></div>
      <div style={{width:65,height:2,background:red,marginTop:57,opacity:p(f,327,350)}}/>
      <div style={{fontFamily:'Georgia, serif',fontSize:37,marginTop:30,opacity:p(f,334,363)}}>Every complaint should make the next one safer.</div>
    </div>
  </AbsoluteFill>;
};
