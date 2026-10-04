import test from 'node:test';
import assert from 'node:assert/strict';
import {Bench} from '../src/bench/bench.js';
const near=(a,b,e=1e-9)=>assert.ok(Math.abs(a-b)<=e,`${a} vs ${b}`);
function setup(C=1,p={}){
 let t=0;const source={wave:'SQUARE',freq:1000,sym:50,duty:50,phase:0,emfVpp:0,emfOffset:0,...p,output:false},afg={on:true,ch:[source,{...source,output:false}]},gpe={on:true,output:false,mode:'INDEP',eff:()=>({vs:5,is:.01})},b=new Bench(afg,null,gpe),leads={'AFG.CH1+':'P','AFG.CH1-':'E','GPE.CH1+':'P','GPE.CH1-':'E'};
 b.now=()=>t;b.board='bb';b.bbWires=Object.fromEntries(Object.keys(leads).map(id=>[id,id]));b.bb={key:()=>'',netlist:()=>({nodes:['P','E'],elements:[{id:'C',kind:'C',a:'P',b:'E',value:C}],leads,warnings:[]})};b.solution();source.output=true;gpe.output=true;const sol=b.solution();return {b,sol,at:x=>{t=x;return b.solution();}};
}
function reference(a,b,center,C){const g=.02+1e-12,tau=C/g,A=.01/g,d=b-a,q=A-center;return q*q-2*q*A*tau/d*(Math.exp(-a/tau)-Math.exp(-b/tau))+A*A*tau/(2*d)*(Math.exp(-2*a/tau)-Math.exp(-2*b/tau));}

test('hybrid centered square over true startup agrees with closed-form CC charging for short and million-cycle windows',()=>{
 const {sol}=setup(1);assert.equal(typeof sol.actualCenteredSquareOver,'function');
 for(const [a,b,center]of [[0,.00027,0],[.00013,.01237,.2],[0,1000,.2],[10,210,.5],[999,1000,.5],[1000,1001,0]])near(sol.actualCenteredSquareOver('P','E',a,b,center),reference(a,b,center,1),2e-9);
 near(sol.actualCenteredSquareOver('P','E',-1,0,.2),.04,1e-12);near(sol.actualCenteredSquareOver('P','E',1e6,1e6+2e-10,.2),.09,2e-9);
 // Stable independent midpoint integral resolves a tiny startup voltage whose
 // formal steady and transient terms would otherwise cancel when squared.
 const end=1e-5,N=10000,g=.02+1e-12,A=.01/g,tau=1/g;let tiny=0;for(let k=0;k<N;k++){const v=A*-Math.expm1(-(k+.5)*end/N/tau);tiny+=v*v/N;}
 near(sol.actualCenteredSquareOver('P','E',0,end,0),tiny,1e-20);
 assert.equal(typeof sol.actualPeakOver,'function');
 for(const [a,b,center]of [[0,1e-7,0],[0,.00027,0],[.00013,.01237,.2],[0,1000,.2],[10,210,.5]]){const value=t=>A*-Math.expm1(-t/tau),expected=Math.max(Math.abs(value(a)-center),Math.abs(value(b)-center));near(sol.actualPeakOver('P','E',a,b,center),expected,2e-9);}
});

test('hybrid actual square keeps short CC/CV/RB pieces instead of sampling across protection transitions',()=>{
 const {sol}=setup(47e-9,{emfVpp:10,emfOffset:5,duty:1}),start=0,end=.001,N=400000,h=(end-start)/N;
 const center=sol.actualMeanOver('P','E',start,end);let sum=0,peak=0;for(let k=0;k<N;k++){const t=start+(k+.5)*h,v=sol.actualNodeAt('P',t)-center;sum+=v*v;peak=Math.max(peak,Math.abs(v));}
 near(sol.actualCenteredSquareOver('P','E',start,end,center),sum/N,2e-5);
 near(sol.actualPeakOver('P','E',start,end,center),peak,2e-4);
 const late=sol.actualCenteredSquareOver('P','E',10,10.001,sol.stats('P','E').mean);near(Math.sqrt(late),sol.stats('P','E').acRms,1e-6);
});
