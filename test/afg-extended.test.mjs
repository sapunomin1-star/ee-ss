import test from 'node:test';
import assert from 'node:assert/strict';
import { AfgModel, fromVpp } from '../src/instruments/afg/model.js';
import { channelExtensionDefaults, instrumentExtensionDefaults, normalizeChannelExtension, normalizeInstrumentExtension, noisePoints, electricalFrequency } from '../src/instruments/afg/extensions.js';
import { emf, solve, nodeAt } from '../src/bench/circuit.js';
import { solveNet } from '../src/bench/net.js';
const near=(a,b,e=1e-9)=>assert.ok(Math.abs(a-b)<=e,`${a} vs ${b}`);
function run(m,s){let r=null;for(const k of s.split(' ')){if(/^-?[\d.]+$/.test(k)){for(const ch of k)r=m.press(`AFG.NUM.${ch==='.'?'DOT':ch==='-'?'PLUS_MINUS':`DIGIT_${ch}`}`);}else r=m.press(/^F\d$/.test(k)?`AFG.SOFT.${k}`:`AFG.KEY.${({WAVE:'WAVEFORM',FREQ:'FREQ_RATE',CH:'CH1_CH2',OUT:'OUTPUT',BACK:'RETURN'})[k]||k}`);}return r;}
const net=(p,elements=[])=>solveNet({nodes:['A','B'],elements,afg:[{node:'A',p}]});
const clone=x=>JSON.parse(JSON.stringify(x));

test('Pulse width units, bounds and 20 ns pulse are real electrical plateaus',()=>{
 const m=new AfgModel();run(m,'WAVE F3 F1 500 F2 FREQ 1 F5 WAVE F3 F1 20 F2 OUT');
 assert.equal(m.c.freq,1e6);assert.equal(m.c.extended.pulseWidth,20e-9);assert.match(m.lcd(),/Width/);
 assert.equal(run(m,'10 F2').kind,'reject');assert.equal(m.c.extended.pulseWidth,20e-9);
 const p=m.descriptor(0),s=net(p);near(s.nodeAt('A',19e-9),3,1e-8);near(s.nodeAt('A',20e-9),-3,1e-8);
 near(s.stats('A','E').mean,3*(2*.02-1),1e-8);near(s.stats('A','E').acRms,6*Math.sqrt(.02*.98),1e-8);
 const R=1000,C=100e-12,tau=(R+50)*C,T=1e-6,w=20e-9,eh=Math.exp(-w/tau),el=Math.exp(-(T-w)/tau),v0=(-3*(1-el)+el*3*(1-eh))/(1-eh*el),v1=3+(v0-3)*eh;
 const expected=t=>t<w?3+(v0-3)*Math.exp(-t/tau):-3+(v1+3)*Math.exp(-(t-w)/tau);
 const rc=net(p,[{kind:'R',a:'A',b:'B',value:R},{kind:'C',a:'B',b:'E',value:C}]);
 const fixed=solve({topo:'RC',R,C,wires:{'AFG.CH1+':'A','AFG.CH1-':'G'}},[{...m.c,output:true},{...m.c,output:false}]);
 for(const t of [0,10e-9,w,w+tau,T-1e-12]){near(rc.nodeAt('B',t),expected(t),1e-8);near(nodeAt(fixed,'B',t),expected(t),1e-8);}
});

test('Noise fixed seeded waveform has exact zero mean and actual measured RMS, no panel Frequency',()=>{
 const m=new AfgModel();run(m,'WAVE F5 OUT');const p=m.descriptor(0),points=noisePoints(p.extended.noiseSeed),s=net(p);
 assert.equal(points.length,4096);assert.equal(points.reduce((a,b)=>a+b,0),0);assert.notDeepEqual(points,noisePoints(p.extended.noiseSeed+1));
 assert.equal(electricalFrequency(p),1e6/4096);assert.match(run(m,'FREQ').text,/不適用/);assert.equal((m.lcd().match(/FREQ:/g)||[]).length,1);assert.match(m.status()[0][1],/CH1/);
 const rms=3*Math.sqrt(points.reduce((v,p)=>v+(p/511)**2,0)/points.length);
 near(s.stats('A','E').mean,0,1e-12);near(s.stats('A','E').acRms,rms,1e-8);near(fromVpp(3,'VRMS',m.c),rms/2,1e-10);
 for(const k of [0,10,3095,4095]) near(emf(p,(k+.5)/1e6),3*points[k]/511,1e-10);
 assert.match(m.status().find(r=>r[0]==='CH1')[1],/Frequency N\/A/);
});

function point(m,address,value){run(m,`ARB F2 F1 F1 ${address} F2 BACK F2 ${value} F2 BACK F3 BACK BACK`);}
test('ARB point editing, output range, rate and protect drive a real four-sample signal',()=>{
 const m=new AfgModel();point(m,0,511);point(m,1,0);point(m,2,-511);point(m,3,0);
 run(m,'ARB F4 F2 4 F2 BACK FREQ 4 F4 OUT');let a=m.c.extended.arb;assert.equal(a.length,4);assert.equal(a.rate,4000);assert.equal(m.c.freq,1000);
 const s=net(m.descriptor(0));for(const [t,v] of [[.0001,3],[.0003,0],[.0006,-3],[.0009,0]])near(s.nodeAt('A',t),v,1e-8);
 near(s.stats('A','E').mean,0,1e-12);near(s.stats('A','E').acRms,3/Math.sqrt(2),1e-8);
 run(m,'ARB F2 F5 F1 F1 BACK');assert.equal(a.protectLength,4096);
 assert.equal(run(m,'F1 F1 0 F2 BACK F2 100 F2 BACK F3').kind,'reject');assert.equal(a.points[0],511);
 run(m,'BACK F5 F5 F1');a=m.c.extended.arb;assert.equal(a.protectLength,0);
 assert.match(m.lcd(),/ARB/);assert.equal(normalizeChannelExtension(a===m.c.extended? a:m.c.extended,m.c).arb.length,4);
});

test('ARB line/copy/clear, built-in recipes and display controls are applied to data and viewport',()=>{
 const m=new AfgModel();run(m,'ARB F2 F2 F2 4 F2 BACK F3 400 F2 BACK F5');assert.deepEqual(m.c.extended.arb.points.slice(0,5),[0,100,200,300,400]);
 run(m,'BACK F3 F2 5 F2 BACK F3 10 F2 BACK F4');assert.deepEqual(m.c.extended.arb.points.slice(10,15),[0,100,200,300,400]);
 run(m,'BACK F4 F1 10 F2 BACK F2 5 F2 BACK F3');assert.deepEqual(m.c.extended.arb.points.slice(10,15),[0,0,0,0,0]);
 run(m,'ARB F3 F5');assert.ok(m.c.extended.arb.points[0]>400);assert.equal(m.c.extended.arb.points[16],0);
 run(m,'ARB F1 F1 F4');assert.equal(m.c.extended.arb.displayLength,2048);run(m,'F5');assert.equal(m.c.extended.arb.displayLength,4096);
 run(m,'BACK F2 F4');assert.ok(m.c.extended.arb.high-m.c.extended.arb.low<1022);
});

test('ten memory slots keep exact state/ARB through Preset, recall and deletion',()=>{
 const m=new AfgModel();run(m,'WAVE F3 F1 200 F3 AMPL 2 F5 OUT UTIL F1');m.turn('AFG.KNOB.SCROLL_WHEEL',1);run(m,'F1 F5 F5');
 const slot=clone(m.extended.memories[1]);assert.equal(slot.settings.ch[0].wave,'PULSE');assert.equal(slot.settings.ch[0].output,true);assert.equal(slot.arb.length,2);
 normalizeInstrumentExtension(m.extended);run(m,'PRESET');assert.deepEqual(m.extended.memories[1],slot);run(m,'UTIL F1');m.turn('AFG.KNOB.SCROLL_WHEEL',1);run(m,'F2 F5 F5');
 assert.equal(m.c.wave,'PULSE');near(m.c.extended.pulseWidth,200e-6);assert.equal(m.c.emfVpp,4);assert.equal(m.c.output,true);
 run(m,'F3 F5 F5');assert.equal(m.extended.memories[1],null);run(m,'F4 F1');assert.ok(m.extended.memories.every(x=>x===null));
});

test('coupling and tracking affect both output descriptors and reject an invalid coupled edit atomically',()=>{
 const m=new AfgModel();run(m,'UTIL F4 F1 F2 1 F4');assert.equal(m.extended.freqCoupled,true);assert.equal(m.ch[1].freq,2000);
 run(m,'CH FREQ 3 F4');assert.equal(m.ch[0].freq,2000);assert.equal(m.ch[1].freq,3000);
 run(m,'UTIL F4 F1 F1 2 F5');assert.equal(m.ch[0].freq,1500);assert.equal(m.ch[1].freq,3000);
 const before=m.ch.map(c=>c.freq);assert.equal(run(m,'CH FREQ 20 F5').kind,'reject');assert.deepEqual(m.ch.map(c=>c.freq),before);
 run(m,'UTIL F4 F1 F3 BACK F2 F1 AMPL 2 F5');assert.equal(m.ch[0].emfVpp,4);assert.equal(m.ch[1].emfVpp,4);
 run(m,'UTIL F4 F3 F2 WAVE F2 F1 20 F2');assert.equal(m.ch[0].wave,'SQUARE');assert.equal(m.ch[0].duty,20);assert.equal(m.extended.amplCoupled,false);
 run(m,'UTIL F4 F3 F3 DC_OFFSET 1 F2');const p=m.descriptor(1),q=m.descriptor(0);near(emf(q,.0001),-emf(p,.0001));assert.equal(m.ch[0].output,false);
 run(m,'UTIL F4 F3 F1 CH CH WAVE F1 CH CH F4 F1 45 F5 F2');assert.ok(m.ch.every(c=>c.phase===0));
});

test('Counter uses supplied measurement and DSO Link imports actual acquisition rather than AFG settings',()=>{
 const m=new AfgModel();let f=null;m.setCounterSource(()=>f);run(m,'UTIL F5');assert.equal(m.extensionRows()[1][1],'—');f=1000.25;assert.match(m.extensionRows()[1][1],/1000.000/);
 run(m,'F1 F4');assert.equal(m.extended.gate,10);assert.match(m.extensionRows()[1][1],/1000.300/);
 m.setDsoSource(()=>({rec:{v:[[1,2,3,2],[0,1,0,-1]]}}));run(m,'CH F5 F1 F2');assert.equal(m.c.wave,'ARB');assert.deepEqual(m.c.extended.arb.points.slice(0,4),[-511,0,511,0]);assert.equal(m.c.extended.arb.length,4);
 assert.equal(run(m,'CH CH F5 F4').kind,'reject');
});

test('ARB JSON import/export uses selected addresses, strict samples and protection, with real output',()=>{
 const m=new AfgModel(),file={format:'ee-ss-afg-arb',version:1,rate:4000,points:[511,0,-511,0]};m.c.extended.arb.loadTo=10;
 assert.equal(m.importArbFile(file).kind,'info');assert.equal(m.c.wave,'ARB');assert.equal(m.c.freq,1000);assert.equal(m.c.extended.arb.start,10);
 run(m,'OUT');const p=m.descriptor(0);near(emf(p,.0001),3);near(emf(p,.0006),-3);
 m.c.extended.arb.saveStart=10;m.c.extended.arb.saveLength=4;assert.deepEqual(m.exportArbFile(),file);
 const calls=[];m.setArbFileHandler((operation,payload)=>{calls.push([operation,payload]);return {kind:'info',text:'file callback'};});run(m,'ARB F5 F1 F4');assert.deepEqual(calls[0],['SAVE',file]);run(m,'ARB F5 F2 F4');assert.deepEqual(calls[1],['LOAD',null]);
 const state=clone(m.ch);for(const bad of [{...file,points:[.1]},{...file,points:Array(4097).fill(0)},{...file,unexpected:1},{...file,rate:Infinity}]){assert.throws(()=>m.importArbFile(bad),TypeError);assert.deepEqual(m.ch,state);}
 m.c.extended.arb.protectStart=10;m.c.extended.arb.protectLength=4;const protectedState=clone(m.ch);assert.equal(m.importArbFile({...file,points:[0,0,0,0]}).kind,'reject');assert.deepEqual(m.ch,protectedState);
 const single=new AfgModel();single.importArbFile({...file,points:[511]});assert.equal(single.c.extended.arb.length,2);assert.deepEqual(single.c.extended.arb.points.slice(0,2),[511,0]);
});

test('Beep hook follows real setting/power and TTL/S_Phase change electrical descriptors',()=>{
 const m=new AfgModel();let beeps=0;m.setBeepHandler(()=>beeps++);run(m,'UTIL F3 F3');assert.equal(beeps,0);run(m,'F1');assert.equal(beeps,1);run(m,'BACK');assert.equal(beeps,2);run(m,'UTIL F3 F3 F2');const muted=beeps;run(m,'WAVE F2 F3 OUT');assert.equal(beeps,muted);
 near(m.c.emfVpp,5);near(m.c.emfOffset,2.5);near(m.refVpp(),2.5);near(m.refOffset(),1.25);const p=m.descriptor(0);near(emf(p,.0001),5);near(emf(p,.0006),0);
 run(m,'WAVE F1 CH CH F4 F1 45 F5 CH F4 F1 90 F5 F2');assert.ok(m.ch.every(c=>c.phase===0));run(m,'UTIL F3 F3 F1');const active=beeps;m.press('AFG.PWR.POWER');run(m,'WAVE');assert.equal(beeps,active);
});

test('strict extension validators clone defaults, reject bad nested data and do not mutate saved live state',()=>{
 const a=normalizeChannelExtension(undefined),b=normalizeChannelExtension(undefined);a.arb.points[0]=1;assert.equal(b.arb.points[0],0);
 const source=channelExtensionDefaults(),saved=normalizeChannelExtension(source);saved.arb.points[0]=511;assert.equal(source.arb.points[0],0);
 for(const mutate of [x=>x.extra=1,x=>x.arb.extra=1,x=>x.arb.points.push(0),x=>x.arb.points[0]=.5,x=>x.noiseRate=2e6,x=>x.inverted='yes',x=>x.arb.rate=Infinity]){const bad=channelExtensionDefaults();mutate(bad);assert.throws(()=>normalizeChannelExtension(bad),TypeError);}
 const state=instrumentExtensionDefaults();state.memories[0]={arb:[source,source]};assert.throws(()=>normalizeInstrumentExtension(state),TypeError);
 const m=new AfgModel();run(m,'UTIL F1 F1 F5 F5');normalizeInstrumentExtension(m.extended);const bad=clone(m.extended);bad.memories[0].settings.ch[0].extended.arb.points[0]=600;assert.throws(()=>normalizeInstrumentExtension(bad),TypeError);
});
