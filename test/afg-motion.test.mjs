import test from 'node:test';
import assert from 'node:assert/strict';
import {AfgModel} from '../src/instruments/afg/model.js';
import {emf} from '../src/bench/circuit.js';
import {solveNet} from '../src/bench/net.js';
import {Bench,DEMO} from '../src/bench/bench.js';
import {normalizeChannelExtension} from '../src/instruments/afg/extensions.js';
import {motionFrequency,motionCycles,normalizeMotion,motionDefaults,activeChannelsError,simulationPeriod} from '../src/instruments/afg/motion.js';
const near=(a,b,e=1e-9)=>assert.ok(Math.abs(a-b)<=e,`${a} vs ${b}`);
function run(m,s){let r=null;for(const k of s.split(' ')){if(/^-?[\d.]+$/.test(k)){for(const ch of k)r=m.press(`AFG.NUM.${ch==='.'?'DOT':ch==='-'?'PLUS_MINUS':`DIGIT_${ch}`}`);}else r=m.press(/^F\d$/.test(k)?`AFG.SOFT.${k}`:`AFG.KEY.${({WAVE:'WAVEFORM',FREQ:'FREQ_RATE',CH:'CH1_CH2',OUT:'OUTPUT',BACK:'RETURN'})[k]||k}`);}return r;}
const net=p=>solveNet({nodes:['A'],elements:[],afg:[{node:'A',p}]});

test('both continuous channels require a genuine bounded common period, never a CH1-period fallback',()=>{
 const m=new AfgModel();run(m,'OUT CH FREQ 1000.5 F3');assert.equal(m.ch[1].freq,1000.5);assert.equal(run(m,'OUT').kind,'reject');assert.deepEqual(m.ch.map(c=>c.output),[true,false]);
 run(m,'FREQ 1001 F3 OUT');assert.deepEqual(m.ch.map(c=>c.output),[true,true]);const p=m.ch.map((_,i)=>m.driverDescriptor(i)),s=solveNet({nodes:['A','B'],elements:[],afg:p.map((p,i)=>({node:i?'B':'A',p}))});near(s.period,1,1e-12);for(const t of [.25,.2505,.7503])near(s.nodeAt('B',t),emf(p[1],t),.007); // >=48 linear pieces per carrier cycle
 const before=m.ch.map(c=>({...c}));assert.equal(run(m,'FREQ 1000.5 F3').kind,'reject');assert.deepEqual(m.ch,before);
 const invalid=p.map(p=>({...p}));invalid[1].freq=1000.5;invalid[1].carrierFreq=1000.5;assert.match(activeChannelsError(invalid),/共同週期/);assert.throws(()=>simulationPeriod(invalid),RangeError);assert.throws(()=>solveNet({nodes:['A','B'],elements:[],afg:invalid.map((p,i)=>({node:i?'B':'A',p}))}),RangeError);
 invalid[1].freq=1000.000001;invalid[1].carrierFreq=1000.000001;assert.match(activeChannelsError(invalid),/共同週期/);
});

test('AM envelope, SUM addition and their actual measured RMS',()=>{
 const m=new AfgModel();run(m,'MOD F1 F2 50 F1 OUT');assert.equal(m.c.extended.motion.depth,50);assert.equal(m.c.extended.motion.mode,'MOD');
 const p=m.driverDescriptor(0),s=net(p);near(s.period,.01);for(const t of [.00025,.00275,.00675])near(emf(p,t),3*Math.sin(2*Math.PI*1000*t)*(1+.5*Math.sin(2*Math.PI*100*t)),1e-11);
 near(s.stats('A','E').acRms,2.25,1e-4);assert.match(m.lcd(),/Depth/);
 run(m,'MOD F5');const q=m.driverDescriptor(0),sum=net(q);for(const t of [.00137,.00577])near(emf(q,t),3*(Math.sin(2*Math.PI*1000*t)+.5*Math.sin(2*Math.PI*100*t)),1e-10);
 near(sum.stats('A','E').acRms,3*Math.sqrt(1.25/2),1e-4);
 assert.equal(run(m,'MOD F1 F2 120 F1 AMPL 5 F5').kind,'reject');assert.equal(m.c.emfVpp,6);
});

test('FM integrates frequency, PM changes phase, and FSK phase stays continuous at its real switch',()=>{
 const m=new AfgModel();run(m,'MOD F2 F2 200 F3');const p=m.driverDescriptor(0);
 for(const t of [.00031,.00125,.00375,.00722]){const phase=1000*t+200/(2*Math.PI*100)*(1-Math.cos(2*Math.PI*100*t));near(emf(p,t),3*Math.sin(2*Math.PI*phase),1e-10);}
 const s=net(p);near(s.period,.01);near(s.nodeAt('A',.00125),emf(p,.00125),1e-6);
 run(m,'MOD F4 F2 90 F1');const q=m.driverDescriptor(0);near(emf(q,.00123),3*Math.sin(2*Math.PI*1000*.00123+Math.PI/2*Math.sin(2*Math.PI*100*.00123)),1e-10);
 run(m,'MOD F3 F2 200 F3');const f=m.driverDescriptor(0);near(motionFrequency(f),100);near(motionCycles(f,.005-1e-9),motionCycles(f,.005+1e-9),2e-6);near(emf(f,.00125),3,1e-10);
 const fs=net(f);near(fs.nodeAt('A',.00125),3,1e-5);near(fs.stats('A','E').mean,0,1e-7);
});

test('FM/Square sharp corners and RC dynamics agree with an independent numerical ODE',()=>{
 const m=new AfgModel();run(m,'WAVE F2 MOD F2 F2 200 F3 OUT');const p=m.driverDescriptor(0),R=1000,C=100e-9,tau=(R+50)*C,T=.01,N=200000,h=T/N;
 const drive=t=>{const phase=1000*t+200/(2*Math.PI*100)*(1-Math.cos(2*Math.PI*100*t));return phase-Math.floor(phase)<.5?3:-3;};
 let v=0;const table=[];for(let cycle=0;cycle<4;cycle++)for(let k=0;k<N;k++){v=(v+h/tau*drive((k+.5)*h))/(1+h/tau);if(cycle===3)table.push(v);}
 const s=solveNet({nodes:['A','B'],elements:[{kind:'R',a:'A',b:'B',value:R},{kind:'C',a:'B',b:'E',value:C}],afg:[{node:'A',p}]});
 for(const t of [.000127,.001267,.003119,.007971,.009501])near(s.nodeAt('B',t),table[Math.round(t/h)-1],.002);
 assert.ok(s.mesh.length>4001);assert.ok(s.driveCuts.length>4000);
});

test('Linear Sweep integrates a true changing frequency and preserves phase across INT repetitions',()=>{
 const m=new AfgModel();run(m,'SWEEP OUT');const p=m.driverDescriptor(0),s=net(p);near(s.period,1);assert.ok(s.mesh.length>=48000);
 for(const t of [.000131,.099371,.601337,1.000131,2.601337]){const n=Math.floor(t),q=t-n,phase=n*550+100*q+450*q*q;near(emf(p,t),3*Math.sin(2*Math.PI*phase),1e-8);near(s.nodeAt('A',t),emf(p,t),.007);}
 near(emf(p,1-1e-10),emf(p,1+1e-10),3e-6);assert.equal(run(m,'F5 F1 500 F2').kind,'reject');assert.equal(m.c.extended.motion.sweepTime,1);
 assert.equal(run(m,'SWEEP SWEEP F2 F2').kind,'reject');assert.equal(m.c.extended.motion.sweepType,'LINEAR');
});

function realBench(m){let t=2.345;const b=new Bench(m);b.now=()=>t;b.C=1e-12;for(const [lead,node]of Object.entries(DEMO))b.connect(lead,node);b.solution();return {b,at(time){t=time;return b.solution();},time(){return t;}};}
test('Manual Log Sweep drives one real scan then continuous Start frequency with preserved phase',()=>{
 const m=new AfgModel();const clock=realBench(m);m.setTriggerSource(clock.time);run(m,'SWEEP F1 F3 BACK BACK F2 F2 OUT');assert.equal(m.c.extended.motion.source,'MANUAL');assert.equal(m.c.extended.motion.sweepType,'LOG');clock.b.solution();
 run(m,'BACK F1 F3 F1');const fired=clock.time();assert.deepEqual(m.driverTransitionTimes(fired),[fired+1]);clock.b.solution();
 const integral=q=>100*Math.expm1(Math.log(10)*q)/Math.log(10),startPhase=100*fired;
 for(const dt of [.00031,.19937,.79913]){clock.at(fired+dt);const expected=3*Math.sin(2*Math.PI*(startPhase+integral(dt)));near(clock.b.solution().nodeAt('A',fired+dt),expected,.009);}
 clock.at(fired+1+.01337);const endCycles=startPhase+integral(1),expected=3*Math.sin(2*Math.PI*(endCycles+100*.01337));near(clock.b.solution().nodeAt('A',fired+1+.01337),expected,.009);assert.equal(m.driverTransitionTimes(fired+1.001).length,0);
 assert.ok(clock.b.segs.some(g=>Math.abs(g.from-(fired+1))<1e-8));
});

test('N-Cycle Burst has true held gaps; manual Burst ends once, carries capacitor state and never repeats',()=>{
 const m=new AfgModel();run(m,'BURST F1 F1 2 F2 OUT');const p=m.driverDescriptor(0),s=net(p);near(s.period,.01);near(s.nodeAt('A',.00025),3,1e-4);near(s.nodeAt('A',.00225),0,1e-12);near(s.nodeAt('A',.01025),3,1e-4);
 const clock=realBench(m);clock.b.C=100e-9;m.setTriggerSource(clock.time);run(m,'BURST BURST F1 F5 F3 F1');const fired=clock.time();clock.b.solution();assert.deepEqual(m.driverTransitionTimes(fired),[fired+.002]);
 clock.at(fired+.00025);assert.ok(clock.b.solution().nodeAt('A',fired+.00025)>2.8);
 const tau=(clock.b.R+50)*clock.b.C,w=2*Math.PI*1000,expected=t=>3/(1+(w*tau)**2)*(Math.sin(w*t)-w*tau*Math.cos(w*t)+w*tau*Math.exp(-t/tau));
 for(const dt of [.00025,.00125,.00199]){clock.at(fired+dt);near(clock.b.vcAt(fired+dt),expected(dt),.001);}
 const end=fired+.002;clock.at(end+1e-8);near(clock.b.vcAt(end-1e-12),clock.b.vcAt(end+1e-12),1e-5);
 clock.at(end+.0001);near(clock.b.vcAt(end+.0001),expected(.002)*Math.exp(-.0001/tau),.001);
 for(const dt of [.01025,1.01025]){clock.at(fired+dt);near(clock.b.solution().nodeAt('A',fired+dt),0,1e-8);near(clock.b.vcAt(fired+dt),0,1e-8);}
});

test('motion ranges, incompatibilities, workload limits, channel rollback and strict persistence',()=>{
 const m=new AfgModel();run(m,'MOD F2');const before=JSON.stringify(m.ch);assert.equal(run(m,'FREQ 999.123 F3').kind,'reject');assert.equal(JSON.stringify(m.ch),before);
 assert.equal(run(m,'WAVE F5').kind,'reject');assert.equal(m.c.wave,'SINE');assert.equal(run(m,'MOD F2 F1 F2').kind,'reject');assert.equal(m.c.extended.motion.source,'INT');
 run(m,'MOD F1 F3 2 F1');assert.equal(m.c.extended.motion.frequency,100,'huge carrier/modulation ratio rejected');normalizeChannelExtension(m.c.extended,m.c);
 const bad=motionDefaults();bad.extra=1;assert.throws(()=>normalizeMotion(bad),TypeError);const nested=structuredClone(m.c.extended);nested.motion.frequency=0;assert.throws(()=>normalizeChannelExtension(nested,m.c),TypeError);
 run(m,'PRESET');assert.equal(m.c.extended.motion.mode,'CONT');assert.deepEqual(m.motionRuntime,[null,null]);
});
