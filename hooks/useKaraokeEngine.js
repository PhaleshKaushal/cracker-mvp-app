import { useState, useRef, useCallback, useEffect } from 'react';
import useSpeechRecognition from './useSpeechRecognition';
import { KARAOKE_WINDOW_MS, IDLE_TIMEOUT_MS } from '../lib/constants';

/**
 * Karaoke engine — simplified, bulletproof approach:
 *
 * 1. Speech recognition matches words in the next LOOKAHEAD positions → fast advance
 * 2. Rolling window: if stuck on same word for 5s → auto-advance 1 word
 *    (handles UPSC terms, cycling mic, anything Chrome can't recognise)
 * 3. Idle: if stuck on same word for 30s → onIdle() fires
 *
 * The rolling window is unconditional once reading starts — no dependency on
 * whether a transcript was received. This makes the karaoke always progress.
 */

const LOOKAHEAD   = 5;    // proximity window for speech matching
const MAX_JUMP    = 3;    // max words per transcript event
const WINDOW_TICK = 500;  // check interval (ms)

function normalise(w) {
  return w.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

export default function useKaraokeEngine({ passage, onComplete, onIdle }) {
  const words = passage ? passage.split(/\s+/).filter(Boolean) : [];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [micState,     setMicState]     = useState('idle');

  const currentIndexRef  = useRef(0);
  const lastAdvanceRef   = useRef(Date.now());
  const prevTranscriptRef = useRef('');
  const windowTimerRef   = useRef(null);
  const idleTimerRef     = useRef(null);
  const wordsRef         = useRef(words);
  const completedRef     = useRef(false);
  const runningRef       = useRef(false); // true while reading is active

  useEffect(() => {
    wordsRef.current  = passage ? passage.split(/\s+/).filter(Boolean) : [];
    completedRef.current = false;
  }, [passage]);

  const advanceBy = useCallback((n = 1) => {
    lastAdvanceRef.current = Date.now();
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

  // ── Speech transcript handler ────────────────────────────────
  const handleTranscript = useCallback((transcript) => {
    const prev = prevTranscriptRef.current;

    // Only process new words (Chrome sends cumulative interim results)
    let text;
    if (transcript === prev) return;
    else if (prev && transcript.startsWith(prev)) text = transcript.slice(prev.length).trim();
    else text = transcript;
    prevTranscriptRef.current = transcript;

    if (!text) return;

    const spokenWords = text.split(/\s+/).map(normalise).filter(Boolean);
    let advanced = 0;

    for (const spoken of spokenWords) {
      if (!spoken || advanced >= MAX_JUMP) break;
      const cur = currentIndexRef.current;
      const end = Math.min(cur + LOOKAHEAD, wordsRef.current.length);
      for (let i = cur; i < end; i++) {
        const target = normalise(wordsRef.current[i]);
        if (target && spoken === target) {
          const jump = i - cur + 1;
          advanceBy(jump);
          advanced += jump;
          break;
        }
      }
    }
  }, [advanceBy]);

  // ── Rolling window + idle timers ─────────────────────────────
  function startTimers() {
    clearInterval(windowTimerRef.current);
    clearInterval(idleTimerRef.current);

    // Rolling window: advance words proportional to how long we've been stuck.
    // E.g. stuck 1.2s → advance 1, stuck 2.4s → advance 2, capped at 3.
    // Unconditional — once reading starts, always progress.
    windowTimerRef.current = setInterval(() => {
      if (!runningRef.current) return;
      const stuck = Date.now() - lastAdvanceRef.current;
      if (stuck >= KARAOKE_WINDOW_MS) {
        const n = Math.min(Math.floor(stuck / KARAOKE_WINDOW_MS), 3);
        advanceBy(n);
      }
    }, WINDOW_TICK);

    // Idle: stuck for IDLE_TIMEOUT_MS → show motivational screen
    idleTimerRef.current = setInterval(() => {
      if (!runningRef.current) return;
      const stuck = Date.now() - lastAdvanceRef.current;
      if (stuck >= IDLE_TIMEOUT_MS) {
        onIdle?.();
      }
    }, 5000);
  }

  const { start: startMic, stop: stopMic, isSupported } = useSpeechRecognition({
    onResult:      handleTranscript,
    onStateChange: setMicState,
  });

  function start() {
    runningRef.current      = true;
    lastAdvanceRef.current  = Date.now();
    prevTranscriptRef.current = '';
    currentIndexRef.current = 0;
    setCurrentIndex(0);
    completedRef.current    = false;
    startMic();
    startTimers();
  }

  function stop() {
    runningRef.current = false;
    stopMic();
    clearInterval(windowTimerRef.current);
    clearInterval(idleTimerRef.current);
    setMicState('idle');
  }

  function resume() {
    runningRef.current      = true;
    lastAdvanceRef.current  = Date.now();
    prevTranscriptRef.current = '';
    startMic();
    startTimers();
  }

  useEffect(() => {
    return () => {
      stopMic();
      clearInterval(windowTimerRef.current);
      clearInterval(idleTimerRef.current);
    };
  }, [stopMic]);

  return { words, currentIndex, micState, isSupported, start, stop, resume };
}
