import test from 'node:test';
import assert from 'node:assert/strict';
import {createInstruments} from '../src/instruments/index.js';
import {Bench,DEMO} from '../src/bench/bench.js';
import {captureSession,validateSession,restoreSession} from '../src/core/session.js';
const near=(a,b,tol=1e-8)=>assert.ok(Math.abs(a-b)<=tol,`${a} vs ${b}`);
function run(m,s){let r;for(const x of s.split(' ')){if(/^-?[\d.]+$/.test(x)){for(const c of x)r=m.press(`AFG.NUM.${c==='.'?'DOT':c==='-'?'PLUS_MINUS':`DIGIT_${c}`}`);}else r=m.press(/^F\d$/.test(x)?`AFG.SOFT.${x}`:`AFG.KEY.${({WAVE:'WAVEFORM',FREQ:'FREQ_RATE',CH:'CH1_CH2',OUT:'OUTPUT',BACK:'RETURN'})[x]||x}`);}return r;}
function setup(){const models=createInstruments(),m=models.afg,b=new Bench(m,models.dmm,models.gpe);let time=0;b.now=()=>time;m.setTriggerSource(()=>time);for(const lead of ['AFG.CH1+','AFG.CH1-'])b.connect(lead,DEMO[lead]);b.solution();return {models,m,b,at(t){time=t;return b.solution();}};}

test('Noise/ARB waveform switches cannot bypass the physical MHz amplitude or frequency limit',()=>{
 const s=setup(),{m,models,b}=s;run(m,'FREQ 25 F5 WAVE F5 AMPL 10 F5 OUT');const before=structuredClone(m.ch);assert.equal(run(m,'WAVE F1').kind,'reject');assert.deepEqual(m.ch,before);assert.equal(m.c.wave,'NOISE');validateSession(captureSession(models,b));
 run(m,'PRESET ARB F4 F2 2 F2 BACK FREQ 120 F5 OUT');assert.equal(m.c.freq,60e6);const arb=structuredClone(m.ch);assert.equal(run(m,'WAVE F1').kind,'reject');assert.deepEqual(m.ch,arb);validateSession(captureSession(models,b));
});

test('a one-code ARB vertical window moves without collapsing and survives a real session roundtrip',()=>{
 const s=setup(),{m,models,b}=s;run(m,'ARB F1 F2 F1 510 F2 BACK F2 511 F2 BACK F3 500 F2');assert.deepEqual([m.c.extended.arb.low,m.c.extended.arb.high],[499,500]);assert.doesNotMatch(m.lcd(),/\b(?:NaN|Infinity)\b/);
 const saved=validateSession(captureSession(models,b)),next=setup();restoreSession(saved,next.models,next.b);assert.deepEqual([next.m.c.extended.arb.low,next.m.c.extended.arb.high],[499,500]);
 run(m,'BACK F3 511 F2');assert.deepEqual([m.c.extended.arb.low,m.c.extended.arb.high],[510,511]);validateSession(captureSession(models,b));
});

test('infinite and finite Manual Square Burst retain trigger phase in real circuit segments and old history',()=>{
 const s=setup(),{m,b}=s;run(m,'WAVE F2 BURST F1 F5 F3 BACK BACK F2 OUT F5 F3');s.at(.00037);const fired=.00037,old=b.vcAt(fired);run(m,'F1');b.solution();assert.equal(m.c.phase,0);
 const oracle=(dt,initial,delay=0,phase=0,cycles=Infinity)=>{const end=delay+cycles/1000,cuts=new Set([0,dt]);if(delay>0&&delay<dt)cuts.add(delay);if(end<dt)cuts.add(end);for(let k=0;k<=Math.ceil((dt*1000+phase)*2);k++){const t=delay+(k/2-phase)/1000;if(t>0&&t<dt&&t<end)cuts.add(t);}const ts=[...cuts].sort((a,b)=>a-b),drive=t=>((t<delay||t>=end?phase:(t-delay)*1000+phase)%1)<.5?3:-3;let cap=initial;for(let i=1;i<ts.length;i++){const v=drive((ts[i]+ts[i-1])/2);cap+=(v-cap)*-Math.expm1(-(ts[i]-ts[i-1])/((b.R+50)*b.C));}return {cap,node:(b.R*drive(dt)+50*cap)/(b.R+50)};};
 for(const dt of [.0002,.0006,.0012]){s.at(fired+dt);const expected=oracle(dt,old);near(b.vcAt(fired+dt),expected.cap,1e-7);}
 near(b.vcAt(fired-1e-9),old,1e-6);assert.ok(b.segs.some(seg=>Number.isFinite(seg.built.net.afg[0]?.p._driverPhase)));
 run(m,'PRESET WAVE F2 BURST F1 F1 2 F2 BACK F3 90 F2 BACK F5 F3 BACK F4 50 F2 BACK F3 OUT');s.at(.00337);const finite=.00337,initial=b.vcAt(finite);run(m,'F1');b.solution();
 for(const dt of [.0001,.0004,.0011,.0022]){s.at(finite+dt);const expected=oracle(dt,initial,.00005,.25,2);near(b.vcAt(finite+dt),expected.cap,1e-7);}
});

test('Tracking copies Manual configuration without reusing a timestamp from another target mode',()=>{
 const s=setup(),{m,b}=s;s.at(.1);run(m,'BURST F1 F5 F3 F1');assert.equal(m.motionRuntime[0].firedAt,.1);run(m,'CH SWEEP F1 F3 UTIL F4 F3 F2');assert.equal(m.extended.tracking,'ON');assert.deepEqual(m.ch.map(c=>c.extended.motion.mode),['SWEEP','SWEEP']);assert.equal(m.motionRuntime[0],null);assert.equal(m.driverDescriptor(0,.2).extended.motion.mode,'CONT');validateSession(captureSession(s.models,b));
});
