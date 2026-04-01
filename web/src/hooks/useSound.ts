/**
 * Sound effects utility using Web Audio API
 * Creates synthesized sounds for feedback interactions
 */

type SoundType = 'pass' | 'fail' | 'fuzzy' | 'click' | 'reveal';

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

function playTone(frequency: number, duration: number, type: OscillatorType = 'sine', volume = 0.3) {
  const ctx = getAudioContext();
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.frequency.value = frequency;
  oscillator.type = type;

  gainNode.gain.setValueAtTime(volume, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

  oscillator.start(ctx.currentTime);
  oscillator.stop(ctx.currentTime + duration);
}

export function playSound(type: SoundType) {
  try {
    switch (type) {
      case 'pass':
        // Bright, ascending chime - success
        playTone(523, 0.1, 'sine', 0.25); // C5
        setTimeout(() => playTone(659, 0.1, 'sine', 0.25), 60); // E5
        setTimeout(() => playTone(784, 0.15, 'sine', 0.2), 120); // G5
        break;

      case 'fail':
        // Low, descending tone - failure
        playTone(220, 0.2, 'triangle', 0.3); // A3
        setTimeout(() => playTone(196, 0.25, 'triangle', 0.25), 100); // G3
        break;

      case 'fuzzy':
        // Medium, neutral click
        playTone(330, 0.08, 'sine', 0.2); // E4
        setTimeout(() => playTone(262, 0.12, 'sine', 0.15), 50); // C4
        break;

      case 'click':
        // Soft pop for general interactions
        playTone(400, 0.05, 'sine', 0.15);
        break;

      case 'reveal':
        // Gentle reveal sound
        playTone(523, 0.08, 'sine', 0.12);
        break;
    }
  } catch {
    // Silently fail if audio context not available
  }
}
