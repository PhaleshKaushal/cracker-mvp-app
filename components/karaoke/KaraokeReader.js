import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useKaraokeEngine from '../../hooks/useKaraokeEngine';
import Button from '../ui/Button';

const MIC_STATE_LABEL = {
  idle:        '',
  listening:   'Listening...',
  restarting:  'Reconnecting...',
  unsupported: '',
  error:       '',
};

export default function KaraokeReader({ passage, onComplete }) {
  const [showIdle, setShowIdle]   = useState(false);
  const [started, setStarted]     = useState(false);
  const [mounted, setMounted]     = useState(false);
  const containerRef              = useRef(null);
  const activeWordRef             = useRef(null);

  // Only check speech support after hydration — window doesn't exist on server
  useEffect(() => { setMounted(true); }, []);

  const { words, currentIndex, micState, isSupported, start, stop, resume } =
    useKaraokeEngine({
      passage,
      onComplete,
      onIdle: () => setShowIdle(true),
    });

  // Scroll active word to the centre of the container — no page scroll
  useEffect(() => {
    if (!activeWordRef.current || !containerRef.current) return;
    const container = containerRef.current;
    const word      = activeWordRef.current;
    const target    = word.offsetTop - container.clientHeight / 2 + word.offsetHeight / 2;
    container.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
  }, [currentIndex]);

  function handleStart() {
    setStarted(true);
    start();
  }

  const progressPct = words.length > 0
    ? Math.round((currentIndex / words.length) * 100)
    : 0;

  const isListening = micState === 'listening';

  return (
    <div className="relative">

      {/* ── Progress bar ── */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-pink-400 to-blue-400 rounded-full"
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
        <span className="text-xs font-semibold text-gray-400 tabular-nums w-10 text-right">
          {progressPct}%
        </span>
      </div>

      {/* ── Mic status pill ── */}
      {started && (
        <div className="flex items-center gap-2 mb-4">
          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
            isListening
              ? 'bg-pink-100 text-pink-600'
              : 'bg-gray-100 text-gray-400'
          }`}>
            {isListening && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-pink-500" />
              </span>
            )}
            {MIC_STATE_LABEL[micState] || 'Mic idle'}
          </span>
          <span className="text-xs text-gray-400">
            {currentIndex} / {words.length} words
          </span>
        </div>
      )}

      {/* ── Passage box ── */}
      <div
        ref={containerRef}
        className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-y-auto overflow-x-hidden"
        style={{ height: '400px' }}
      >
        <div className="p-7" style={{ fontFamily: 'Georgia, serif' }}>
          <p className="text-xl leading-[2.4] break-words">
            {words.map((word, i) => {
              const isActive = i === currentIndex;
              const isSpoken = i < currentIndex;

              return (
                <span
                  key={i}
                  ref={isActive ? activeWordRef : null}
                  className={[
                    'inline transition-all duration-100',
                    isSpoken
                      ? 'text-gray-700'
                      : !isActive
                      ? 'text-gray-300'
                      : '',
                  ].join(' ')}
                  style={isActive ? {
                    color: '#be185d',
                    fontWeight: 700,
                    fontSize: '1.18em',
                    background: 'linear-gradient(135deg, #fdf2f8, #eff6ff)',
                    borderRadius: '5px',
                    padding: '1px 5px',
                    boxShadow: '0 0 0 2px #f9a8d4',
                    marginRight: '6px',
                  } : { marginRight: '6px' }}
                >
                  {word}
                </span>
              );
            })}
          </p>
        </div>
      </div>

      {/* ── Start / not started ── */}
      {!started && mounted && (
        <div className="mt-6 text-center">
          {isSupported() ? (
            <>
              <Button onClick={handleStart} size="lg">
                🎤 Start reading aloud
              </Button>
              <p className="text-xs text-gray-400 mt-2">
                Chrome will ask for mic permission · Works best in Chrome
              </p>
            </>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
              <strong>Open this page in Chrome</strong> — Web Speech API only works there.
            </div>
          )}
        </div>
      )}

      {/* ── Idle / motivational overlay ── */}
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
              <p className="text-pink-500 font-bold mb-1">
                5 minute aur padhlo phir break lelena!
              </p>
              <p className="text-gray-400 text-sm mb-7 leading-relaxed">
                Based on how you are doing this, we have a feeling — you can do this!
              </p>
              <div className="flex gap-3 justify-center">
                <Button onClick={() => { setShowIdle(false); resume(); }} size="lg">
                  Continue Reading
                </Button>
                <Button onClick={() => { setShowIdle(false); stop(); }} variant="outline" size="lg">
                  Take a Break
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
