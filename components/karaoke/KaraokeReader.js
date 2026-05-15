import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useKaraokeEngine from '../../hooks/useKaraokeEngine';
import Button from '../ui/Button';

const MIC_STATE_LABEL = {
  idle:        '',
  listening:   '🎤 Listening...',
  restarting:  '🔄 Restarting mic...',
  unsupported: '',
  error:       '',
};

export default function KaraokeReader({ passage, onComplete }) {
  const [showIdle, setShowIdle]   = useState(false);
  const [started, setStarted]     = useState(false);
  const containerRef              = useRef(null);
  const activeWordRef             = useRef(null);

  const { words, currentIndex, micState, isSupported, start, stop, resume } =
    useKaraokeEngine({
      passage,
      onComplete,
      onIdle: () => setShowIdle(true),
    });

  // Scroll the active word to the vertical centre of the passage box
  // Uses container-relative scroll so the page itself never jumps
  useEffect(() => {
    if (!activeWordRef.current || !containerRef.current) return;
    const container = containerRef.current;
    const word      = activeWordRef.current;

    // offsetTop relative to the scrollable container
    const wordTop    = word.offsetTop;
    const wordHeight = word.offsetHeight;
    const target     = wordTop - container.clientHeight / 2 + wordHeight / 2;

    container.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
  }, [currentIndex]);

  function handleStart() {
    setStarted(true);
    start();
  }

  function handleResume() {
    setShowIdle(false);
    resume();
  }

  function handleBreak() {
    setShowIdle(false);
    stop();
    setStarted(false);
  }

  const progressPct = words.length > 0
    ? Math.round((currentIndex / words.length) * 100)
    : 0;

  return (
    <div className="relative">
      {/* Progress bar */}
      <div className="h-1.5 bg-gray-100 rounded-full mb-4 overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-pink-400 to-blue-400 rounded-full"
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Mic status row */}
      {started && micState && MIC_STATE_LABEL[micState] && (
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-pink-500 bg-pink-50 px-3 py-1 rounded-full">
            {MIC_STATE_LABEL[micState]}
          </span>
          <span className="text-xs text-gray-400">{progressPct}% read</span>
        </div>
      )}

      {/* Passage text — karaoke display */}
      <div
        ref={containerRef}
        className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm overflow-y-auto overflow-x-hidden"
        style={{ height: '380px', fontFamily: 'Georgia, serif', wordBreak: 'break-word', overflowWrap: 'break-word' }}
      >
        <p className="text-lg leading-[2.2] text-left whitespace-normal break-words">
          {words.map((word, i) => {
            const isActive = i === currentIndex;
            const isSpoken = i < currentIndex;

            return (
              <span
                key={i}
                ref={isActive ? activeWordRef : null}
                className={[
                  'inline mr-1.5 transition-all duration-150 rounded',
                  isSpoken  ? 'word-spoken'  : '',
                  isActive  ? 'word-active'  : '',
                  (!isSpoken && !isActive) ? 'word-default' : '',
                ].join(' ')}
              >
                {word}
              </span>
            );
          })}
        </p>
      </div>

      {/* Start button */}
      {!started && (
        <div className="mt-5 text-center">
          {isSupported() ? (
            <>
              <Button onClick={handleStart} size="lg">
                🎤 Start reading aloud
              </Button>
              <p className="text-xs text-gray-400 mt-2">
                Your browser will ask for mic permission. Chrome works best.
              </p>
            </>
          ) : (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800">
              <strong>Please open this page in Chrome</strong> — the karaoke feature
              uses Web Speech API which only works in Chrome.
            </div>
          )}
        </div>
      )}

      {/* Idle / motivational overlay */}
      <AnimatePresence>
        {showIdle && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-white/95 backdrop-blur-sm rounded-2xl flex items-center justify-center z-10"
          >
            <div className="text-center px-8 max-w-md">
              <div className="text-4xl mb-4">🌟</div>
              <h3 className="text-2xl font-black text-gray-900 mb-3">
                आगे पढ़ना है, या break लेना है?
              </h3>
              <p className="text-pink-500 font-semibold mb-2">
                5 minute aur padhlo phir break lelena!
              </p>
              <p className="text-gray-500 text-sm mb-8 leading-relaxed">
                Based on how you are doing this, we have a feeling — you can do this!
              </p>
              <div className="flex gap-3 justify-center">
                <Button onClick={handleResume} size="lg">
                  Continue Reading
                </Button>
                <Button onClick={handleBreak} variant="outline" size="lg">
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
