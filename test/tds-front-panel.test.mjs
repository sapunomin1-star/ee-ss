import test from 'node:test';
import assert from 'node:assert/strict';
import { TdsModel, SDIV } from '../src/instruments/tds/model.js';
const key=(m,s)=>m.press(`TDS.KEY.${s}`), opt=(m,n)=>m.press(`TDS.SOFT.OPT${n}`);
const near=(a,b,e=1e-9)=>assert.ok(Math.abs(a-b)<e, `${a} differs from ${b}`);
const fresh=()=>{const m=new TdsModel();m.setScenario('S2');key(m,'AUTOSET');return m;};

test('Fine changes actual acquisition gain, and Coarse resumes 1-2-5 after preserving Fine gain',()=>{
 const m=fresh();key(m,'CH1_MENU');opt(m,3);const gain=m.vdiv(0);
 m.turn('TDS.KNOB.CH1_VOLTS_DIV',1);near(m.vdiv(0),gain/1.02);near(m.rec.fe[0].base,m.base(0));
 const fine=m.base(0);opt(m,3);near(m.base(0),fine);m.turn('TDS.KNOB.CH1_VOLTS_DIV',-1);near(m.vdiv(0),gain);
 assert.equal(m.extended.fineScale[0],null);
});

test('Window Zone bounds the selection and Window zooms a frozen record without acquiring',()=>{
 const m=fresh();key(m,'RUN_STOP');const r=m.rec,n=m.acqN,main=m.sdiv;
 key(m,'HORIZ_MENU');opt(m,2);m.turn('TDS.KNOB.HORIZ_SCALE',1);
 assert.match(m.lcd(),/window-zone/);const h=m.extended.horizontal;assert.ok(SDIV[h.windowIdx]<main);
 m.turn('TDS.KNOB.HORIZ_POSITION',10);assert.ok(h.windowPos!==0);opt(m,3);
 near(m.sdiv,SDIV[h.windowIdx]);near(m.viewPosition,h.windowPos);assert.equal(m.rec,r);assert.equal(m.acqN,n);
 opt(m,1);near(m.sdiv,main);near(m.mpos,0);
});

test('HF/LF/Noise Reject change trigger conditioning without changing measured channel voltage',()=>{
 const m=fresh(), before=m.measure(0,'PKPK').value,p=m.path(0);m.trig.coup='HF';
 near(m.trigPath().a,p.a/Math.sqrt(1+(1000/80000)**2));m.trig.coup='LF';
 near(m.trigPath().a,p.a*1000/Math.sqrt(1000**2+300000**2));m.tick();near(m.measure(0,'PKPK').value,before,.001);
 m.trig.coup='NOISE';assert.ok(m.triggerThreshold()>m.trig.level);m.trig.level=p.m+p.a*.99;assert.equal(m.crosses(),false);
});

function pulseSource(){
 let now=0;const period=.001,width=.0002,at=t=>t<0?0:((t%period+period)%period)<width?1:0;
 const table=Float64Array.from({length:4000},(_,k)=>at(k/4000*period));
 const fx=()=>({sig:[{table,period,at,abs:at},null],probe:[1,1],changedAt:0,now,tView:now});
 const m=new TdsModel();m.setBenchSource(fx);m.setScenario('BENCH');m.ch[0].probe=1;m.ch[0].vIdx=8;m.sIdx=SDIV.indexOf(50e-6);m.trig.level=.5;
 m.extended.pulse.type='PULSE';m.extended.pulse.width=width;
 return {m,advance:t=>{now=t;m.inputChanged();},width};
}

test('Pulse Single waits for the real end, then compares actual width, not predicted source width',()=>{
 const {m,advance,width}=pulseSource();key(m,'SINGLE');advance(width*.99);assert.equal(m.trigStatus(),'Ready');
 advance(width*1.01);assert.equal(m.trigStatus(),"Trig'd");assert.equal(m.complete,false);
 advance(.00046);assert.equal(m.trigStatus(),'Acq. Complete');near(m.rec.abs0,width);assert.ok(m.rec.endAt<=.00046);
 const bad=pulseSource();bad.m.extended.pulse.width=.0003;key(bad.m,'SINGLE');bad.advance(.0025);
 assert.equal(bad.m.trigStatus(),'Ready');assert.equal(bad.m.lastTriggerAt,null);
 const neg=pulseSource();neg.m.extended.pulse.polarity='NEGATIVE';neg.m.extended.pulse.width=.0008;
 key(neg.m,'SINGLE');neg.advance(.00099);assert.equal(neg.m.trigStatus(),'Ready');neg.advance(.00101);
 assert.equal(neg.m.trigStatus(),"Trig'd");neg.advance(.00126);assert.equal(neg.m.trigStatus(),'Acq. Complete');near(neg.m.rec.abs0,.001);
});

test('Pulse comparison equality tolerance and source counter count only qualified events',()=>{
 const {m}=pulseSource();for(const [when,width,expected] of [['=',.00021,true],['=',.00022,false],['!=',.00022,true],['<',.0003,true],['>',.0003,false]]){
  Object.assign(m.extended.pulse,{when,width});assert.equal(m.crosses(),expected);assert.equal(m.trigFreq(),expected?1000:null);
 }
 key(m,'TRIG_MENU');opt(m,4);assert.equal(m.knobTarget(),'pulsewidth');m.turn('TDS.KNOB.MULTIPURPOSE',1);assert.ok(m.extended.pulse.width>.0003);
 opt(m,5);assert.match(m.lcd(),/Polarity/);opt(m,2);assert.equal(m.extended.pulse.polarity,'NEGATIVE');
});

test('Holdoff excludes later real triggers until the configured interval ends',()=>{
 const {m,advance}=pulseSource();m.extended.pulse.type='EDGE';m.trig.mode='NORMAL';m.extended.horizontal.holdoff=.0015;
 m.changeSearch=null;advance(0);advance(.0001);near(m.lastTriggerAt,0);assert.ok(m.pendingAcquisition);advance(.0003);const n=m.acqN;
 advance(.0011);assert.equal(m.acqN,n);advance(.0021);near(m.lastTriggerAt,.002);assert.equal(m.acqN,n);advance(.0023);assert.equal(m.acqN,n+1);
});

test('Trig View conditions the preview, locks other buttons and releases without changing channels',()=>{
 const m=fresh();m.trig.coup='LF';const channels=structuredClone(m.ch),r=m.rec;
 m.setTrigView(true);const p=m.triggerViewRecord();assert.ok(p.v[0]);assert.equal(p.v[1],null);
 assert.equal(key(m,'CH1_MENU').kind,'info');assert.deepEqual(m.ch,channels);assert.equal(m.rec,r);
 assert.equal(key(m,'PRINT').download.mime,'image/svg+xml');m.setTrigView(false);assert.equal(m.triggerViewRecord(),null);
 m.ch[0].on=false;m.extended.invert[0]=true;m.setTrigView(true);assert.match(m.lcd(),/class="wave ch1"/);
});

test('Stopped Trig View reads current bench trigger input while leaving the frozen channel record intact',()=>{
 let now=0;const m=new TdsModel();m.setBenchSource(()=>({sig:[{table:Float64Array.of(2,2),period:1,abs:t=>t<.01?1:2},null],probe:[1,1],changedAt:0,now,tView:now}));
 m.setScenario('BENCH');m.ch[0].probe=1;m.ch[0].vIdx=8;m.sIdx=SDIV.indexOf(1e-3);key(m,'FORCE_TRIG');assert.ok(m.pendingAcquisition);now=.006;m.inputChanged();key(m,'RUN_STOP');const frozen=m.rec;
 now=.1;m.inputChanged();m.setTrigView(true);const preview=m.triggerViewRecord();
 near(preview.v[0][1250],2);near(frozen.v[0][1250],1);assert.equal(m.rec,frozen);
});

test('Math/Ref cursors read acquired source values and retained reference time scales',()=>{
 const m=fresh();key(m,'RUN_STOP');key(m,'MATH_MENU');key(m,'CURSOR');opt(m,1);opt(m,2);opt(m,2);
 assert.equal(m.extended.cursorSource,'MATH');const ci=m.cursorInfo();assert.equal(ci.type,'TIME');
 const t=ci.t[0];near(ci.v[0],m.sampleAt(0,t)-m.sampleAt(1,t));
 const saved=m.rec;key(m,'SAVE_RECALL');opt(m,1);opt(m,5);key(m,'REF');opt(m,1);
 key(m,'CURSOR');opt(m,2);assert.equal(m.extended.cursorSource,'REFA');near(m.cursorInfo().v[0],m.sampleAt(0,m.cursorInfo().t[0]));
 const refTimes=m.cursorInfo().t;m.sIdx=0;assert.deepEqual(m.cursorInfo().t,refTimes);assert.equal(m.rec,saved);
 opt(m,1);assert.equal(m.cursorInfo().type,'AMPL');assert.match(m.lcd(),/RefA/);
 opt(m,2);assert.equal(m.cursorInfo().hidden,true);
});

test('FFT cursors use frequency and dB axes with actual FFT bins',()=>{
 const m=fresh();key(m,'MATH_MENU');opt(m,1);opt(m,1);key(m,'CURSOR');opt(m,1);opt(m,2);opt(m,2);
 const fft=m.fftRecord(),ci=m.cursorInfo();assert.equal(ci.type,'FREQ');near(ci.df,fft.nyquist*.8);
 assert.match(m.lcd(),/Frequency/);opt(m,1);const mag=m.cursorInfo();assert.equal(mag.type,'MAG');near(mag.dv,64);
 assert.match(m.lcd(),/Magnitude/);assert.match(m.lcd(),/dB/);
});

test('Noise acquisition does not report the teaching cache period as physical frequency',()=>{
 const m=new TdsModel();m.setBenchSource(()=>({sig:[{noise:true,table:Float64Array.from([1,-1,0,.5]),period:.001},null],probe:[1,1]}));m.setScenario('BENCH');key(m,'AUTOSET');
 assert.deepEqual(m.snapshot().rec.noise,[true,false]);assert.equal(m.trigFreq(),null);
 for(const type of ['FREQ','PERIOD','CYCRMS','DUTY','PHASE','DELAY'])assert.equal(m.measure(0,type).value,null);
 assert.ok(m.measure(0,'RMS').value>0);
});

test('Print/Save downloads encode actual display and recorded values, Utility/Help expose real info',()=>{
 const m=fresh();key(m,'RUN_STOP');const image=key(m,'PRINT').download;assert.match(image.text,/viewBox="0 0 320 240"/);assert.match(image.text,/wave ch1/);
 key(m,'SAVE_RECALL');opt(m,2);const saved=JSON.parse(opt(m,5).download.text);assert.equal(saved.format,'ee-ss-tds-setup-v1');
 opt(m,1);const csv=opt(m,5).download.text.split('\n');assert.equal(csv.length,2502);
 near(Number(csv[1].split(',')[1]),m.rec.v[0][0]*m.ch[0].probe);
 opt(m,1);const unchanged=JSON.stringify(m.save());assert.equal(opt(m,5).kind,'info');assert.equal(JSON.stringify(m.save()),unchanged);
 let requested=0;m.setSetupFileHandler(()=>requested++);assert.equal(opt(m,5).kind,'approx');assert.equal(requested,1);assert.equal(JSON.stringify(m.save()),unchanged);
 key(m,'UTILITY');opt(m,1);opt(m,2);assert.match(m.lcd(),/Vertical/);assert.match(m.infoText().join(' '),/Probe 10X/);
 key(m,'TRIG_MENU');key(m,'HELP');assert.match(m.lcd(),/Pulse: compare/);opt(m,5);assert.equal(m.menu,'TRIG');
 key(m,'UTILITY');assert.equal(opt(m,3).kind,'out');assert.equal(m.menu,'UTILITY');
});
