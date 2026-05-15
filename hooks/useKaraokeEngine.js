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

const LOOKAHEAD  = 3;   // tight window — prevents far-ahead matches from Chrome hallucinations
const MAX_JUMP   = 4;   // cap per utterance
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
  const lastMatchRef      = useRef(0);   // timestamp of last WORD MATCH (not just any transcript)
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

    // Start from whichever is further — sessionStart or currentIndex
    // (rolling window may have moved us past sessionStart already)
    let pos          = Math.max(startPos, currentIndexRef.current);
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
      lastMatchRef.current = Date.now(); // a real word matched — user is reading
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

    // Rolling window: only fires when the user IS actively speaking (Chrome heard
    // something in the last 4s) but the current word is stuck (unrecognised term).
    // If user looks away → no speech → lastSpeechRef goes stale → timer does nothing.
    windowTimerRef.current = setInterval(() => {
      if (!runningRef.current) return;
      const now            = Date.now();
      const stuck          = now - lastAdvanceRef.current;
      const sinceLastMatch = now - lastMatchRef.current;
      // Only auto-advance if a word actually matched within the last 5s
      // (proves user is actively reading the passage, not just background noise)
      const userReading = lastMatchRef.current > 0 && sinceLastMatch < 5000;

      if (stuck >= KARAOKE_WINDOW_MS && userReading) {
        advanceBy(1);
        sessionStartRef.current = currentIndexRef.current;
      }
    }, TICK_MS);

    // Idle: no word match for 30s → motivational screen
    idleTimerRef.current = setInterval(() => {
      if (!runningRef.current || lastMatchRef.current === 0) return;
      const sinceLastMatch = Date.now() - lastMatchRef.current;
      if (sinceLastMatch >= IDLE_TIMEOUT_MS) onIdle?.();
    }, 5000);
  }

  const { start: startMic, stop: stopMic, isSupported } = useSpeechRecognition({
    onResult:      handleTranscript,
    onStateChange: setMicState,
  });

  function start() {
    runningRef.current      = true;
    lastAdvanceRef.current  = Date.now();
    lastMatchRef.current    = 0;
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
    lastMatchRef.current    = 0;
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
