// Real UI counterexample: change an actual source while Single is acquiring.
// Setup is edited through the supported validated file workflow; runtime model
// state is only observed through __eess, never written by page evaluation.
import fs from 'node:fs/promises';
import { openApp, Check, sleep } from './lib.mjs';
import { setupRC } from './rc-ui.mjs';
export async function run(){
 const T=new Check('示波器因果採集與AC暫態'),ui=await openApp(),p=ui.page;
 const scope=id=>ui.press(`TDS.KEY.${id}`),opt=n=>ui.press(`TDS.SOFT.OPT${n}`);
 const afg=id=>ui.press(`AFG.${id}`),digits=async value=>{for(const c of String(value))await afg(c==='.'?'NUM.DOT':`NUM.DIGIT_${c}`);};
 const now=()=>p.evaluate(()=>performance.now()/1000),snap=()=>ui.snap('tds');
 const configure=async state=>{
  await scope('SAVE_RECALL');let s=await snap();
  while(s.extended.store.action!=='RECALL_SETUP'){await opt(1);s=await snap();}
  if(s.extended.store.target!=='FILE')await opt(2);
  const chooser=p.waitForEvent('filechooser');await opt(5);
  await(await chooser).setFiles({name:'causal-setup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'ee-ss-tds-setup-v1',state}))});
  await p.locator('.hintbar').filter({hasText:/已回復|已載入/}).waitFor();
 };
 const waveform=async()=>{
  await scope('SAVE_RECALL');let s=await snap();
  while(s.extended.store.action!=='SAVE_WAVEFORM'){await opt(1);s=await snap();}
  if(s.extended.store.target!=='FILE')await opt(2);
  if(s.extended.store.source!==1)await opt(3);
  const wait=p.waitForEvent('download');await opt(5);const download=await wait;
  return(await fs.readFile(await download.path(),'utf8')).trim().split('\n').slice(1).map(line=>line.split(',').map(Number));
 };
 try{
  const epoch=Date.now();await p.clock.install({time:epoch});await p.reload();await p.locator('svg.panel').waitFor();await p.clock.pauseAt(epoch+1000);
  await ui.tab('tds');await scope('SAVE_RECALL');await opt(2);const wait=p.waitForEvent('download');await opt(5);const download=await wait;
  const template=JSON.parse(await fs.readFile(await download.path(),'utf8')).state;
  Object.assign(template,{sIdx:22,mpos:0,run:'single'});Object.assign(template.trig,{src:1,level:.1,mode:'NORMAL',coup:'DC',slope:'R'});
  Object.assign(template.ch[1],{on:true,probe:10,vIdx:5,pos:0,coupling:'DC',bw:false});template.ch[0].on=false;
  template.extended.acquire='SAMPLE';template.extended.horizontal.view='MAIN';template.extended.autoRange.on=false;
  await ui.tab('afg');await afg('KEY.PRESET');await afg('KEY.CH1_CH2');await afg('KEY.CH1_CH2');await afg('SOFT.F1');await afg('SOFT.F2');
  await afg('KEY.AMPL');await digits(.02);await afg('SOFT.F5');await afg('KEY.DC_OFFSET');await digits(2);await afg('SOFT.F2');
  await setupRC(ui, { R: 1000, C: .00001 });
  await ui.tab('tds');await configure(template);T.ok((await snap()).status==='Ready','輸出關閉時Single真正等待觸發');
  await ui.tab('afg');await afg('KEY.OUTPUT');await p.clock.runFor(220);await ui.tab('tds');const early=await snap();
  T.ok(early.pendingAcquisition&&early.status==="Trig'd"&&!early.complete,'觸發後後半筆未完成，仍維持採集中');
  T.ok(early.pendingAcquisition?.endAt>await now(),'最後樣本時刻尚未發生，沒有提前宣稱完成');
  await ui.tab('afg');await afg('KEY.DC_OFFSET');await digits(0);await afg('SOFT.F2');
  await p.clock.runFor(600);await ui.tab('tds');await p.waitForFunction(()=>window.__eess.snapshot('tds').complete,{},{timeout:3000});const completed=await snap();
  T.ok(completed.status==='Acq. Complete'&&completed.rec.endAt<=await now(),'只在全部實際取樣完成後停止');
  const samples=await waveform(),sample=t=>samples.reduce((best,v)=>Math.abs(v[0]-t)<Math.abs(best[0]-t)?v:best)[1];
  T.ok(Math.abs(sample(-.05))<.02,'CSV預觸發輸出尚未打開的歷史保持0V');
  T.ok(sample(.02)>1.5&&Math.abs(sample(.4))<.05,'CSV收進採集中改成0V後的實際放電，沒有凍住預測未來');
  await ui.shot('tds-causal-single');
  // Reuse the actual RC, now settled at 0; CH AC must capture a causal rising
  // transient rather than subtracting the future circuit DC from old history.
  await p.clock.runFor(1000);template.ch[1].coupling='AC';template.trig.level=.05;await configure(template);
  await ui.tab('afg');await afg('KEY.DC_OFFSET');await digits(2);await afg('SOFT.F2');await p.clock.runFor(800);await ui.tab('tds');
  await p.waitForFunction(()=>window.__eess.snapshot('tds').complete,{},{timeout:3000});const ac=await waveform();
  const acAt=t=>ac.reduce((best,v)=>Math.abs(v[0]-t)<Math.abs(best[0]-t)?v:best)[1];
  T.ok(Math.abs(acAt(-.05))<.02&&acAt(.08)>1,'AC保留0V預觸發與真实RC耦合暫態');
  T.ok(ui.errors.length===0,`沒有瀏覽器錯誤：${ui.errors.join('; ')}`);await ui.shot('tds-causal-ac');
 }finally{await ui.close();}
 return T;
}
if(process.argv[1]?.endsWith('/tds-causal-acquisition.mjs')){const T=await run();T.print();if(T.fail)process.exitCode=1;}
