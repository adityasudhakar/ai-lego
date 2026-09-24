// Procedural ASMR sound for the build: soft plastic slides, stud clicks and whooshes.
// Pure Web Audio with a seeded random source, so an offline render is identical every time.

function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function noiseBuffer(ctx) {
  const rand = rng(99);
  const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = rand() * 2 - 1;
  return b;
}

// A small, close room: short stereo tail so clicks sound like they're on a desk, not in a void.
function roomImpulse(ctx) {
  const rand = rng(7), len = Math.floor(ctx.sampleRate * 0.45);
  const b = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (rand() * 2 - 1) * Math.pow(1 - i / len, 4);
  }
  return b;
}

export function createBus(ctx, destination = ctx.destination) {
  const master = ctx.createGain();
  master.gain.value = 0.9;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16; comp.ratio.value = 3; comp.attack.value = 0.002; comp.release.value = 0.12;
  const room = ctx.createConvolver();
  room.buffer = roomImpulse(ctx);
  const send = ctx.createGain();
  send.gain.value = 0.22;
  const input = ctx.createGain();
  input.connect(master);
  input.connect(send).connect(room).connect(master);
  master.connect(comp).connect(destination);
  return { ctx, input, master, noise: noiseBuffer(ctx), rand: rng(2024) };
}

function panner(bus, pan) {
  const p = bus.ctx.createStereoPanner();
  p.pan.value = Math.max(-0.8, Math.min(0.8, pan));
  p.connect(bus.input);
  return p;
}

function env(g, when, peak, attack, decay) {
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(peak, when + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, when + attack + decay);
}

function tick(bus, out, when, freq, peak, decay) {
  const { ctx, rand } = bus;
  const src = ctx.createBufferSource();
  src.buffer = bus.noise;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = 7;
  const g = ctx.createGain();
  env(g, when, peak, 0.0006, decay);
  src.connect(bp).connect(g).connect(out);
  src.start(when, rand() * 1.5, decay + 0.02);
}

// One part pressing home: bright stud tick + a short hollow body knock + a quieter second tick as it seats.
// Bigger parts knock lower; plates and tiles are lighter; tiles have soft, smooth tops.
export function click(bus, when, { w = 2, d = 2, kind = 'brick', pan = 0, gain = 1 } = {}) {
  const { ctx, rand } = bus;
  const out = panner(bus, pan);
  const studs = w * d, thin = kind === 'plate' || kind === 'tile' || kind === 'round_plate';
  const vary = 0.92 + rand() * 0.16;

  tick(bus, out, when, (thin ? 5600 : 4300) * vary, 0.55 * gain, 0.011);

  const o = ctx.createOscillator();
  o.type = 'triangle';
  const f0 = (thin ? 980 : 560) / Math.pow(studs, 0.22) * vary;
  o.frequency.setValueAtTime(f0 * 1.7, when);
  o.frequency.exponentialRampToValueAtTime(f0, when + 0.012);
  const bg = ctx.createGain();
  env(bg, when, (kind === 'tile' ? 0.22 : 0.32) * gain, 0.001, thin ? 0.035 : 0.06);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 2400;
  o.connect(lp).connect(bg).connect(out);
  o.start(when); o.stop(when + 0.12);

  if (kind !== 'tile') tick(bus, out, when + 0.011 + rand() * 0.012, (thin ? 6400 : 5000) * vary, 0.22 * gain, 0.008);
}

// The part gliding down: a short, soft brush of filtered noise that rises and falls before the click.
export function slide(bus, when, dur, { pan = 0, w = 2, d = 2 } = {}) {
  const { ctx, rand } = bus;
  const out = panner(bus, pan);
  const src = ctx.createBufferSource();
  src.buffer = bus.noise;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass'; bp.Q.value = 1.4;
  const base = 1500 / Math.pow(w * d, 0.15);
  bp.frequency.setValueAtTime(base * 0.7, when);
  bp.frequency.exponentialRampToValueAtTime(base * 1.4, when + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(0.05, when + dur * 0.55);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  src.connect(bp).connect(g).connect(out);
  src.start(when, rand() * 1.5, dur + 0.02);
}

// A page turning: a papery swish that peaks mid-turn, then a soft flap as it lands on the pile.
export function pageFlip(bus, when, dur) {
  const { ctx, rand } = bus;
  const out = panner(bus, 0.25 - rand() * 0.1);
  const src = ctx.createBufferSource();
  src.buffer = bus.noise;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass'; hp.frequency.value = 900;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass'; bp.Q.value = 0.6;
  bp.frequency.setValueAtTime(2200, when);
  bp.frequency.exponentialRampToValueAtTime(5200, when + dur * 0.5);
  bp.frequency.exponentialRampToValueAtTime(2600, when + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(0.16, when + dur * 0.45);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  src.connect(hp).connect(bp).connect(g).connect(out);
  src.start(when, rand() * 1.5, dur + 0.02);

  const flap = ctx.createBufferSource();
  flap.buffer = bus.noise;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 700;
  const fg = ctx.createGain();
  env(fg, when + dur * 0.92, 0.32, 0.004, 0.07);
  flap.connect(lp).connect(fg).connect(panner(bus, -0.3));
  flap.start(when + dur * 0.92, rand() * 1.5, 0.1);
}

// Air moving as the model flies apart (rising) or pulls back together (falling).
export function whoosh(bus, when, dur, rising = true) {
  const { ctx } = bus;
  const src = ctx.createBufferSource();
  src.buffer = bus.noise; src.loop = true;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass'; bp.Q.value = 0.8;
  bp.frequency.setValueAtTime(rising ? 280 : 1800, when);
  bp.frequency.exponentialRampToValueAtTime(rising ? 1800 : 300, when + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(0.16, when + dur * 0.45);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  src.connect(bp).connect(g).connect(bus.input);
  src.start(when); src.stop(when + dur + 0.05);
}

// Play one showreel cue (from lego3d.showreelCues) at audio time `when`.
export function playCue(bus, cue, when, parts, centreX) {
  const p = cue.part != null ? parts[cue.part] : null;
  const opts = p && { w: p.w, d: p.d, kind: p.kind, pan: (p.x + p.w / 2 - centreX) / 9, gain: cue.gain ?? 1 };
  if (cue.type === 'click') click(bus, when, opts);
  else if (cue.type === 'slide') slide(bus, when, cue.dur, opts);
  else if (cue.type === 'whoosh') whoosh(bus, when, cue.dur, cue.rising);
  else if (cue.type === 'flip') pageFlip(bus, when, cue.dur);
}

// Render the full showreel soundtrack offline and return it as a 16-bit stereo WAV (Uint8Array).
export async function renderSoundtrack(cues, parts, centreX, duration, sampleRate = 44100) {
  const ctx = new OfflineAudioContext(2, Math.ceil(duration * sampleRate), sampleRate);
  const bus = createBus(ctx);
  for (const c of cues) playCue(bus, c, c.t, parts, centreX);
  return wav(await ctx.startRendering());
}

function wav(buf) {
  const ch = [buf.getChannelData(0), buf.getChannelData(1)], n = buf.length;
  // normalise to -1 dBFS so the track plays at a sensible level on phones
  let peak = 1e-9;
  for (const c of ch) for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(c[i]));
  const k = 0.89 / peak;
  for (const c of ch) for (let i = 0; i < n; i++) c[i] *= k;
  const out = new DataView(new ArrayBuffer(44 + n * 4));
  const str = (o, s) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); out.setUint32(4, 36 + n * 4, true); str(8, 'WAVE'); str(12, 'fmt ');
  out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 2, true);
  out.setUint32(24, buf.sampleRate, true); out.setUint32(28, buf.sampleRate * 4, true);
  out.setUint16(32, 4, true); out.setUint16(34, 16, true); str(36, 'data'); out.setUint32(40, n * 4, true);
  for (let i = 0, o = 44; i < n; i++) for (let c = 0; c < 2; c++, o += 2) {
    out.setInt16(o, Math.max(-1, Math.min(1, ch[c][i])) * 0x7fff, true);
  }
  return new Uint8Array(out.buffer);
}
