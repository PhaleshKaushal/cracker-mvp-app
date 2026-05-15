import { useState, useRef, useCallback, useEffect } from 'react';
import useSpeechRecognition from './useSpeechRecognition';
import { KARAOKE_WINDOW_MS, IDLE_TIMEOUT_MS } from '../lib/constants';

/**
 * Karaoke engine — correct utterance-based matching.
 *
 * Chrome Speech API sends results per utterance:
 *   interim: "fundamental rights"        (partial, may change)
 *   interim: "fundamental rights are"    (growing)
 *   final:   "fundamental rights are"    (locked in, next utterance starts fresh)
 *
 * Strategy:
 * - Each utterance has a sessionStart (passage index when that utterance began)
 * - For each interim/final, match all its words in sequence from sessionStart
 * - Advance currentIndex to the furthest matched position seen so far
 * - On final → sessionStart = currentIndex (ready for next utterance)
 *
 * No string diffing. No hacks. Speech recognition moves fast when it works.
 * Rolling window (1.2s) only handles genuinely unrecognised words (e.g. Kesavananda).
 */

const LOOKAHEAD  = 6;   // words ahead to search within for a match
const MAX_JUMP   = 5;   // cap per utterance to prevent runaway jumps
const TICK_MS    = 300; // rolling window check interval

function normalise(w) {
  return w.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

export default function useKaraokeEngine({ passage, onComplete, onIdle }) {
  const words = passage ? passage.split(/\s+/).filter(Boolean) : [];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [micState,     setMicState]     = useState('idle');

  const currentIndexRef   = useRef(0);
  const lastAdvanceRef    = useRef(Date.now());
  const sessionStartRef   = useRef(0);   // passage index when current utterance started
  const windowTimerRef    = useRef(null);
  const idleTimerRef      = useRef(null);
  const wordsRef          = useRef(words);
  const completedRef      = useRef(false);
  const runningRef        = useRef(false);

  useEffect(() => {
    wordsRef.current     = passage ? passage.split(/\s+/).filter(Boolean) : [];
    completedRef.current = false;
  }, [passage]);

  // Move to an absolute index (not relative)
  const advanceTo = useCallback((targetIndex) => {
    const next = Math.min(targetIndex, wordsRef.current.length);
    if (next <= currentIndexRef.current) return;
    lastAdvanceRef.current  = Date.now();
    currentIndexRef.current = next;
    setCurrentIndex(next);
    if (next >= wordsRef.current.length && !completedRef.current) {
      completedRef.current = true;
      onComplete?.();
    }
  }, [onComplete]);

  const advanceBy = useCallback((n) => {
    advanceTo(currentIndexRef.current + n);
  }, [advanceTo]);

  // ── Transcript handler ─────────────────────────────────────
  const handleTranscript = useCallback((transcript, isFinal) => {
    const spoken     = transcript.split(/\s+/).map(normalise).filter(Boolean);
    const total      = wordsRef.current.length;
    const startPos   = sessionStartRef.current;

    // Walk through spoken words, matching them in sequence from sessionStart
    let pos          = startPos;
    let furthest     = currentIndexRef.current;
    let jumped       = 0;

    for (const word of spoken) {
      if (!word || jumped >= MAX_JUMP) break;
      const end = Math.min(pos + LOOKAHEAD, total);
      for (let i = pos; i < end; i++) {
        const target = normalise(wordsRef.current[i]);
        if (target && target === word) {
          const newPos = i + 1;
          if (newPos > furthest) {
            furthest = newPos;
            jumped   = newPos - currentIndexRef.current;
          }
          pos = newPos;
          break;
        }
      }
    }

    // Advance to the furthest match found in this utterance
    if (furthest > currentIndexRef.current) {
      advanceTo(furthest);
    }

    // On final result: this utterance is done — next one starts from here
    if (isFinal) {
      sessionStartRef.current = currentIndexRef.current;
    }
  }, [advanceTo]);

  // ── Timers ────────────────────────────────────────────────
  function startTimers() {
    clearInterval(windowTimerRef.current);
    clearInterval(idleTimerRef.current);

    // Rolling window: if stuck on same word for KARAOKE_WINDOW_MS → nudge 1 word
    // This only fires for truly unrecognisable words — speech recognition handles the rest
    windowTimerRef.current = setInterval(() => {
      if (!runningRef.current) return;
      const stuck = Date.now() - lastAdvanceRef.current;
      if (stuck >= KARAOKE_WINDOW_MS) {
        advanceBy(1);
        // Also move session start forward so next utterance matches correctly
        sessionStartRef.current = currentIndexRef.current;
      }
    }, TICK_MS);

    // Idle: no progress for 30s → motivational screen
    idleTimerRef.current = setInterval(() => {
      if (!runningRef.current) return;
      const stuck = Date.now() - lastAdvanceRef.current;
      if (stuck >= IDLE_TIMEOUT_MS) onIdle?.();
    }, 5000);
  }

  const { start: startMic, stop: stopMic, isSupported } = useSpeechRecognition({
    onResult:      handleTranscript,
    onStateChange: setMicState,
  });

  function start() {
    runningRef.current      = true;
    lastAdvanceRef.current  = Date.now();
    sessionStartRef.current = 0;
    currentIndexRef.current = 0;
    completedRef.current    = false;
    setCurrentIndex(0);
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
    sessionStartRef.current = currentIndexRef.current;
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
