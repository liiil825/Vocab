/**
 * Speech synthesis using Google Translate TTS API
 * Falls back to Web Speech API if available
 */

import { useState, useCallback, useEffect, useRef } from 'react';

export function useSpeech() {
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setSupported(true); // We support TTS via Google API
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const speak = useCallback((text: string) => {
    // Stop any current audio
    if (audioRef.current) {
      audioRef.current.pause();
    }

    // Use Google Translate TTS
    const encoded = encodeURIComponent(text);
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=en&client=tw-ob`;

    const audio = new Audio(url);
    audioRef.current = audio;

    audio.onplay = () => setSpeaking(true);
    audio.onended = () => setSpeaking(false);
    audio.onerror = () => {
      setSpeaking(false);
      console.warn('TTS playback failed, trying Web Speech API');
      // Fallback to Web Speech API
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.rate = 0.85;
        window.speechSynthesis.speak(utterance);
      }
    };

    audio.play().catch(err => {
      console.error('Audio play failed:', err);
      setSpeaking(false);
    });
  }, []);

  const speakWord = useCallback((word: string) => {
    speak(word);
  }, [speak]);

  const speakExample = useCallback((example: string) => {
    speak(example);
  }, [speak]);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setSpeaking(false);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  return { speak, speakWord, speakExample, stop, speaking, supported };
}
