import { useState, useRef, useCallback, useEffect } from 'react';
import useSpeechRecognition from './useSpeechRecognition';
import { IDLE_TIMEOUT_MS } from '../lib/constants';

/**
 * Karaoke engine — clean, no hacks.
 *
 * Matching rules:
 * 1. Only match content words (4+ characters) from transcript.
 *    Short words like "the", "of", "are", "in" are ignored — Chrome picks them
 *    up from background noise constantly and they cause false advances.
 *
 * 2. LOOKAHEAD of 3: when matching a spoken word, look up to 3 positions ahead
 *    of current. This naturally skips 1-2 unrecognised UPSC terms — user says
 *    "case" and it finds it at pos+2, auto-skipping "Kesavananda Bharati".
 *
 * 3. No rolling window — it always causes cascade issues. LOOKAHEAD is the
 *    right solution for unrecognised words.
 *
 * 4. Idle timer: 30s with no real word match → motivational screen.
 */

const LOOKAHEAD     = 3;   // look this many words ahead for a match
const MAX_JUMP      = 4;   // max words to advance per utterance
const MIN_WORD_LEN  = 4;   // ignore words shorter than this (stop words / noise)

function normalise(w) {
  return w.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

export default function useKaraokeEngine({ passage, onComplete, onIdle }) {
  const words = passage ? passage.split(/\s+/).filter(Boolean) : [];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [micState,     setMicState]     = useState('idle');

  const currentIndexRef = useRef(0);
  const lastMatchRef    = useRef(0);     // timestamp of last real word match
  const sessionStartRef = useRef(0);    // passage position when current utterance began
  const idleTimerRef    = useRef(null);
  const wordsRef        = useRef(words);
  const completedRef    = useRef(false);
  const runningRef      = useRef(false);

  useEffect(() => {
    wordsRef.current     = passage ? passage.split(/\s+/).filter(Boolean) : [];
    completedRef.current = false;
  }, [passage]);

  const advanceTo = useCallback((targetIndex) => {
    const next = Math.min(targetIndex, wordsRef.current.length);
    if (next <= currentIndexRef.current) return;
    currentIndexRef.current = next;
    setCurrentIndex(next);
    if (next >= wordsRef.current.length && !completedRef.current) {
      completedRef.current = true;
      onComplete?.();
    }
  }, [onComplete]);

  // ── Transcript handler ──────────────────────────────────────
  const handleTranscript = useCallback((transcript, isFinal) => {
    const total = wordsRef.current.length;

    // Only use content words — filter out short words that cause false matches
    const spoken = transcript
      .split(/\s+/)
      .map(normalise)
      .filter(w => w.length >= MIN_WORD_LEN);

    if (spoken.length === 0) return;

    // Start from max(sessionStart, currentIndex) — never go backwards
    let pos     = Math.max(sessionStartRef.current, currentIndexRef.current);
    let furthest = currentIndexRef.current;
    let jumped   = 0;

    for (const word of spoken) {
      if (jumped >= MAX_JUMP) break;
      const end = Math.min(pos + LOOKAHEAD, total);

      for (let i = pos; i < end; i++) {
        const target = normalise(wordsRef.current[i]);
        // Also skip short passage words in the lookahead window
        if (target.length < MIN_WORD_LEN) continue;
        if (target === word) {
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

    if (furthest > currentIndexRef.current) {
      lastMatchRef.current = Date.now();
      advanceTo(furthest);
    }

    if (isFinal) {
      sessionStartRef.current = currentIndexRef.current;
    }
  }, [advanceTo]);

  // ── Idle timer only ─────────────────────────────────────────
  function startIdleTimer() {
    clearInterval(idleTimerRef.current);
    idleTimerRef.current = setInterval(() => {
      if (!runningRef.current || lastMatchRef.current === 0) return;
      if (Date.now() - lastMatchRef.current >= IDLE_TIMEOUT_MS) {
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
    lastMatchRef.current    = 0;
    sessionStartRef.current = 0;
    currentIndexRef.current = 0;
    completedRef.current    = false;
    setCurrentIndex(0);
    startMic();
    startIdleTimer();
  }

  function stop() {
    runningRef.current = false;
    stopMic();
    clearInterval(idleTimerRef.current);
    setMicState('idle');
  }

  function resume() {
    runningRef.current      = true;
    lastMatchRef.current    = 0;
    sessionStartRef.current = currentIndexRef.current;
    startMic();
    startIdleTimer();
  }

  useEffect(() => {
    return () => {
      stopMic();
      clearInterval(idleTimerRef.current);
    };
  }, [stopMic]);

  return { words, currentIndex, micState, isSupported, start, stop, resume };
}
