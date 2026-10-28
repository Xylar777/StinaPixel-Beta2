
class AudioEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = localStorage.getItem('stnapixel_muted') === 'true';
  private lastDrawTime: number = 0;
  private drawThrottling: number = 25; 

  private init() {
    try {
      if (!this.ctx) {
        this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    } catch (e) {}
  }

  setMuted(muted: boolean) {
    this.isMuted = muted;
    localStorage.setItem('stnapixel_muted', muted.toString());
  }

  getMuted(): boolean {
    return this.isMuted;
  }

  playDraw() {
    if (this.isMuted) return;
    const now = Date.now();
    if (now - this.lastDrawTime < this.drawThrottling) return;
    this.lastDrawTime = now;

    this.init();
    if (!this.ctx) return;

    const time = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1800, time);
    osc.frequency.exponentialRampToValueAtTime(1000, time + 0.01);

    gain.gain.setValueAtTime(0.05, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.01);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(time);
    osc.stop(time + 0.015);
  }

  playTick(velocity: number = 1) {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx || this.ctx.state !== 'running') return;

    const time = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    // Більш "механічний" звук для кейсу
    osc.type = 'square'; 
    const baseFreq = 80 + (velocity * 120);
    osc.frequency.setValueAtTime(baseFreq, time);
    osc.frequency.exponentialRampToValueAtTime(20, time + 0.01);

    gain.gain.setValueAtTime(0.015 * velocity, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.01);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(time);
    osc.stop(time + 0.012);
  }

  playWin() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
    
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.08);

      gain.gain.setValueAtTime(0, now + i * 0.08);
      gain.gain.linearRampToValueAtTime(0.1, now + i * 0.08 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.08 + 0.8);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 1.2);
    });
  }
}

export const sound = new AudioEngine();
