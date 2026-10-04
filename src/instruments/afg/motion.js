// Ideal periodic teaching model based on AFG-2225 Ver.B p.66–131.
// Each source uses an analytically integrated phase. No frequency*time shortcut
// and no phase reset at a nonintegral modulation/sweep cycle are permitted.
export const MAX_MESH = 64000;
export const motionDefaults = () => ({ mode: 'CONT', type: 'AM', source: 'INT', shape: 'SINE', frequency: 100,
  depth: 100, deviation: 100, phaseDeviation: 180, hop: 100, sum: 50,
  sweepType: 'LINEAR', start: 100, stop: 1000, sweepTime: 1, marker: 550, markerOn: false,
  burstType: 'NCYCLE', cycles: 1, infinite: false, period: .01, burstPhase: 0, delay: 0,
  triggerOut: false, triggerEdge: 'RISE', gatePolarity: 'POS' });
const periodicTypes = ['SINE', 'SQUARE', 'RAMP'];
export function carrierRate(c) { if (c.wave === 'NOISE') return (c.extended?.noiseRate ?? 1e6) / 4096; if (c.wave === 'ARB') return (c.extended?.arb.rate ?? 4096e3) / (c.extended?.arb.length ?? 4096); return c.carrierFreq ?? c.freq; }
export function rational(x) {
  for (let d=1;d<=1024;d++) { const n=Math.round(x*d); if (n>0 && Math.abs(x-n/d)<=32*Number.EPSILON*Math.max(1,x)) return [n,d]; }
  return null;
}
const fract=x=>x-Math.floor(x);
export function modValue(shape,q) { q=fract(q); if(shape==='SINE')return Math.sin(2*Math.PI*q);if(shape==='SQUARE')return q<.5?1:-1;if(shape==='TRIANGLE')return q<.5?4*q-1:3-4*q;return shape==='UPRAMP'?2*q-1:1-2*q; }
export function modIntegral(shape,q) { q=fract(q); if(shape==='SINE')return (1-Math.cos(2*Math.PI*q))/(2*Math.PI);if(shape==='SQUARE')return q<.5?q:1-q;if(shape==='TRIANGLE')return q<.5?2*q*q-q:3*q-2*q*q-1;return (shape==='UPRAMP'?1:-1)*(q*q-q); }
export function sweepIntegral(s,t) { const u=Math.min(s.sweepTime,Math.max(0,t));if(s.sweepType==='LINEAR')return s.start*u+(s.stop-s.start)*u*u/(2*s.sweepTime); const l=Math.log(s.stop/s.start);return Math.abs(l)<1e-12?s.start*u:s.start*s.sweepTime*Math.expm1(l*u/s.sweepTime)/l; }
export function motionFrequency(c) {
 const s=c.extended?.motion,f=carrierRate(c);if(!s||s.mode==='CONT'||c._plain)return f;
 if(s.source==='MANUAL'||c._single){if(s.mode==='SWEEP')return 1/s.sweepTime;if(s.mode==='BURST')return 1/Math.max(.001,s.delay+s.cycles/f+201e-9);}
 if(s.mode==='BURST')return 1/s.period;
 if(s.mode==='SWEEP'){const r=rational(sweepIntegral(s,s.sweepTime));return r?1/(s.sweepTime*r[1]):NaN;}
 const mean=s.type==='FSK'?(f+s.hop)/2:f,r=rational(mean/s.frequency);return r?s.frequency/r[1]:NaN;
}
function periodContract(channels) {
 if(!channels.length)return {period:1,error:null};let base=motionFrequency(channels[0]);
 if(!(base>0)||!Number.isFinite(base))return {error:'輸出沒有可用的有限閉合週期'};
 for(const c of channels.slice(1)){const f=motionFrequency(c),r=Number.isFinite(f)&&f>0?rational(f/base):null;if(!r)return {error:'兩通道輸出需在1024以內有理比形成共同週期；此頻率組合無法解算，原值保留'};base/=r[1];}
 const T=1/base,work=Math.max(...channels.map(c=>meshDensity(c,T)))+channels.reduce((n,c)=>n+(c.wave==='ARB'?(c.extended?.arb?.length??4096):c.wave==='NOISE'?4096:2)*carrierRate(c)*T,0);
 return Number.isFinite(T)&&work<=MAX_MESH?{period:T,error:null}:{error:'輸出共同週期需超過64000解析區段，請降低頻率或縮短週期，原值保留'};
}
// One pure contract is shared by front-panel edits, restored sessions and the
// electrical solver. Falling back to CH1's period would silently alter CH2.
function manualDriverStates(c) {
 const s=c.extended?.motion;
 if(s?.source!=='MANUAL'||!['SWEEP','BURST'].includes(s.mode))return [c];
 // Idle and completed Sweep both run at Start, not 1 / sweepTime. A Manual
 // Burst holds its phase voltage when idle; Infinite becomes a plain carrier
 // after Delay. Use the same adapter as Bench instead of a second timing model.
 const fired={...c,triggeredAt:0};
 const states=[applyMotionAt({...c,triggeredAt:null},0),applyMotionAt(fired,0)];
 if(s.mode==='BURST'&&s.infinite)states.push(applyMotionAt(fired,s.delay));
 return states;
}
export function activeChannelsError(channels) {
 const active=channels.filter(c=>c.output!==false&&c.enabled!==false);
 // Manual channels can be triggered independently. Every combination must be
 // valid, including an active scan paired with another channel already idle.
 let pairs=[[]];
 for(const c of active)pairs=pairs.flatMap(pair=>manualDriverStates(c).map(driver=>[...pair,driver]));
 for(const pair of pairs){const error=periodContract(pair).error;if(error)return error;}
 return null;
}
export function simulationPeriod(channels) { const result=periodContract(channels);if(result.error)throw new RangeError(result.error);return result.period; }
export function motionCycles(c,t) {
 t-=c._timeOrigin??0;
 const s=c.extended.motion,f=carrierRate(c),phase=(['SQUARE','PULSE','NOISE'].includes(c.wave)?0:(c.phase??0)/360);
 if(s.mode==='CONT')return f*t+phase;
 if(s.mode==='SWEEP'){const n=Math.floor(t/s.sweepTime),u=t-n*s.sweepTime;return (c._single?0:n*sweepIntegral(s,s.sweepTime))+sweepIntegral(s,u)+phase;}
 if(s.mode==='BURST'){const u=fract(t/s.period)*s.period-s.delay;return Math.max(0,Math.min(s.cycles/f,u))*f+s.burstPhase/360;}
 const q=t*s.frequency;
 if(s.type==='FM')return f*t+s.deviation/s.frequency*modIntegral(s.shape,q)+phase;
 if(s.type==='PM')return f*t+s.phaseDeviation/360*modValue(s.shape,q)+phase;
 if(s.type==='FSK'){const n=Math.floor(q),u=fract(q)/s.frequency,h=.5/s.frequency;return n*(f+s.hop)*h+s.hop*Math.min(u,h)+f*Math.max(0,u-h)+phase;}
 return f*t+phase;
}
export function maxMotionRate(c) {const s=c.extended?.motion,f=carrierRate(c);if(!s||s.mode==='CONT')return f;if(s.mode==='SWEEP')return Math.max(s.start,s.stop);if(s.mode==='BURST')return f;if(s.type==='FM')return f+s.deviation;if(s.type==='PM')return f+s.phaseDeviation/360*s.frequency*(s.shape==='SINE'?2*Math.PI:4);if(s.type==='FSK')return Math.max(f,s.hop);return Math.max(f,s.frequency);}
export function meshDensity(c,T) {
 const s=c.extended?.motion;
 return Math.max(4000,Math.ceil(maxMotionRate(c)*T*48));
}
export function motionError(c,includeWork=true) {
 const s=c.extended?.motion;if(!s||s.mode==='CONT')return null;const f=carrierRate(c),max=c.wave==='RAMP'?1e6:(['FM','PM'].includes(s.type)||s.mode!=='MOD')&&c.wave==='SQUARE'?15e6:25e6;
 const allowed=s.mode==='SWEEP'?periodicTypes:s.mode==='BURST'?[...periodicTypes,'ARB']:({AM:[...periodicTypes,'PULSE','ARB'],FM:periodicTypes,PM:periodicTypes,FSK:[...periodicTypes,'PULSE'],SUM:[...periodicTypes,'PULSE','NOISE']}[s.type]);
 if(!allowed?.includes(c.wave))return `${s.mode==='MOD'?s.type:s.mode}不支援${c.wave}波形`;
 if(s.source==='EXT')return 'EXT需後面板外部訊號，目前未提供虛擬接線，原值保留';
 if(s.mode==='MOD'&&s.source!=='INT')return 'MOD只支援INT調變源';
 if(s.mode==='BURST'&&(s.burstType!=='NCYCLE'||s.infinite&&s.source!=='MANUAL'))return 'Gate/Infinite需要外部或手動觸發，目前請使用INT N Cycle';
 if(s.mode==='BURST'&&s.source==='INT'&&s.period<=s.delay+s.cycles/f+200e-9)return 'Burst Period須大於Delay+Cycles/Frequency+200ns';
 if(s.mode==='SWEEP'&&(s.start>max||s.stop>max||s.markerOn&&(s.marker<Math.min(s.start,s.stop)||s.marker>Math.max(s.start,s.stop))))return 'Sweep頻率超出波形範圍，或Marker不在Start/Stop間';
 if(s.mode==='MOD'&&s.type==='FM'&&(s.deviation>f||f+s.deviation>max))return 'FM Deviation須不大於Carrier，且最高瞬時頻率不能超出波形範圍';
 if(s.mode==='MOD'&&s.type==='FSK'&&s.hop>max)return 'FSK Hop頻率超出波形範圍';
 const gain=s.mode==='MOD'&&(s.type==='AM'||s.type==='SUM')?1+(s.type==='AM'?s.depth:s.sum)/100:1;
 if(Math.abs(c.emfOffset)+c.emfVpp/2*gain>(maxMotionRate(c)>=20e6?5:10)+2e-9)return '調变后的峰值超出AFG EMF範圍，請先降低AMPL/Offset';
 const freq=motionFrequency(c);if(!(freq>0)||!Number.isFinite(freq))return '教學週期解算要求頻率/積分相位可在1024個調變週期內整比重複，原值保留';
 if(includeWork){const T=1/freq,density=meshDensity(c,T),n=c.wave==='ARB'?c.extended.arb.length:c.wave==='NOISE'?4096:2,edges=(s.mode==='BURST'?s.cycles:f*T)*n;if(density+edges+8*T*(s.mode==='MOD'?s.frequency:1/(s.mode==='SWEEP'?s.sweepTime:s.period))>MAX_MESH)return '此參數需超過64000個解析區段；教學解算範圍不足，請縮短週期或降低頻率/波形點數，原值保留';}
 return null;
}
export function motionDrive(c,t,plain) {
 const s=c.extended?.motion;if(!s||s.mode==='CONT'||c._plain)return null;
 const cycles=motionCycles(c,t),f=carrierRate(c),raw={...c,carrierFreq:f,freq:f,phase:0,_plain:true};
 // The plain carrier remains analytic; only phase is remapped. Its load and
 // inversion are handled once by the caller, not twice in this adapter.
 const carrier=plain(raw,fract(cycles)/f);
 if(s.mode==='MOD'&&s.type==='AM')return c.emfOffset+(carrier-c.emfOffset)*(1+s.depth/100*modValue(s.shape,t*s.frequency));
 if(s.mode==='MOD'&&s.type==='SUM')return carrier+c.emfVpp/2*s.sum/100*modValue(s.shape,t*s.frequency);
 return carrier;
}
export function motionCuts(c,T) {
 const s=c.extended?.motion;if(!s||s.mode==='CONT'||c._plain)return null;
 const out=new Set([0,T]);
 const addPeriodic=(period,edges)=>{for(let k=Math.floor(-(c._timeOrigin??0)/period);k<=Math.ceil((T-(c._timeOrigin??0))/period)&&out.size<MAX_MESH;k++)for(const edge of edges){const t=(c._timeOrigin??0)+k*period+edge;if(t>0&&t<T)out.add(t);}};
 if(s.mode==='SWEEP')addPeriodic(s.sweepTime,[0]);
 else if(s.mode==='BURST')addPeriodic(s.period,[0,s.delay,s.delay+s.cycles/carrierRate(c)]);
 else {const period=1/s.frequency,edges=[0,.5*period];if(s.type==='PM'&&s.shape==='SINE'&&s.phaseDeviation){const v=-carrierRate(c)/(2*Math.PI*s.frequency*s.phaseDeviation/360);if(Math.abs(v)<1){const q=Math.acos(v)/(2*Math.PI);edges.push(q*period,(1-q)*period);}}addPeriodic(period,edges);}
 if(c.wave==='SINE')return [...out].filter(t=>t>0&&t<T);
 const phaseEdges=c.wave==='SQUARE'?[0,(c.duty??50)/100]:c.wave==='PULSE'?[0,(c.extended?.pulseWidth??100e-6)*carrierRate(c)]:c.wave==='RAMP'?[0,Math.min(1-1e-9,Math.max(1e-9,c.sym/100))]:Array.from({length:c.wave==='NOISE'?4096:c.extended.arb.length},(_,k)=>k/(c.wave==='NOISE'?4096:c.extended.arb.length));
 const boundaries=[...out].sort((a,b)=>a-b);
 for(let j=0;j+1<boundaries.length;j++){
  const a=boundaries[j],b=boundaries[j+1],pa=motionCycles(c,a+(b-a)*1e-12),pb=motionCycles(c,b-(b-a)*1e-12);if(Math.abs(pb-pa)<1e-14)continue;
  for(let cycle=Math.floor(Math.min(pa,pb))-1;cycle<=Math.ceil(Math.max(pa,pb))&&out.size<MAX_MESH;cycle++)for(const e of phaseEdges){const target=cycle+e;if(target<=Math.min(pa,pb)||target>=Math.max(pa,pb))continue;let lo=a,hi=b;for(let k=0;k<48;k++){const mid=(lo+hi)/2,p=motionCycles(c,mid);if((p<target)===(pb>pa))lo=mid;else hi=mid;}out.add((lo+hi)/2);}
 }
 return [...out].filter(t=>t>0&&t<T).sort((a,b)=>a-b);
}
export function normalizeMotion(value,path='AFG.motion') {
 const d=motionDefaults();if(value===undefined)return d;
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==Object.keys(d).length||Object.keys(value).some(k=>!(k in d)))throw new TypeError(`${path} has unsupported or missing fields`);
 const enums={mode:['CONT','MOD','SWEEP','BURST'],type:['AM','FM','FSK','PM','SUM'],source:['INT','EXT','MANUAL'],shape:['SINE','SQUARE','TRIANGLE','UPRAMP','DNRAMP'],sweepType:['LINEAR','LOG'],burstType:['NCYCLE','GATE'],triggerEdge:['RISE','FALL'],gatePolarity:['POS','NEG']};
 const bounds={frequency:[.002,20000],depth:[0,120],deviation:[0,25e6],phaseDeviation:[0,360],hop:[1e-6,25e6],sum:[0,100],start:[1e-6,25e6],stop:[1e-6,25e6],sweepTime:[.001,500],marker:[1e-6,25e6],cycles:[1,65535],period:[.001,500],burstPhase:[-360,360],delay:[0,655350e-9]};
 for(const [k,v]of Object.entries(value)){if(enums[k]){if(!enums[k].includes(v))throw new TypeError(`${path}.${k} invalid`);}else if(bounds[k]){const[lo,hi]=bounds[k];if(typeof v!=='number'||!Number.isFinite(v)||v<lo||v>hi||k==='cycles'&&!Number.isInteger(v))throw new TypeError(`${path}.${k} invalid`);}else if(typeof v!=='boolean')throw new TypeError(`${path}.${k} must be boolean`);}
 return {...value};
}

function rawShape(c,cycles){const q=fract(cycles);if(c.wave==='SINE')return Math.sin(2*Math.PI*q);if(c.wave==='SQUARE')return q<(c.duty??50)/100?1:-1;if(c.wave==='RAMP'){const k=Math.max(1e-9,Math.min(1-1e-9,c.sym/100));return q<k?-1+2*q/k:1-2*(q-k)/(1-k);}if(c.wave==='ARB'){const a=c.extended.arb;return a.points[a.start+Math.min(a.length-1,Math.floor(q*a.length))]/511;}return 0;}
export function motionEnd(p,time=-Infinity){const s=p.extended?.motion,start=p.triggeredAt;if(!s||s.source!=='MANUAL'||!Number.isFinite(start)||s.mode==='CONT')return null;const end=s.mode==='SWEEP'?start+s.sweepTime:s.infinite?start+s.delay:start+s.delay+s.cycles/carrierRate(p);return end>time+1e-12?end:null;}
export function applyMotionAt(p,time){
 const s=p.extended?.motion,start=p.triggeredAt;if(!s||s.source!=='MANUAL'||s.mode==='CONT')return p;
 const c={...p,extended:{...p.extended,motion:{...s}}},f=carrierRate(p),end=Number.isFinite(start)?(s.mode==='SWEEP'?start+s.sweepTime:s.infinite?Infinity:start+s.delay+s.cycles/f):Infinity;
 if(Number.isFinite(start)&&time>=start&&time<end){
  c._timeOrigin=start;c._single=true;if(s.mode==='SWEEP')c.phase=((p.phase??0)/360+s.start*start)*360;
  if(s.mode==='BURST'){c.extended.motion.period=Math.max(.001,s.delay+s.cycles/f+201e-9);if(s.infinite&&time>=start+s.delay){c.extended.motion.mode='CONT';c._driverPhase=s.burstPhase/360-f*(start+s.delay);c.phase=c._driverPhase*360;c._timeOrigin=0;}}
  return c;
 }
 c.extended.motion.mode='CONT';c._timeOrigin=0;
 if(s.mode==='BURST'){c.wave='SINE';c.emfVpp=0;c.emfOffset=(p.extended.inverted?-1:1)*(p.emfOffset+p.emfVpp/2*rawShape(p,s.burstPhase/360));c.extended.inverted=false;c.phase=0;}
 else{c.freq=s.start;c.carrierFreq=s.start;const phase=(p.phase??0)/360;if(Number.isFinite(start)&&time>=end)c.phase=(phase+s.start*start+sweepIntegral(s,s.sweepTime)-s.start*end)*360;else c.phase=p.phase??0;}
 return c;
}
