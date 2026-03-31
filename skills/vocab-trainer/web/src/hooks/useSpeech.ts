/**
 * Speech synthesis using Web Speech API
 * Plays pronunciation for words, phonetics, and examples
 */

import { useState, useCallback, useEffect } from 'react';

type SpeechOptions = {
  rate?: number;
  pitch?: number;
};

export function useSpeech() {
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported('speechSynthesis' in window);
  }, []);

  const speak = useCallback((text: string, options: SpeechOptions = {}) => {
    if (!supported) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = options.rate ?? 0.85;
    utterance.pitch = options.pitch ?? 1;

    // Try to find a good English voice
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v => v.lang === 'en-US' && v.name.includes('Natural')) ||
                     voices.find(v => v.lang === 'en-US') ||
                     voices[0];
    if (preferred) {
      utterance.voice = preferred;
    }

    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, [supported]);

  const speakWord = useCallback((word: string) => {
    speak(word);
  }, [speak]);

  const speakExample = useCallback((example: string) => {
    speak(example);
  }, [speak]);

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  return { speak, speakWord, speakExample, stop, speaking, supported };
}
