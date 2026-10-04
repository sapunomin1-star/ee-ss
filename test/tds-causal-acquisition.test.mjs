import test from 'node:test';
import assert from 'node:assert/strict';
import { TdsModel, SDIV, VDIV } from '../src/instruments/tds/model.js';
import { Bench, DEMO } from '../src/bench/bench.js';
const near=(a,b,tol=1e-6)=>assert.ok(Math.abs(a-b)<=tol,`${a} differs from ${b}`);
const key=(m,id)=>m.press(`TDS.KEY.${id}`);
function source({at,period=1,table,changedAt=1,history}={}) {
 let now=changedAt, maxRead=-Infinity;
 const abs=t=>{assert.ok(t<=now+1e-12,`read future ${t} at ${now}`);maxRead=Math.max(maxRead,t);return at(t);};
 const m=new TdsModel(), sig={table:table??Float64Array.of(5,5),period,at:t=>at(Math.max(changedAt,t)),abs,
  ...(history?{history:(a,b)=>history.filter(h=>h.from<b&&h.to>a).map(h=>({...h,abs:t=>abs(t)}))}:{})};
 m.setBenchSource(()=>({sig:[sig,sig],probe:[1,1],changedAt,now,tView:now+1}));m.setScenario('BENCH');
 Object.assign(m.ch[0],{on:true,probe:1,vIdx:VDIV.indexOf(1),pos:0});m.sIdx=SDIV.indexOf(.01);m.trig.mode='NORMAL';m.trig.level=2.5;
 return {m,advance:t=>{now=t;m.inputChanged();},now:()=>now,maxRead:()=>maxRead};
}
const steady=(value,from,to)=>({from,to,t0:from,period:1,at:()=>value,table:Float64Array.of(value,value),lam:[],coeff:[],actual:false,periodic:true});

test('Single waits for its last sample and includes an actual output change during post-trigger',()=>{
 const {m,advance,maxRead}=source({at:t=>t<1?0:t<1.01?5:2});const old=m.rec,n=m.acqN;key(m,'SINGLE');
 assert.equal(m.trigStatus(),"Trig'd");assert.equal(m.rec,old);assert.equal(m.acqN,n);assert.ok(m.pendingAcquisition.endAt>1);
 advance(1.009);assert.equal(m.rec,old);advance(1.06);assert.equal(m.trigStatus(),'Acq. Complete');
 near(m.rec.abs0,1);near(m.sampleAt(0,-.01),0);near(m.sampleAt(0,.005),5);near(m.sampleAt(0,.02),2);
 assert.ok(m.rec.endAt<=1.06);assert.ok(maxRead()<=1.06);
});

test('Scan, Auto, XY and PeakDetect only query already elapsed time; XY channels share the same instant',()=>{
 const q=source({at:t=>.2*t,changedAt:0});q.advance(2);const m=q.m;m.trig.mode='AUTO';m.trig.level=100;m.sIdx=SDIV.indexOf(.1);m.tick();
 assert.equal(m.trigStatus(),'Scan');near(m.rec.endAt,2,1e-12);near(m.rec.v[0].at(-1),.4);
 m.sIdx=SDIV.indexOf(.01);m.extended.acquire='PEAK';m.tick();near(m.rec.endAt,2,1e-12);assert.equal(m.rec.mode,'PEAK');
 m.extended.display.format='XY';m.ch[1].on=true;m.tick();near(m.rec.endAt,2,1e-12);assert.deepEqual(m.rec.v[0],m.rec.v[1]);
 assert.ok(q.maxRead()<=2);key(m,'SINGLE');assert.equal(m.trigStatus(),'Acq. Complete');near(m.rec.endAt,2,1e-12);
});

test('AC coupling uses the actual DC-step history, without fabricated negative pretrigger voltage',()=>{
 const q=source({at:t=>t<1?0:5,history:[steady(0,-Infinity,1),steady(5,1,Infinity)]});const m=q.m;m.ch[0].coupling='AC';key(m,'SINGLE');
 assert.ok(m.pendingAcquisition);q.advance(1.06);assert.equal(m.trigStatus(),'Acq. Complete');
 near(m.sampleAt(0,-.01),0,1e-6);near(m.sampleAt(0,.01),5*Math.exp(-2*Math.PI*10*.01),.002);
 near(m.sampleAt(0,.03),5*Math.exp(-2*Math.PI*10*.03),.002);assert.ok(q.maxRead()<=1.06);
});

test('Actual 10X probe changes causal AC corner to 1 Hz, independently of displayed probe factor',()=>{
 const m=new TdsModel();let now=1;const at=t=>t<1?0:5;
 m.setBenchSource(()=>({sig:[{table:Float64Array.of(5,5),period:1,at:()=>5,abs:at,history:()=>[steady(0,-Infinity,1),steady(5,1,Infinity)]},null],probe:[10,10],changedAt:1,now}));m.setScenario('BENCH');
 Object.assign(m.ch[0],{coupling:'AC',probe:10,vIdx:VDIV.indexOf(.1)});m.sIdx=SDIV.indexOf(.01);m.trig.level=.25;key(m,'SINGLE');now=1.06;m.inputChanged();
 near(m.sampleAt(0,-.01),0);near(m.sampleAt(0,.03),5*Math.exp(-2*Math.PI*.03),.002);
});

test('Average Single counts completed, distinct captures and never overlapping predicted future triggers',()=>{
 const period=.02,at=t=>t<0?0:((t%period+period)%period)<.01?1:0;
 const q=source({at,period,table:Float64Array.from({length:4000},(_,j)=>at(j*period/4000)),changedAt:0}),m=q.m;
 m.sIdx=SDIV.indexOf(.005);m.trig.level=.5;m.extended.acquire='AVERAGE';m.extended.averages=4;key(m,'SINGLE');
 q.advance(.001);assert.equal(m.avgState,null);const triggers=[];
 for(let j=0;j<4;j++){
  const end=m.pendingAcquisition.endAt;triggers.push(m.pendingAcquisition.triggerAt);q.advance(end+1e-6);assert.equal(m.avgState.count,j+1);
  if(j<3){assert.equal(m.run,'single');q.advance(end+.019);assert.ok(m.pendingAcquisition);}
 }
 assert.equal(m.trigStatus(),'Acq. Complete');assert.equal(m.rec.averageCount,4);
 for(let j=1;j<triggers.length;j++)assert.ok(triggers[j]-triggers[j-1]>=.025,'busy post-trigger interval excludes intervening trigger');
});

test('Stop cancels a pending Single; restarting arms at the present rather than completing an old trigger',()=>{
 const q=source({at:t=>t<1?0:5}),m=q.m;key(m,'SINGLE');assert.ok(m.pendingAcquisition);const r=m.rec;key(m,'RUN_STOP');
 q.advance(1.1);assert.equal(m.rec,r);assert.equal(m.pendingAcquisition,null);key(m,'SINGLE');assert.equal(m.trigStatus(),'Ready');assert.equal(m.armedAt,1.1);
 key(m,'FORCE_TRIG');assert.equal(m.trigStatus(),"Trig'd");q.advance(1.16);near(m.rec.abs0,1.1);assert.equal(m.trigStatus(),'Acq. Complete');
});

test('Real Bench AC RC charging agrees with the closed-form cascade and retains zero prehistory',()=>{
 let now=0;const afg={on:true,ch:[{wave:'SINE',freq:1000,emfVpp:0,emfOffset:5,sym:50,output:false},{output:false}]};
 const b=new Bench(afg);b.now=()=>now;b.R=1000;b.C=10e-6;Object.entries(DEMO).forEach(([lead,node])=>b.connect(lead,node));
 const m=new TdsModel();m.setBenchSource(()=>b.tdsInput());m.setScenario('BENCH');Object.assign(m.ch[1],{on:true,coupling:'AC',probe:10,vIdx:VDIV.indexOf(.1)});
 m.sIdx=SDIV.indexOf(.01);m.trig={...m.trig,src:1,level:.1,mode:'NORMAL'};key(m,'SINGLE');now=1;afg.ch[0].output=true;b.solution();m.inputChanged();
 now=1.08;m.inputChanged();assert.equal(m.trigStatus(),'Acq. Complete');const lambda=1/b.solution().tau,corner=2*Math.PI,final=b.solution().stats(b.node('B'),'E').mean;
 const value=t=>final*lambda/(lambda-corner)*(Math.exp(-corner*t)-Math.exp(-lambda*t));
 near(m.sampleAt(1,1-m.rec.abs0-.01),0,1e-6);for(const t of [.005,.02,.04])near(m.sampleAt(1,1+t-m.rec.abs0),value(t),.003);
 assert.ok(m.rec.endAt<=now);
});


test('Repeated channel/trigger AC poles retain high-carrier gain instead of sparse-convolution aliasing',()=>{
 const frequency=1e6,period=1/frequency,at=t=>Math.sin(2*Math.PI*frequency*t),table=Float64Array.from({length:4096},(_,j)=>at(j*period/4096));
 const h={from:-Infinity,to:Infinity,t0:0,period,at,table,lam:[],coeff:[],actual:false,periodic:true};
 const q=source({at,period,table,changedAt:0,history:[h]});q.advance(1);const m=q.m;m.ch[0].coupling='AC';m.trig.coup='AC';m.fx=m.benchFx();
 const conditioned=m.absolutePath(0,{trigger:true}),corner=10,omega=2*Math.PI*frequency,phase=2*Math.atan(corner/frequency),gain=frequency**2/(frequency**2+corner**2);
 for(const fraction of [.031,.17,.37,.73]){const t=1+fraction*period-2*period;near(conditioned(t),gain*Math.sin(omega*t+phase),2e-6);}
});

test('Two causal AC stages follow the DC-step cascade rather than dropping the second pole',()=>{
 const q=source({at:t=>t<1?0:5,history:[steady(0,-Infinity,1),steady(5,1,Infinity)]});q.advance(1.1);const m=q.m;m.ch[0].coupling='AC';m.trig.coup='AC';m.fx=m.benchFx();
 const conditioned=m.absolutePath(0,{trigger:true}),rate=2*Math.PI*10;
 near(conditioned(.99),0,1e-6);for(const elapsed of [.005,.02,.04])near(conditioned(1+elapsed),5*(1-rate*elapsed)*Math.exp(-rate*elapsed),2e-6);
});


test('Force with disconnected trigger source still waits for the other channel actual samples',()=>{
 const q=source({at:t=>t<1?0:3}),m=q.m;
 const original=m.benchSource;m.setBenchSource(()=>{const fx=original();return {...fx,sig:[null,fx.sig[1]]};});m.ch[1].on=true;m.ch[1].vIdx=VDIV.indexOf(1);m.ch[1].probe=1;
 key(m,'SINGLE');assert.equal(m.trigStatus(),'Ready');key(m,'FORCE_TRIG');assert.ok(m.pendingAcquisition);assert.equal(m.complete,false);
 q.advance(1.06);assert.equal(m.trigStatus(),'Acq. Complete');near(m.rec.abs0,1);near(m.sampleAt(1,-.01),0);near(m.sampleAt(1,.02),3);assert.ok(m.rec.endAt<=1.06);
});

test('Physical probe changes retain their historical BNC attenuation; scope menu probe remains a display factor',()=>{
 let now=1.05;const m=new TdsModel(),probeAt=t=>t<1?1:10;
 const history=[{...steady(5,-Infinity,1),probe:1},{...steady(5,1,Infinity),probe:10}];
 m.setBenchSource(()=>({sig:[{table:Float64Array.of(5,5),period:1,at:()=>5,abs:()=>5,probeAt,history:()=>history},null],probe:[10,10],changedAt:1,now}));m.setScenario('BENCH');
 Object.assign(m.ch[0],{on:true,probe:1,vIdx:VDIV.indexOf(1)});m.sIdx=SDIV.indexOf(.01);m.trig.mode='AUTO';m.trig.level=100;m.tick();
 near(m.sampleAt(0,-.01),5);near(m.sampleAt(0,.04),.5);m.ch[0].probe=10;near(m.sampleAt(0,-.01),50);near(m.sampleAt(0,.04),5);
 m.ch[0].coupling='AC';m.tick();const absolute=m.absolutePath(0),rate=2*Math.PI;
 near(absolute(.99),0,1e-6);near(absolute(1.03),-4.5*Math.exp(-rate*.03),.002);
});


test('Recalling an armed setup clears the previous Single completion and pending runtime',()=>{
 const q=source({at:t=>t<1?0:5}),m=q.m;const setup={...m.save(),ch:structuredClone(m.ch),extended:structuredClone(m.extended),run:'single'};
 key(m,'SINGLE');q.advance(1.06);assert.equal(m.complete,true);m.recallSetup(setup);
 assert.equal(m.run,'single');assert.equal(m.complete,false);assert.equal(m.rec,null);assert.equal(m.pendingAcquisition,null);assert.equal(m.armedAt,1.06);
 q.advance(1.1);assert.equal(m.trigStatus(),'Ready');key(m,'FORCE_TRIG');assert.equal(m.complete,false);q.advance(1.16);assert.equal(m.complete,true);
});


test('A fast 5 ns time base still finds a slow actual AC-coupled charging trigger within one bounded poll',()=>{
 let now=0;const afg={on:true,ch:[{wave:'SINE',freq:1000,emfVpp:0,emfOffset:5,sym:50,output:false},{output:false}]};
 const b=new Bench(afg);b.now=()=>now;b.R=100000;b.C=10e-6;for(const [lead,node]of Object.entries(DEMO))b.connect(lead,node);
 const m=new TdsModel();m.setBenchSource(()=>b.tdsInput());m.setScenario('BENCH');Object.assign(m.ch[1],{on:true,coupling:'AC',probe:10,vIdx:VDIV.indexOf(.05)});
 m.sIdx=SDIV.indexOf(5e-9);m.trig={...m.trig,src:1,level:.02,mode:'NORMAL'};key(m,'SINGLE');now=1;afg.ch[0].output=true;b.solution();m.inputChanged();
 now=1.15;m.inputChanged();assert.equal(m.trigStatus(),'Acq. Complete');assert.ok(m.rec.endAt<=now);
 const lambda=1/b.solution().tau,corner=2*Math.PI,final=b.solution().stats(b.node('B'),'E').mean;
 const value=t=>final*lambda/(lambda-corner)*(Math.exp(-corner*t)-Math.exp(-lambda*t));
 let lo=0,hi=.15;for(let j=0;j<60;j++){const mid=(lo+hi)/2;if(value(mid)<.2)lo=mid;else hi=mid;}
 near(m.rec.abs0,1+hi,1e-7);near(m.sampleAt(1,0),.2,1e-5);
});


test('Unknown filtered absolute sources without range metadata remain searchable',()=>{
 const tau=.01,rate=2*Math.PI*10,at=t=>t<1?0:5*(1-Math.exp(-(t-1)/tau));
 const q=source({at}),m=q.m;m.ch[0].coupling='AC';m.trig.level=.5;m.sIdx=SDIV.indexOf(.001);key(m,'SINGLE');assert.equal(m.trigStatus(),'Ready');
 q.advance(1.03);assert.equal(m.trigStatus(),'Acq. Complete');assert.ok(m.rec.endAt<=1.03);
 const filtered=t=>5/(1-rate*tau)*(Math.exp(-rate*t)-Math.exp(-t/tau));let lo=0,hi=.01;
 for(let j=0;j<60;j++){const mid=(lo+hi)/2;if(filtered(mid)<.5)lo=mid;else hi=mid;}
 near(m.rec.abs0,1+hi,2e-5);near(m.sampleAt(0,0),.5,.01);
});

test('A flat historical lookup table cannot suppress an actual narrow AC pulse trigger',()=>{
 const at=t=>t>=1.007&&t<1.0071?5:0,table=Float64Array.of(0,0);
 const h={...steady(0,-Infinity,Infinity),at};
 const q=source({at,table,history:[h]}),m=q.m;
 m.fx.sig[0].transientRange=()=>[0,5];m.ch[0].coupling='AC';m.sIdx=SDIV.indexOf(50e-6);m.trig.level=2.5;
 key(m,'SINGLE');q.advance(1.02);
 assert.equal(m.trigStatus(),'Acq. Complete');near(m.rec.abs0,1.007,1e-6);assert.ok(m.rec.endAt<=1.02);
});
