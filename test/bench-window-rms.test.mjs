import test from 'node:test';
import assert from 'node:assert/strict';
import { createInstruments } from '../src/instruments/index.js';
import { Bench } from '../src/bench/bench.js';
import { centeredSquareIntegral } from '../src/bench/window-rms.js';
const near=(v,x,tol=1e-8)=>assert.ok(Math.abs(v-x)<tol,`${v} vs ${x}`);

test('Single AC window preserves a DC step and disconnected history',()=>{
  const m=createInstruments(), b=new Bench(m.afg,m.dmm,m.gpe), clock={t:0};
  b.now=()=>clock.t; m.dmm.fn='ACV';
  b.wires={'GPE.CH1+':'A','GPE.CH1-':'G','DMM.HI':'A','DMM.LO':'G'};
  m.gpe.on=true; m.gpe.output=false; b.solution();
  clock.t=1; m.gpe.output=true; m.gpe.vset[1]=500; b.solution();
  clock.t=2; const full=b.dmmInput().v.meanOver(1.5,2);
  near(b.dmmInput().v.rmsAcOver(.5,1.5),full/2,1e-6);
  clock.t=3; delete b.wires['DMM.HI']; b.solution();
  clock.t=4; b.wires['DMM.HI']='A'; b.solution();
  near(b.dmmInput().v.rmsAcOver(2.5,3.5),full/2,1e-6);
});

test('square integration folds millions of carrier cycles and exponential startup',()=>{
  const f=2e6,lambda=2,amp=3,T=1/f;
  const sol={periodic:true,period:T,mesh:[0,T/2,T],lam:[lambda],modeW:(n)=>[n==='HI'?1:0],
    nodeAt:(n,t)=>n==='HI'?Math.sin(2*Math.PI*f*t):0};
  // Fake analytic sinusoid needs a mesh fine enough for GL8, as the real
  // solver supplies. This avoids relying on a uniform aperture sample grid.
  sol.mesh=Array.from({length:49},(_,k)=>k*T/48);
  const seg={sol,amp:[amp],t0:0},a=0,b=2,center=0;
  const cross=2*amp*(2*Math.PI*f)*(1-Math.exp(-lambda*b))/(lambda**2+(2*Math.PI*f)**2);
  const expected=b/2+amp**2*(1-Math.exp(-2*lambda*b))/(2*lambda)+cross;
  near(centeredSquareIntegral(seg,'HI','E',a,b,center),expected,1e-7);
});

test('RC startup RMS follows its analytic centered exponential over a finite aperture',()=>{
  const lambda=5000,sol={period:1,mesh:[0,1],lam:[lambda],modeW:(n)=>[n==='HI'?1:0],nodeAt:(n)=>n==='HI'?5:0};
  const seg={sol,amp:[-5],t0:1},a=1,b=1.0004,dt=b-a;
  const e1=(1-Math.exp(-lambda*dt))/lambda,e2=(1-Math.exp(-2*lambda*dt))/(2*lambda);
  const mean=5*(1-e1/dt), expected=25*(dt-2*e1+e2)-mean**2*dt;
  near(centeredSquareIntegral(seg,'HI','E',a,b,mean),expected,1e-10);
});

test('CC charging in nanosecond windows does not cancel the actual small AC RMS',()=>{
  const m=createInstruments(), b=new Bench(m.afg,m.dmm,m.gpe),clock={t:0};b.now=()=>clock.t;
  m.dmm.fn='DCV';m.dmm.inputZMode='AUTO';m.dmm.per.DCV.auto=false;m.dmm.per.DCV.idx=0;
  b.C=47e-9;b.wires={'GPE.CH1+':'B','GPE.CH1-':'G','DMM.HI':'B','DMM.LO':'G'};
  m.gpe.on=true;m.gpe.output=false;m.gpe.vset[1]=500;m.gpe.iset[1]=10;b.solution();
  m.gpe.output=true;b.solution();
  for(const end of [1e-9,1e-8,1e-7,1e-6]) {
    clock.t=end;const rms=b.dmmInput().v.rmsAcOver(0,end);
    const expected=.01/b.C*end/Math.sqrt(12);
    near(rms,expected,expected*1e-6);
  }
});
