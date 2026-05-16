import { useState, useRef, useCallback, useEffect } from 'react';
import useSpeechRecognition from './useSpeechRecognition';
import { IDLE_TIMEOUT_MS } from '../lib/constants';

/**
 * Karaoke engine.
 *
 * Chrome sends CUMULATIVE interim results within each utterance:
 *   interim → "fundamental rights"
 *   interim → "fundamental rights are guaranteed"
 *   final   → "fundamental rights are guaranteed in Part Three"
 *
 * We process only the DIFF (new words since last interim) on interims,
 * and the full transcript on final. This prevents re-scanning already-
 * matched words and eliminates cascade false advances.
 *
 * MIN_WORD_LEN=4 keeps the noise filter tight enough while diff processing
 * means a single common word in a 1-word diff can only advance 1 position.
 */

const LOOKAHEAD    = 4;  // words ahead to search — skips unrecognised UPSC terms
const MAX_JUMP     = 5;  // max passage advances per transcript chunk
const MIN_WORD_LEN = 4;  // filter noise; safe with diff processing

// ── Number word ↔ digit bridge ───────────────────────────────
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

const isNumber = (w) => /^\d+$/.test(w);

function normalise(w) {
  return w.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

function wordMatches(spoken, target) {
  if (spoken === target) return true;
  if (NUM_TO_WORD[spoken] === target) return true;
  if (WORD_TO_NUM[spoken] === target) return true;
  return false;
}

// ─────────────────────────────────────────────────────────────

export default function useKaraokeEngine({ passage, onComplete, onIdle }) {
  const words = passage ? passage.split(/\s+/).filter(Boolean) : [];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [micState,     setMicState]     = useState('idle');

  const currentIndexRef = useRef(0);
  const lastMatchRef    = useRef(0);
  const sessionStartRef = useRef(0);
  const lastInterimRef  = useRef('');
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
    let toProcess;

    if (isFinal) {
      toProcess = transcript;
      lastInterimRef.current = '';
    } else {
      const prev = lastInterimRef.current;
      toProcess = transcript.startsWith(prev)
        ? transcript.slice(prev.length).trim()
        : transcript;
      lastInterimRef.current = transcript;
    }

    // ── DEBUG — open F12 console to see this ──
    console.log(`[🎤 ${isFinal?'FINAL':'interim'}] raw="${transcript}" | toProcess="${toProcess}" | idx=${currentIndexRef.current}`);

    if (!toProcess) return;

    const spoken = toProcess
      .split(/\s+/)
      .map(normalise)
      .filter(w => w.length >= MIN_WORD_LEN || isNumber(w));

    console.log(`[🎤 tokens]`, spoken, `| scanning from ${Math.max(sessionStartRef.current, currentIndexRef.current)}`);

    if (spoken.length === 0) return;

    let pos      = Math.max(sessionStartRef.current, currentIndexRef.current);
    let furthest = currentIndexRef.current;
    let jumped   = 0;

    for (const word of spoken) {
      if (jumped >= MAX_JUMP) break;
      const end = Math.min(pos + LOOKAHEAD, total);

      for (let i = pos; i < end; i++) {
        const target = normalise(wordsRef.current[i]);
        if (!target || (target.length < MIN_WORD_LEN && !isNumber(target))) continue;
        if (wordMatches(word, target)) {
          const newPos = i + 1;
          if (newPos > furthest) {
            furthest = newPos;
            jumped   = newPos - currentIndexRef.current;
          }
          pos = newPos;
          console.log(`[🎤 match] "${word}" = passage[${i}]="${wordsRef.current[i]}" → advance to ${newPos}`);
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

  // ── Idle timer ───────────────────────────────────────────────
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
    lastInterimRef.current  = '';
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
    lastInterimRef.current  = '';
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
