import { useRef, useCallback } from 'react';

/**
 * Low-level wrapper around the Web Speech API.
 * Handles auto-restart on error or unexpected end.
 * Calls onResult(transcript) with each interim/final result.
 */
export default function useSpeechRecognition({ onResult, onStateChange }) {
  const recognitionRef = useRef(null);
  const activeRef = useRef(false);

  const start = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      onStateChange?.('unsupported');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SpeechRecognition();

    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-IN';

    rec.onstart = () => {
      activeRef.current = true;
      onStateChange?.('listening');
    };

    rec.onresult = (event) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      if (transcript.trim()) onResult(transcript.trim().toLowerCase());
    };

    rec.onerror = (event) => {
      // Ignore no-speech errors — they're normal pauses
      if (event.error === 'no-speech') return;
      onStateChange?.('restarting');
      // Auto-restart after brief delay
      setTimeout(() => {
        if (activeRef.current) {
          try { rec.start(); } catch (_) {}
        }
      }, 300);
    };

    rec.onend = () => {
      // Auto-restart if we're still supposed to be active
      if (activeRef.current) {
        onStateChange?.('restarting');
        setTimeout(() => {
          try { rec.start(); } catch (_) {}
        }, 200);
      } else {
        onStateChange?.('stopped');
      }
    };

    recognitionRef.current = rec;

    try {
      rec.start();
    } catch (e) {
      onStateChange?.('error');
    }
  }, [onResult, onStateChange]);

  const stop = useCallback(() => {
    activeRef.current = false;
    try {
      recognitionRef.current?.stop();
    } catch (_) {}
  }, []);

  const isSupported = () =>
    typeof window !== 'undefined' &&
    ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window);

  return { start, stop, isSupported };
}
