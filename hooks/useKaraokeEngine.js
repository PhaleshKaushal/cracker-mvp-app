import { useState, useRef, useCallback, useEffect } from 'react';
import useSpeechRecognition from './useSpeechRecognition';
import { KARAOKE_WINDOW_MS, IDLE_TIMEOUT_MS } from '../lib/constants';

/**
 * Karaoke engine — drives word-by-word highlighting.
 *
 * Logic:
 * - Splits passage into words, tracks current word index
 * - Chrome Web Speech API sends CUMULATIVE interim results per utterance:
 *     "Fundamental" → "Fundamental Rights" → "Fundamental Rights are guaranteed"
 *   We track the last transcript and only process the NEW suffix each time,
 *   so every word is handled exactly once no matter how fast the speaker is.
 * - After a final result, Chrome starts fresh → full new transcript processed.
 * - Proximity: match only within next LOOKAHEAD words of current position.
 * - Rolling 5-second window: if user is speaking but current word is stuck → auto-advance.
 * - 30-second idle (no transcript) → onIdle().
 */

const LOOKAHEAD      = 5;  // proximity window — only match within next 5 words
const MAX_JUMP       = 3;  // max words to advance in a single transcript event (prevents wild jumps)
const WINDOW_TICK    = 500; // rolling-window check interval (ms)

export default function useKaraokeEngine({ passage, onComplete, onIdle }) {
  const words = passage ? passage.split(/\s+/).filter(Boolean) : [];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [micState, setMicState] = useState('idle');

  const currentIndexRef      = useRef(0);
  const lastTranscriptRef    = useRef(0);        // timestamp: last time ANY speech heard
  const lastAdvanceRef       = useRef(Date.now()); // timestamp: last time index moved
  const prevTranscriptRef    = useRef('');       // last transcript text we processed
  const windowTimerRef       = useRef(null);
  const idleTimerRef         = useRef(null);
  const wordsRef             = useRef(words);
  const completedRef         = useRef(false);

  // Keep wordsRef in sync when passage changes
  useEffect(() => {
    wordsRef.current = passage ? passage.split(/\s+/).filter(Boolean) : [];
    completedRef.current = false;
  }, [passage]);

  // Normalise: strip punctuation, lowercase
  function normalise(w) {
    return w.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  }

  // Core advance function
  const advanceBy = useCallback((n = 1) => {
    const now = Date.now();
    lastAdvanceRef.current = now;

    setCurrentIndex(prev => {
      const next = Math.min(prev + n, wordsRef.current.length);
      currentIndexRef.current = next;
      if (next >= wordsRef.current.length && !completedRef.current) {
        completedRef.current = true;
        onComplete?.();
      }
      return next;
    });
  }, [onComplete]);

  // Called on every speech transcript (interim + final)
  const handleTranscript = useCallback((transcript) => {
    lastTranscriptRef.current = Date.now();

    const prev = prevTranscriptRef.current;

    // Chrome sends cumulative interim results within one utterance.
    // Only process the NEW words added since last time to avoid re-matching
    // already-spoken words and to handle any speaking speed correctly.
    let textToProcess;
    if (transcript === prev) {
      return; // exact duplicate — nothing new
    } else if (prev && transcript.startsWith(prev)) {
      textToProcess = transcript.slice(prev.length).trim(); // only the new suffix
    } else {
      textToProcess = transcript; // new utterance / final result — process fully
    }
    prevTranscriptRef.current = transcript;

    if (!textToProcess) return;

    const spokenWords = textToProcess.split(/\s+/).map(normalise).filter(Boolean);
    const totalWords  = wordsRef.current.length;
    const start       = currentIndexRef.current;
    const end         = Math.min(start + LOOKAHEAD, totalWords);

    // Match each new spoken word against the next LOOKAHEAD passage words.
    // Cap total advance per event at MAX_JUMP to prevent wild jumps from
    // Chrome hallucinating words that appear further ahead in the passage.
    let advancedThisEvent = 0;
    for (const spoken of spokenWords) {
      if (!spoken || advancedThisEvent >= MAX_JUMP) break;
      const cur = currentIndexRef.current;
      const win = Math.min(cur + LOOKAHEAD, totalWords);
      for (let i = cur; i < win; i++) {
        const target = normalise(wordsRef.current[i]);
        if (target && spoken === target) {
          const jump = i - cur + 1;
          advanceBy(jump);
          advancedThisEvent += jump;
          break;
        }
      }
    }
  }, [advanceBy]);

  // Rolling-window timer: fires every 500ms
  // If the user is actively speaking but the current word is stuck → advance 1
  function startWindowTimer() {
    clearInterval(windowTimerRef.current);
    windowTimerRef.current = setInterval(() => {
      const now                = Date.now();
      const timeSinceTranscript = now - lastTranscriptRef.current;
      const timeSinceAdvance    = now - lastAdvanceRef.current;

      const userIsSpeaking  = lastTranscriptRef.current > 0 && timeSinceTranscript < KARAOKE_WINDOW_MS;
      const wordIsStuck     = timeSinceAdvance >= KARAOKE_WINDOW_MS;

      if (userIsSpeaking && wordIsStuck) {
        advanceBy(1);
      }
    }, WINDOW_TICK);
  }

  // Idle timer: fires every 5s — triggers onIdle if no speech for 30s
  function startIdleTimer() {
    clearInterval(idleTimerRef.current);
    idleTimerRef.current = setInterval(() => {
      if (lastTranscriptRef.current === 0) return; // haven't started yet
      const timeSinceTranscript = Date.now() - lastTranscriptRef.current;
      if (timeSinceTranscript >= IDLE_TIMEOUT_MS) {
        onIdle?.();
      }
    }, 5000);
  }

  const { start: startMic, stop: stopMic, isSupported } = useSpeechRecognition({
    onResult: handleTranscript,
    onStateChange: (state) => {
      setMicState(state);
      // Every time the mic comes back online, treat it as the user actively reading.
      // This ensures the rolling-window advances even if Chrome cycles without sending
      // a transcript (common on Vercel cold-start or slow connections).
      if (state === 'listening') {
        lastTranscriptRef.current = Date.now();
      }
    },
  });

  function start() {
    lastTranscriptRef.current  = 0;
    lastAdvanceRef.current     = Date.now();
    prevTranscriptRef.current  = '';
    startMic();
    startWindowTimer();
    startIdleTimer();
  }

  function stop() {
    stopMic();
    clearInterval(windowTimerRef.current);
    clearInterval(idleTimerRef.current);
    setMicState('idle');
  }

  function resume() {
    lastTranscriptRef.current  = Date.now();
    lastAdvanceRef.current     = Date.now();
    prevTranscriptRef.current  = '';
    startMic();
    startWindowTimer();
    startIdleTimer();
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMic();
      clearInterval(windowTimerRef.current);
      clearInterval(idleTimerRef.current);
    };
  }, [stopMic]);

  return {
    words,
    currentIndex,
    micState,
    isSupported,
    start,
    stop,
    resume,
  };
}
