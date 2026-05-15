import { useRef, useCallback } from 'react';

/**
 * Web Speech API wrapper.
 * Creates a FRESH SpeechRecognition object on every start/restart —
 * reusing the same object after .stop() is unreliable in Chrome.
 */
export default function useSpeechRecognition({ onResult, onStateChange }) {
  const activeRef  = useRef(false);
  const onResultRef      = useRef(onResult);
  const onStateChangeRef = useRef(onStateChange);

  // Keep refs current so restarts always use the latest callbacks
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

    rec.onstart = () => {
      onStateChangeRef.current?.('listening');
    };

    rec.onresult = (event) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      if (transcript.trim()) {
        onResultRef.current?.(transcript.trim().toLowerCase());
      }
    };

    rec.onerror = (event) => {
      if (event.error === 'no-speech') return; // normal pause — ignore
      if (event.error === 'aborted')   return; // we called stop() — ignore
      // For other errors, restart
      onStateChangeRef.current?.('restarting');
      setTimeout(createAndStart, 300);
    };

    rec.onend = () => {
      if (activeRef.current) {
        // Session ended naturally — restart immediately with a fresh object
        onStateChangeRef.current?.('restarting');
        setTimeout(createAndStart, 150);
      } else {
        onStateChangeRef.current?.('stopped');
      }
    };

    try {
      rec.start();
    } catch (e) {
      // Already started or other error — retry shortly
      setTimeout(createAndStart, 400);
    }
  }

  const start = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      onStateChange?.('unsupported');
      return;
    }
    activeRef.current = true;
    createAndStart();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const stop = useCallback(() => {
    activeRef.current = false;
    onStateChangeRef.current?.('stopped');
  }, []);

  const isSupported = () =>
    typeof window !== 'undefined' &&
    ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window);

  return { start, stop, isSupported };
}
