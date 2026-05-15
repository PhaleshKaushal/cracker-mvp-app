import { useRef, useCallback } from 'react';

/**
 * Web Speech API wrapper.
 * - Creates a fresh SpeechRecognition object on every (re)start — reusing is unreliable
 * - Passes isFinal flag so the engine can distinguish utterance boundaries
 * - Ignores no-speech and aborted errors (normal Chrome behaviour)
 */
export default function useSpeechRecognition({ onResult, onStateChange }) {
  const activeRef        = useRef(false);
  const onResultRef      = useRef(onResult);
  const onStateChangeRef = useRef(onStateChange);

  onResultRef.current      = onResult;
  onStateChangeRef.current = onStateChange;

  function createAndStart() {
    if (!activeRef.current) return;

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { onStateChangeRef.current?.('unsupported'); return; }

    const rec = new SR();
    rec.continuous      = true;
    rec.interimResults  = true;
    rec.lang            = 'en-IN';
    rec.maxAlternatives = 1;

    rec.onstart = () => onStateChangeRef.current?.('listening');

    rec.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript.trim().toLowerCase();
        const isFinal    = event.results[i].isFinal;
        if (transcript) onResultRef.current?.(transcript, isFinal);
      }
    };

    rec.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      onStateChangeRef.current?.('restarting');
      setTimeout(createAndStart, 300);
    };

    rec.onend = () => {
      if (activeRef.current) {
        onStateChangeRef.current?.('restarting');
        setTimeout(createAndStart, 150);
      } else {
        onStateChangeRef.current?.('stopped');
      }
    };

    try { rec.start(); } catch (_) { setTimeout(createAndStart, 400); }
  }

  const start = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      onStateChange?.('unsupported'); return;
    }
    activeRef.current = true;
    createAndStart();
  }, []); // eslint-disable-line

  const stop = useCallback(() => {
    activeRef.current = false;
    onStateChangeRef.current?.('stopped');
  }, []);

  const isSupported = () =>
    typeof window !== 'undefined' &&
    ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window);

  return { start, stop, isSupported };
}
