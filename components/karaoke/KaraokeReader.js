import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useKaraokeEngine from '../../hooks/useKaraokeEngine';
import Button from '../ui/Button';

export default function KaraokeReader({ passage, onComplete }) {
  const [showIdle, setShowIdle] = useState(false);
  const [started,  setStarted]  = useState(false);
  const [mounted,  setMounted]  = useState(false);
  const containerRef            = useRef(null);
  const activeWordRef           = useRef(null);

  useEffect(() => { setMounted(true); }, []);

  const { words, currentIndex, micState, isSupported, start, stop, resume } =
    useKaraokeEngine({ passage, onComplete, onIdle: () => setShowIdle(true) });

  // Scroll active word to centre of the box — container only, never the page
  useEffect(() => {
    if (!activeWordRef.current || !containerRef.current) return;
    const c = containerRef.current;
    const w = activeWordRef.current;
    c.scrollTo({ top: Math.max(0, w.offsetTop - c.clientHeight / 2 + w.offsetHeight / 2), behavior: 'smooth' });
  }, [currentIndex]);

  const progressPct = words.length > 0 ? Math.round((currentIndex / words.length) * 100) : 0;
  const isListening = micState === 'listening';

  return (
    <div className="relative">

      {/* ── Start CTA — shown above the passage before starting ── */}
      {!started && mounted && (
        <div className="mb-5">
          {isSupported() ? (
            <button
              onClick={() => { setStarted(true); start(); }}
              className="w-full flex items-center justify-center gap-3 bg-pink-500 hover:bg-pink-600 active:bg-pink-700 text-white font-bold text-base px-6 py-4 rounded-2xl transition-colors shadow-sm"
            >
              <span className="text-xl">🎤</span>
              <span>Start to retain — speak every word aloud</span>
            </button>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
              <strong>Open in Chrome</strong> — Web Speech API only works in Chrome.
            </div>
          )}
        </div>
      )}

      {/* Progress bar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-pink-400 to-blue-400 rounded-full"
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
        <span className="text-xs font-medium text-gray-400 tabular-nums">
          {currentIndex}/{words.length}
        </span>
      </div>

      {/* Mic pill — only after starting */}
      {started && (
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-pink-50 text-pink-500">
            <span className="relative flex h-1.5 w-1.5">
              <span className={`absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75 ${isListening ? 'animate-ping' : ''}`} />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-pink-500" />
            </span>
            {isListening ? 'Listening' : 'Mic active'}
          </span>
        </div>
      )}

      {/* ── Passage / lyrics box ── */}
      <div
        ref={containerRef}
        className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-y-auto overflow-x-hidden"
        style={{ height: '380px' }}
      >
        <div className="px-8 py-8" style={{ fontFamily: 'Georgia, serif' }}>
          {/* NO break-words on the <p> — word-level inline-block handles wrapping cleanly */}
          <p className="text-xl leading-[2.8]" style={{ wordBreak: 'normal', overflowWrap: 'normal' }}>
            {words.map((word, i) => {
              const isActive = i === currentIndex;
              const isSpoken = i < currentIndex;

              let style = {};
              if (isActive) {
                style = { color: '#111827', fontWeight: 700, fontSize: '1.06em' };
              } else if (isSpoken) {
                style = { color: '#6B7280' };
              } else {
                style = { color: '#C4C9D4' };
              }

              return (
                <span
                  key={i}
                  ref={isActive ? activeWordRef : null}
                  style={{
                    ...style,
                    display: 'inline-block',   // treat each word as atomic — never breaks mid-char
                    whiteSpace: 'nowrap',       // "Constitution" never splits to "Constitu-\ntion"
                    marginRight: '7px',
                    transition: 'color 0.15s, font-weight 0.15s',
                  }}
                >
                  {word}
                </span>
              );
            })}
          </p>
        </div>
      </div>

      {/* Idle overlay */}
      <AnimatePresence>
        {showIdle && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 rounded-2xl flex items-center justify-center z-10"
            style={{ background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(4px)' }}
          >
            <div className="text-center px-8 max-w-sm">
              <div className="text-5xl mb-4">🌟</div>
              <h3 className="text-2xl font-black text-gray-900 mb-2">
                आगे पढ़ना है, या break लेना है?
              </h3>
              <p className="text-pink-500 font-bold mb-1">5 minute aur padhlo phir break lelena!</p>
              <p className="text-gray-400 text-sm mb-7">
                Based on how you are doing this, we have a feeling — you can do this!
              </p>
              <div className="flex gap-3 justify-center">
                <Button onClick={() => { setShowIdle(false); resume(); }} size="lg">Continue Reading</Button>
                <Button onClick={() => { setShowIdle(false); stop(); }} variant="outline" size="lg">Take a Break</Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
