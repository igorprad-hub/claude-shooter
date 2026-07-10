"use strict";

/* Sons chiptune gerados na hora via WebAudio — nenhum arquivo de áudio.
   O AudioContext só nasce após a primeira interação (exigência dos navegadores). */
const AudioSys = (() => {
  let ctx = null;
  let muted = false;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) ctx = new AC();
    }
    if (ctx && ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function tone(freq, dur, { type = "square", vol = 0.12, slideTo = null, delay = 0 } = {}) {
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(slideTo, 1), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol = 0.15, delay = 0) {
    const t0 = ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(gain).connect(ctx.destination);
    src.start(t0);
  }

  const sfx = {
    shoot()       { tone(920, 0.05, { vol: 0.035, slideTo: 480 }); },
    hit()         { tone(300, 0.05, { vol: 0.07, slideTo: 180, type: "triangle" }); },
    explode()     { noise(0.2, 0.13); tone(170, 0.18, { type: "sawtooth", vol: 0.09, slideTo: 45 }); },
    split()       { tone(600, 0.07, { vol: 0.06, slideTo: 950 }); tone(600, 0.07, { vol: 0.06, slideTo: 950, delay: 0.09 }); },
    power()       { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.09, { vol: 0.08, delay: i * 0.06 })); },
    focusHit()    { tone(110, 0.28, { type: "sawtooth", vol: 0.15, slideTo: 55 }); noise(0.12, 0.07); },
    taskDone()    { [523, 659, 784].forEach((f, i) => tone(f, 0.15, { type: "triangle", vol: 0.11, delay: i * 0.13 })); },
    fanfare() {
      [392, 523, 659, 784].forEach((f, i) => tone(f, 0.12, { type: "triangle", vol: 0.1, delay: i * 0.09 }));
      tone(1046, 0.35, { type: "triangle", vol: 0.11, delay: 0.36 });
      tone(784, 0.35, { type: "triangle", vol: 0.08, delay: 0.36 });
    },
    boss()        { [200, 150, 200, 150].forEach((f, i) => tone(f, 0.16, { vol: 0.1, delay: i * 0.18 })); },
    bossDown()    { noise(0.5, 0.16); [420, 300, 210, 120].forEach((f, i) => tone(f, 0.18, { type: "sawtooth", vol: 0.09, delay: i * 0.1 })); },
    scopeChange() { tone(700, 0.3, { type: "sawtooth", vol: 0.1, slideTo: 180 }); },
    gameover()    { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.26, { type: "triangle", vol: 0.12, delay: i * 0.22 })); },
  };

  return {
    unlock: ensure,
    play(name) {
      if (muted || !ensure()) return;
      const fn = sfx[name];
      if (fn) fn();
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted() {
      return muted;
    },
  };
})();
