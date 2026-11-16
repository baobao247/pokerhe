/* ============================================================
   ADVANCED PROCEDURAL WEB AUDIO ENGINE
============================================================ */
const AudioEngine = {
  ctx: null,
  enabled: true,

  init() {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){}
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },

  playChip() {
    if (!this.enabled) return;
    this.init(); if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1200 + Math.random()*400, t);
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.08);
  },

  playCard() {
    if (!this.enabled) return;
    this.init(); if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(420 + Math.random()*80, t);
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.linearRampToValueAtTime(0.001, t + 0.1);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.1);
  },

  playKnock() {
    if (!this.enabled) return;
    this.init(); if (!this.ctx) return;
    [0, 0.08].forEach(dt => {
      const t = this.ctx.currentTime + dt;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(110, t);
      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.05);
    });
  },

  playFold() {
    if (!this.enabled) return;
    this.init(); if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.linearRampToValueAtTime(160, t + 0.14);
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.linearRampToValueAtTime(0.001, t + 0.14);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.14);
  },

  playWin() {
    if (!this.enabled) return;
    this.init(); if (!this.ctx) return;
    const chord = [523.25, 659.25, 783.99, 1046.50, 1318.51];
    chord.forEach((freq, idx) => {
      setTimeout(() => {
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.22, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.35);
      }, idx * 80);
    });
  }
};
document.addEventListener('click', () => AudioEngine.init(), { once: true });

