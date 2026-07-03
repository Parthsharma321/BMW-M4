// audio.js — Lightweight synthesized ambient engine hum + UI clicks via Web Audio API
// No external audio files: everything is generated procedurally so the build stays self-contained.

let ctx = null;
let masterGain = null;
let engineNodes = null;
let muted = true;
let started = false;
let analyser = null;

function ensureContext(){
  if (!ctx){
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.gain.value = muted ? 0 : 0.5;

    // Create AnalyserNode for HUD real-time engine visualizer
    analyser = ctx.createAnalyser();
    analyser.fftSize = 64; // Small fft size for waveform visualizer

    masterGain.connect(analyser);
    analyser.connect(ctx.destination);
  }
  return ctx;
}

export function isMuted(){ return muted; }

export function setMuted(value){
  muted = value;
  if (masterGain){
    const target = muted ? 0 : 0.5;
    masterGain.gain.cancelScheduledValues(ctx.currentTime);
    masterGain.gain.linearRampToValueAtTime(target, ctx.currentTime + 0.4);
  }
}

export function initAudioOnFirstGesture(){
  const handler = () => {
    ensureContext();
    if (ctx.state === 'suspended') ctx.resume();
    if (!started){
      startEngineStartup();
      started = true;
    }
    window.removeEventListener('pointerdown', handler);
    window.removeEventListener('keydown', handler);
  };
  window.addEventListener('pointerdown', handler, { once: true });
  window.addEventListener('keydown', handler, { once: true });
}

// A soft synthesized "engine startup" swell that settles into a low idle hum
function startEngineStartup(){
  const c = ensureContext();
  const now = c.currentTime;

  // Idle hum: two detuned low oscillators + filtered noise for texture
  const osc1 = c.createOscillator();
  osc1.type = 'sawtooth';
  osc1.frequency.value = 42;

  const osc2 = c.createOscillator();
  osc2.type = 'sawtooth';
  osc2.frequency.value = 42.6;

  const humGain = c.createGain();
  humGain.gain.value = 0;

  const lowpass = c.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = 220;
  lowpass.Q.value = 0.7;

  osc1.connect(lowpass);
  osc2.connect(lowpass);
  lowpass.connect(humGain);
  humGain.connect(masterGain);

  osc1.start(now);
  osc2.start(now);

  // Startup swell: quick rev then settle to idle
  humGain.gain.linearRampToValueAtTime(0.22, now + 0.6);
  humGain.gain.linearRampToValueAtTime(0.06, now + 1.8);

  engineNodes = { osc1, osc2, humGain, lowpass };
}

// Subtle UI click — short filtered noise burst
export function playClick(){
  if (muted) return;
  const c = ensureContext();
  const now = c.currentTime;

  const bufferSize = c.sampleRate * 0.03;
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++){
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }
  const src = c.createBufferSource();
  src.buffer = buffer;

  const bandpass = c.createBiquadFilter();
  bandpass.type = 'bandpass';
  bandpass.frequency.value = 1800;
  bandpass.Q.value = 0.8;

  const gain = c.createGain();
  gain.gain.value = 0.18;

  src.connect(bandpass);
  bandpass.connect(gain);
  gain.connect(masterGain);
  src.start(now);
}

// Modulate hum pitch/volume slightly based on scroll velocity for a sense of "driving"
export function updateEngineFromScroll(velocity){
  if (!engineNodes || muted) return;
  const c = ctx;
  const now = c.currentTime;
  const intensity = Math.min(Math.abs(velocity) * 0.002, 1);
  const targetFreq = 42 + intensity * 60;
  const targetGain = 0.06 + intensity * 0.12;
  engineNodes.osc1.frequency.linearRampToValueAtTime(targetFreq, now + 0.15);
  engineNodes.osc2.frequency.linearRampToValueAtTime(targetFreq * 1.015, now + 0.15);
  engineNodes.humGain.gain.linearRampToValueAtTime(targetGain, now + 0.2);
}

// Exported helpers for telemetry HUD visualizations
export function getAnalyserData(array) {
  if (analyser) {
    analyser.getByteFrequencyData(array);
  }
}

export function getAnalyserFrequencyBinCount() {
  return analyser ? analyser.frequencyBinCount : 0;
}
