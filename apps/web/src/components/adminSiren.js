// A self-contained Web Audio emergency-style wail. No downloaded sound files or external APIs.
// All frequencies and durations are deterministic, making the scheduler testable.
export const emergencySirenSeconds = 3.8;

export function sirenSweepPlan(start = 0) {
  const cycle = emergencySirenSeconds / 4;
  return Array.from({ length: 4 }, (_, i) => ({
    lowAt: start + i * cycle,
    highAt: start + i * cycle + cycle / 2,
    lowAgainAt: start + (i + 1) * cycle
  }));
}

export function playEmergencySiren(context, volume = 0.85) {
  if (!context || context.state !== "running") return () => {};
  const safeVolume = Math.min(1, Math.max(0, Number.isFinite(volume) ? volume : 0.85));
  const begins = context.currentTime + 0.015;
  const ends = begins + emergencySirenSeconds;
  const master = context.createGain();
  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = -18;
  compressor.knee.value = 12;
  compressor.ratio.value = 8;
  compressor.attack.value = 0.004;
  compressor.release.value = 0.16;
  master.connect(compressor);
  compressor.connect(context.destination);

  // Smooth attack/release prevent clicks; richer sawtooth + overtone replaces short beeps.
  master.gain.setValueAtTime(0.0001, begins);
  master.gain.linearRampToValueAtTime(safeVolume * 0.86, begins + 0.12);
  master.gain.setValueAtTime(safeVolume * 0.86, ends - 0.18);
  master.gain.linearRampToValueAtTime(0.0001, ends);

  const oscillators = [];
  for (const [type, low, high, strength] of [
    ["sawtooth", 520, 1090, 0.34],
    ["triangle", 780, 1635, 0.17]
  ]) {
    const oscillator = context.createOscillator();
    const voiceGain = context.createGain();
    oscillator.type = type;
    voiceGain.gain.value = strength;
    oscillator.connect(voiceGain);
    voiceGain.connect(master);
    for (const sweep of sirenSweepPlan(begins)) {
      oscillator.frequency.setValueAtTime(low, sweep.lowAt);
      oscillator.frequency.linearRampToValueAtTime(high, sweep.highAt);
      oscillator.frequency.linearRampToValueAtTime(low, sweep.lowAgainAt);
    }
    oscillator.start(begins);
    oscillator.stop(ends + 0.02);
    oscillators.push(oscillator);
  }

  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    const now = context.currentTime;
    try {
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), now);
      master.gain.linearRampToValueAtTime(0.0001, now + 0.08);
    } catch { /* AudioContext may have closed. */ }
    for (const oscillator of oscillators) {
      try { oscillator.stop(now + 0.09); } catch { /* Oscillator already finished. */ }
    }
  };
}
