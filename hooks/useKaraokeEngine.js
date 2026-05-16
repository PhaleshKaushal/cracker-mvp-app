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

const LOOKAHEAD     = 6;   // look this many words ahead for a match
const MAX_JUMP      = 6;   // max content-word advances per utterance
const MIN_WORD_LEN  = 5;   // ignore words shorter than this
                           // 4-letter words like "from","with","draw","have","that"
                           // are too common — Chrome picks them up from ambient noise
                           // and causes false advances. 5+ chars filters them cleanly.

// Number word ↔ digit bridge — Chrome often transcribes "Three" as "3".
// Keys are already normalised (lowercase, no hyphens) to match normalise() output.
const WORD_TO_NUM = {
  zero:'0', one:'1', two:'2', three:'3', four:'4', five:'5',
  six:'6', seven:'7', eight:'8', nine:'9', ten:'10',
  eleven:'11', twelve:'12', thirteen:'13', fourteen:'14', fifteen:'15',
  sixteen:'16', seventeen:'17', eighteen:'18', nineteen:'19', twenty:'20',
  twentyone:'21', twentytwo:'22', twentythree:'23', twentyfour:'24',
  twentyfive:'25', thirty:'30', thirtyone:'31', thirtytwo:'32',
  thirtythree:'33', thirtyfour:'34', thirtyfive:'35', forty:'40',
  fortyfive:'45', fifty:'50', sixty:'60', seventy:'70', eighty:'80',
  ninety:'90', hundred:'100', thousand:'1000',
};
const NUM_TO_WORD = Object.fromEntries(
  Object.entries(WORD_TO_NUM).map(([w, d]) => [d, w])
);

// True if w is a pure integer string like "3", "12", "35"
const isNumber = (w) => /^\d+$/.test(w);

function normalise(w) {
  return w.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

/** True if spoken word matches target word, allowing number word ↔ digit swap */
function wordMatches(spoken, target) {
  if (spoken === target) return true;
  if (NUM_TO_WORD[spoken] === target) return true;  // "3" → "three"
  if (WORD_TO_NUM[spoken] === target) return true;  // "three" → "3"
  return false;
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

    // Only use content words — filter short stop words that cause false matches.
    // Exception: keep pure digit tokens ("3","12","35") — Chrome often transcribes
    // written-out numbers like "Three" as the digit "3".
    const spoken = transcript
      .split(/\s+/)
      .map(normalise)
      .filter(w => w.length >= MIN_WORD_LEN || isNumber(w));

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
        // Skip short passage words in lookahead — but keep digits (e.g. "12", "35")
        if (target.length < MIN_WORD_LEN && !isNumber(target)) continue;
        if (wordMatches(word, target)) {
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
