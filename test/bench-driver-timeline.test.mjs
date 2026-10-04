import test from 'node:test';
import assert from 'node:assert/strict';
import { createInstruments } from '../src/instruments/index.js';
import { Bench } from '../src/bench/bench.js';

function setup() {
  const models = createInstruments(), b = new Bench(models.afg, models.dmm, models.gpe), clock = { t: 0 }, driver = { end: null };
  b.now = () => clock.t; b.C = 1e-6; models.dmm.fn = 'OHM';
  b.wires = { 'AFG.CH1+': 'A', 'AFG.CH1-': 'G', 'DMM.HI': 'B', 'DMM.LO': 'G' };
  models.afg.driverDescriptor = (i, time) => ({ wave: 'SINE', freq: 1000, sym: 50,
    emfVpp: 0, emfOffset: time === undefined || driver.end !== null && time < driver.end ? 5 : 0,
    output: i === 0 && driver.end !== null, eventToken: driver.end });
  models.afg.driverTransitionTimes = (t) => driver.end !== null && driver.end > t ? [driver.end] : [];
  b.solution(); return { b, clock, driver };
}
const near = (got, expected) => assert.ok(Math.abs(got - expected) < 1e-8, `${got} vs ${expected}`);
test('bounded source stops at its deadline even when polling skips the entire pulse', () => {
  const { b, clock, driver } = setup(), tau = 1050e-6;
  clock.t = 1; driver.end = 1.01; b.solution();
  clock.t = 1.011;
  near(b.vcAt(clock.t), 5 * (1 - Math.exp(-.01 / tau)) * Math.exp(-.001 / tau));
  assert.ok(b.segs.some((s) => s.from === 1.01));
  const key = b.cacheKey; clock.t = 3; b.solution(); assert.equal(b.cacheKey, key);
  near(b.vcAt(1.005), 5 * (1 - Math.exp(-.005 / tau)));
  near(b.vcAt(.99), 0);
  const mean = b.dmmInput().v.meanOver(1.009, 1.011);
  const integral = 5 * (.001 - tau * (Math.exp(-.009 / tau) - Math.exp(-.01 / tau)))
    + 5 * (1 - Math.exp(-.01 / tau)) * tau * (1 - Math.exp(-.001 / tau));
  near(mean, integral / .002);
});
test('retriggering cancels only the old future end and preserves existing charge/history', () => {
  const { b, clock, driver } = setup(), tau = 1050e-6;
  clock.t = 1; driver.end = 1.01; b.solution();
  clock.t = 1.005; driver.end = 1.02; b.solution();
  clock.t = 1.015; near(b.vcAt(clock.t), 5 * (1 - Math.exp(-.015 / tau)));
  assert.ok(!b.segs.some((s) => s.from === 1.01));
  clock.t = 1.021; near(b.vcAt(clock.t), 5 * (1 - Math.exp(-.02 / tau)) * Math.exp(-.001 / tau));
  near(b.vcAt(1.002), 5 * (1 - Math.exp(-.002 / tau)));
});

test('ARB sample edits do not rewrite lazy hybrid history or jump capacitor charge',()=>{
  const m=createInstruments(),b=new Bench(m.afg,m.dmm,m.gpe),clock={t:0};b.now=()=>clock.t;b.C=10e-6;
  const c=m.afg.ch[0];c.wave='ARB';c.extended.arb.rate=4000;c.extended.arb.length=4;c.freq=1000;
  c.extended.arb.points.splice(0,4,511,-511,511,-511);c.emfVpp=2;c.emfOffset=1;c.output=true;
  m.gpe.on=true;m.gpe.output=true;m.gpe.vset[1]=50;m.gpe.iset[1]=2;
  b.wires={'AFG.CH1+':'A','AFG.CH1-':'G','GPE.CH1+':'B','GPE.CH1-':'G'};b.solution();
  clock.t=.0043;const voltage=b.vcAt(clock.t),past=b.vcAt(.0042),old=b.segs[0];
  const result=m.afg.importArbFile({format:'ee-ss-afg-arb',version:1,rate:4000,points:[0,0,0,0]});
  assert.notEqual(result?.kind,'reject');b.solution();
  near(b.vcAt(clock.t),voltage);near(b.vcAt(.0042),past);
  assert.notEqual(old.built.net.afg[0].p.extended.arb.points,m.afg.ch[0].extended.arb.points);
  assert.equal(old.built.net.afg[0].p.extended.arb.points[0],511);
  m.afg.ch[0].extended.motion.depth=5;
  assert.equal(old.built.net.afg[0].p.extended.motion.depth,100);
});
