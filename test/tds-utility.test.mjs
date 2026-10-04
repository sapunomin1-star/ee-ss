import test from 'node:test';
import assert from 'node:assert/strict';
import { TdsModel, SDIV } from '../src/instruments/tds/model.js';
const key=(m,s)=>m.press(`TDS.KEY.${s}`),opt=(m,n)=>m.press(`TDS.SOFT.OPT${n}`);
const fresh=()=>{const m=new TdsModel();m.setScenario('S2');key(m,'AUTOSET');return m;};
const near=(a,b,e=1e-6)=>assert.ok(Math.abs(a-b)<e,`${a} differs from ${b}`);

test('Limit Test evaluates all captured values and stops after the configured waveform count',()=>{
 const m=fresh();assert.equal(m.applyLimitTemplate().kind,'approx');const mask=m.limitMasks[0];
 assert.equal(mask.lower.length,2500);assert.equal(mask.upper.length,2500);
 near(mask.upper[500]-mask.lower[500],2*m.extended.limit.vTolerance*m.vdiv(0));
 Object.assign(m.extended.limit,{on:true,stop:'WAVEFORMS',count:3});m.limitStarted=m.displayNow();
 for(let k=0;k<3;k++)m.tick();assert.deepEqual(m.limitStats,{tested:3,passed:3,failed:0,result:'PASS'});
 assert.equal(m.extended.limit.on,false);assert.match(m.lcd(),/Tested 3 Pass 3 Fail 0/);assert.match(m.lcd(),/limit-mask/);
 Object.assign(m.extended.limit,{on:true,stop:'VIOLATIONS',count:1,action:'SAVE_WAVEFORM'});
 m.setScenario('S1X5');assert.equal(m.limitStats.result,'FAIL');assert.equal(m.extended.limit.on,false);
 assert.match(m.limitViolation.text,/Time\(s\),Amplitude\(V\)/);assert.equal(m.limitViolation.text.split('\n').length,2502);
});

test('Limit uses time interpolation and physical units, rather than comparing equal point indices',()=>{
 const m=fresh();m.applyLimitTemplate();m.extended.limit.on=true;m.sIdx=SDIV.indexOf(100e-6);m.tick();
 assert.equal(m.limitStats.result,'PASS','faster centered capture still matches template in time');
 m.ch[0].vIdx++;m.tick();assert.equal(m.limitStats.result,'PASS','changing voltage scale does not change physical values');
 m.mpos=.002;m.tick();assert.equal(m.limitStats.result,'FAIL','capture outside the saved template time interval fails');
});

test('Horizontal template tolerance expands the waveform envelope and missing/FFT sources are explicit',()=>{
 const m=fresh();m.extended.limit.hTolerance=.2;m.applyLimitTemplate();const mask=m.limitMasks[0];
 const index=900,radius=Math.ceil(.2*m.sdiv/m.rec.dt),expected=Array.from(m.rec.v[0].slice(index-radius,index+radius+1),v=>v*m.ch[0].probe);
 near(mask.upper[index],Math.max(...expected)+.2*m.vdiv(0));
 m.extended.limit.templateSource=2;key(m,'MATH_MENU');opt(m,1);opt(m,1);assert.equal(m.extended.math.op,'FFT');
 assert.equal(m.applyLimitTemplate().kind,'info');assert.equal(m.limitMasks[0],mask);
 key(m,'UTILITY');opt(m,4);m.extended.limit.compare=1;assert.equal(opt(m,3).kind,'info');assert.equal(m.extended.limit.on,false);
});

test('Logging records true summaries only for completed triggered acquisitions, with browser CSV output',()=>{
 const m=fresh();Object.assign(m.extended.logging,{on:true,source:0});m.loggingStarted=m.displayNow();
 m.extended.acquire='AVERAGE';m.extended.averages=4;m.clearAcquisition();
 m.tick();m.tick();m.tick();assert.equal(m.loggingRows.length,0);m.tick();assert.equal(m.loggingRows.length,1);
 const row=m.loggingRows[0];near(row.rms,Math.SQRT1_2,.0003);near(row.mean,m.measure(0,'MEAN').value);
 m.extended.acquire='SAMPLE';m.trig.level=100;m.tick();assert.equal(m.loggingRows.length,1,'untriggered Auto frame is excluded');
 m.menu='LOGGING';const csv=opt(m,4).download;assert.equal(csv.mime,'text/csv');assert.match(csv.text,/Timestamp\(s\),Elapsed\(s\)/);assert.equal(csv.text.split('\n').length,3);
 m.extended.logging.source=2;key(m,'MATH_MENU');m.extended.math.op='+';m.trig.level=0;m.tick();assert.equal(m.loggingRows.at(-1).source,2);
});

test('Timed Limit/Logging can end while acquisition is stopped, and runtime data do not survive Recall',()=>{
 const m=fresh();m.applyLimitTemplate();m.fx={...m.fx,now:0};
 Object.assign(m.extended.limit,{on:true,stop:'TIME',seconds:2});m.limitStarted=0;
 Object.assign(m.extended.logging,{on:true,duration:1800});m.loggingStarted=0;
 key(m,'SAVE_RECALL');opt(m,5);m.run='stop';assert.equal(m.needsTriggerPoll(),true);
 m.fx.now=3;m.tick();assert.equal(m.extended.limit.on,false);assert.equal(m.extended.logging.on,true);
 m.fx.now=1801;m.tick();assert.equal(m.extended.logging.on,false);assert.equal(m.msg,'Data logging completed');
 m.loggingRows.push({n:100});m.limitStats.tested=12;m.limitViolation={text:'previous'};
 m.extended.store.action='RECALL_SETUP';m.extended.store.target='INTERNAL';m.menu='STORE';opt(m,5);
 assert.equal(m.extended.limit.on,false);assert.equal(m.extended.logging.on,false);assert.equal(m.loggingRows.length,0);
 assert.equal(m.limitStats.tested,0);assert.equal(m.limitViolation,null);assert.ok(m.limitMasks[0]);
});

test('Data Logging preserves only latest 2000 summaries and duration follows the manual selections',()=>{
 const m=fresh();m.extended.logging.on=true;m.loggingStarted=m.displayNow();
 const r=m.rec;for(let k=0;k<2002;k++)m.processRecord({...r,n:k});
 assert.equal(m.loggingRows.length,2000);assert.equal(m.loggingDropped,2);assert.equal(m.loggingRows[0].n,2);
 m.extended.logging.duration=28800;m.stepLoggingDuration(1);assert.equal(m.extended.logging.duration,32400);
 m.extended.logging.duration=86400;m.stepLoggingDuration(1);assert.equal(m.extended.logging.duration,'INFINITE');m.stepLoggingDuration(1);assert.equal(m.extended.logging.duration,1800);
});

test('Bench Auto logging waits for an actual trigger time and excludes future waveform previews',()=>{
 let now=0;const period=.25,at=t=>Math.sin(2*Math.PI*(t-.0625)/period),table=Float64Array.from({length:4000},(_,k)=>at(k/4000*period));
 const m=new TdsModel();m.setBenchSource(()=>({sig:[{table,period,at,abs:at},null],probe:[1,1],changedAt:0,now,tView:now}));
 m.setScenario('BENCH');key(m,'AUTOSET');m.menu='LOGGING';opt(m,1);assert.equal(m.loggingRows.length,0);
 now=.06;m.inputChanged();assert.equal(m.loggingRows.length,0);
 now=.064;m.inputChanged();assert.equal(m.loggingRows.length,0);assert.ok(m.pendingAcquisition);
 now=m.pendingAcquisition.endAt+1e-6;m.inputChanged();assert.equal(m.loggingRows.length,1);near(m.loggingRows[0].time,.0625,1e-9);assert.ok(m.rec.endAt<=now);
 assert.ok(m.loggingRows[0].time<=now);assert.equal(m.rec.triggered,true);
});
