import test from "node:test";
import assert from "node:assert/strict";
import { emergencySirenSeconds, sirenSweepPlan, playEmergencySiren } from "../../web/src/components/adminSiren.js";

test("Emergency siren sweeps up and down instead of playing three short beeps", () => {
  const waves = sirenSweepPlan(10);
  assert.equal(emergencySirenSeconds, 3.8);
  assert.equal(waves.length, 4);
  assert.equal(waves[0].lowAt, 10);
  assert.ok(waves[0].lowAt < waves[0].highAt);
  assert.ok(waves[0].highAt < waves[0].lowAgainAt);
  assert.ok(Math.abs(waves.at(-1).lowAgainAt - 13.8) < 0.00001);
});

test("Emergency siren schedules two sweeping voices and stops promptly on mute/accept", () => {
  const frequencyActions = [];
  const rampActions = [];
  const oscillatorStops = [];
  const fakeParam = {
    value: 0.5,
    setValueAtTime: (v,t) => frequencyActions.push(["set",v,t]),
    linearRampToValueAtTime: (v,t) => rampActions.push(["ramp",v,t]),
    cancelScheduledValues: () => {}
  };
  const oscillator = () => ({
    frequency: { ...fakeParam },
    connect: () => {},
    start: () => {},
    stop: time => oscillatorStops.push(time)
  });
  const gain = () => ({ gain: { ...fakeParam }, connect: () => {} });
  const compressor = () => ({
    threshold:{value:0},knee:{value:0},ratio:{value:0},attack:{value:0},release:{value:0},
    connect: () => {}
  });
  const context = { state:"running",currentTime:10,destination:{},
    createOscillator:oscillator,createGain:gain,createDynamicsCompressor:compressor };
  const stop = playEmergencySiren(context, 0.9);
  assert.equal(oscillatorStops.length, 2);
  assert.ok(frequencyActions.some(a=>a[1]===520));
  assert.ok(rampActions.some(a=>a[1]===1090));
  assert.ok(rampActions.some(a=>a[1]===1635));
  stop();
  assert.equal(oscillatorStops.length, 4);
  assert.ok(oscillatorStops.at(-1) < 10.2);
  stop();
  assert.equal(oscillatorStops.length, 4);
  assert.doesNotThrow(()=>playEmergencySiren({ state:"suspended" },0.9)());
});
