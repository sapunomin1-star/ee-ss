// Centered square integral of a periodic steady solution plus exponential
// capacitor modes. Whole periods and decay sums are folded analytically, so a
// long DMM aperture does not alias a fast carrier or loop over millions of cycles.
const GL8 = [[.1834346424956498,.362683783378362],[.525532409916329,.3137066458778873],
  [.7966664774136267,.2223810344533745],[.9602898564975363,.1012285362903763]].flatMap(([u,w])=>[[-u,w],[u,w]]);

function periodicIntegral(sol, value, a, b, rate = 0, origin = a) {
  const T = sol.period, mesh = sol.mesh ?? [0, T];
  const partial = (lo, hi, start) => {
    const cuts = new Set([lo, hi]);
    for (const x of mesh) if (x > lo && x < hi) cuts.add(x);
    const ordered = [...cuts].sort((x,y)=>x-y); let out = 0;
    for (let k=1;k<ordered.length;k++) {
      const x=ordered[k-1], y=ordered[k], splits=new Set([x,y]);
      // Resolve every fast modal boundary layer, and a weighted exponential
      // that may decay before even the first ordinary quadrature point.
      for (const l of [...sol.lam,rate]) if (l>0 && l*(y-x)>.5)
        for (const z of [.125,.25,.5,1,2,4,8,16,32,64]) if (x+z/l<y) splits.add(x+z/l);
      const xs=[...splits].sort((v,w)=>v-w);
      for(let j=1;j<xs.length;j++) {
        const half=(xs[j]-xs[j-1])/2;
        for(const [u,w] of GL8) {
          const phase=xs[j-1]+(u+1)*half;
          out+=w*half*value(phase)*Math.exp(-rate*Math.max(0,start+phase-lo-origin));
        }
      }
    }
    return out;
  };
  let cursor=a, phase=((a%T)+T)%T, sum=0;
  if (phase>0) { const end=Math.min(b,a+T-phase); sum+=partial(phase,phase+end-a,a); cursor=end; }
  const count=Math.max(0,Math.floor((b-cursor)/T));
  if(count) {
    const geometric=rate===0 ? count : -Math.expm1(-rate*count*T)/-Math.expm1(-rate*T);
    sum+=partial(0,T,cursor)*geometric; cursor+=count*T;
  }
  if(cursor<b) sum+=partial(0,b-cursor,cursor);
  return sum;
}

export function centeredSquareIntegral(seg, hi, lo, a, b, center, actualValue) {
  if (!(b>a)) return 0;
  const sol=seg.sol;
  if(sol.actualCenteredSquareOver) return sol.actualCenteredSquareOver(hi,lo,a,b,center)*(b-a);
  if(sol.actualNodeAt) return NaN;
  const h=sol.modeW(hi), l=sol.modeW(lo), c=sol.lam.map((_,i)=>(h[i]-l[i])*(seg.amp[i]??0));
  if (!sol.periodic) {
    // A CC source may have a huge formal GMIN steady voltage that nearly
    // cancels its startup mode. Squaring those two terms separately loses the
    // actual millivolt signal. Integrate the stable initial/expm1 voltage.
    const initial=sol.nodeAt(hi,seg.t0)-sol.nodeAt(lo,seg.t0)+c.reduce((s,v)=>s+v,0);
    const value=actualValue ?? ((t)=>initial+(sol.nodeChange?.(hi,t,seg.t0)??sol.nodeAt(hi,t)-sol.nodeAt(hi,seg.t0))
      -(sol.nodeChange?.(lo,t,seg.t0)??sol.nodeAt(lo,t)-sol.nodeAt(lo,seg.t0))
      +c.reduce((s,v,i)=>s+v*Math.expm1(-sol.lam[i]*Math.max(0,t-seg.t0)),0));
    const cuts=new Set([a,b]); if(seg.t0>a&&seg.t0<b)cuts.add(seg.t0);
    for(const rate of sol.lam) if(rate>0)for(const z of [.125,.25,.5,1,2,4,8,16,32,64]) {
      const t=Math.max(a,seg.t0)+z/rate; if(t<b)cuts.add(t);
    }
    const xs=[...cuts].sort((x,y)=>x-y);let square=0;
    for(let j=1;j<xs.length;j++) {
      const half=(xs[j]-xs[j-1])/2;
      for(const [u,w] of GL8){const v=value(xs[j-1]+(u+1)*half)-center;square+=w*half*v*v;}
    }
    return square;
  }
  const f=(t)=>sol.nodeAt(hi,t)-sol.nodeAt(lo,t)-center;
  let sum=periodicIntegral(sol,(t)=>f(t)**2,a,b);
  for(let m=0;m<c.length;m++) if(c[m]) {
    const before=Math.min(b,seg.t0);
    if(before>a) sum+=2*c[m]*periodicIntegral(sol,f,a,before);
    if(b>Math.max(a,seg.t0)) sum+=2*c[m]*periodicIntegral(sol,f,Math.max(a,seg.t0),b,sol.lam[m],seg.t0);
    for(let n=0;n<c.length;n++) if(c[n]) {
      const rate=sol.lam[m]+sol.lam[n], start=Math.max(a,seg.t0), dt=Math.max(0,b-start);
      const integral=Math.max(0,Math.min(b,seg.t0)-a)+(dt>0 ? Math.exp(-rate*(start-seg.t0))*(rate===0?dt:-Math.expm1(-rate*dt)/rate):0);
      sum+=c[m]*c[n]*integral;
    }
  }
  return Math.max(0,sum);
}
