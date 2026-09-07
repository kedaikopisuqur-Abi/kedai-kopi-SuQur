// Web Audio API based Sound Synthesizer for POS Alerts & Incoming QR Orders
// Works across all browsers and devices without relying on external mp3 files

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch (e) {
    return null;
  }
}

/**
 * Play a distinctive 3-tone Cashier / Kitchen Bell Chime (Ding - Dong - Ding!)
 * Specifically designed for incoming QR Self-Orders.
 */
export function playOrderNotificationBell(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Helper to play a chime tone
    const playChimeTone = (freq: number, startTime: number, duration: number, gainVal: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      // Triangle / Sine blend for a clear bell chime
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      // Attack & Exponential Decay
      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(gainVal, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration);

      // Add high harmonic overtone for realistic metal bell ring
      const overtone = ctx.createOscillator();
      const overtoneGain = ctx.createGain();
      overtone.type = 'triangle';
      overtone.frequency.setValueAtTime(freq * 2.76, startTime);
      overtoneGain.gain.setValueAtTime(0.001, startTime);
      overtoneGain.gain.linearRampToValueAtTime(gainVal * 0.25, startTime + 0.01);
      overtoneGain.gain.exponentialRampToValueAtTime(0.0001, startTime + (duration * 0.6));

      overtone.connect(overtoneGain);
      overtoneGain.connect(ctx.destination);

      overtone.start(startTime);
      overtone.stop(startTime + duration);
    };

    // Melody: F6 (1396.9Hz) -> A6 (1760Hz) -> C7 (2093Hz) -> High Ding (2793Hz)
    playChimeTone(1046.5, now + 0.0, 0.45, 0.45); // C6
    playChimeTone(1318.5, now + 0.16, 0.45, 0.5); // E6
    playChimeTone(1567.98, now + 0.32, 0.55, 0.55); // G6
    playChimeTone(2093.0, now + 0.50, 0.85, 0.65); // C7 (Long resonant ring)
  } catch (err) {
    console.debug('Audio chime playback omitted by browser policy:', err);
  }
}

/**
 * Play standard transaction / action chime
 */
export function playActionChime(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.35);
  } catch (e) {}
}

/**
 * Play alert warning tone
 */
export function playAlertWarning(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.setValueAtTime(330, now + 0.15);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.35);
  } catch (e) {}
}

/**
 * Play success payment chime (QRIS / Cash / Card) with optional Indonesian Voice TTS
 */
export function playSuccessSound(amount?: number, message?: string): void {
  try {
    const ctx = getAudioContext();
    if (ctx) {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      // Chord C5 (523.25 Hz) to G5 (783.99 Hz) to C6 (1046.5 Hz)
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(783.99, now + 0.12);
      osc.frequency.setValueAtTime(1046.5, now + 0.24);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.6);
    }

    // Indonesian Text-to-Speech voice notification if amount is specified and speech synthesis supported
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const textToSpeak = message || (amount && amount > 0 
        ? `Pembayaran berhasil sebesar ${amount.toLocaleString('id-ID')} rupiah.` 
        : 'Pembayaran berhasil diterima.');
      
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = 'id-ID';
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  } catch (e) {
    console.debug('Audio play success error:', e);
  }
}
