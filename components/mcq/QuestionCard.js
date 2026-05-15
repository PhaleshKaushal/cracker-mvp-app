import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MAX_ATTEMPTS } from '../../lib/constants';

const OPTIONS = ['a', 'b', 'c', 'd'];

export default function QuestionCard({ question, questionNumber, totalQuestions, onAnswer }) {
  const [selected, setSelected]   = useState(null);
  const [attempts, setAttempts]   = useState(0);
  const [result, setResult]       = useState(null); // null | correct | wrong_retry | wrong_final
  const [revealed, setRevealed]   = useState(false);

  const optionText = {
    a: question.option_a,
    b: question.option_b,
    c: question.option_c,
    d: question.option_d,
  };

  function handleSelect(opt) {
    if (result === 'correct' || result === 'wrong_final') return;
    setSelected(opt);
  }

  function handleSubmit() {
    if (!selected) return;
    const newAttempts = attempts + 1;
    setAttempts(newAttempts);
    const isCorrect = selected === question.correct_option;

    if (isCorrect) {
      setResult('correct');
      onAnswer({ questionId: question.id, selectedOption: selected, isCorrect: true, attemptNumber: newAttempts });
    } else if (newAttempts >= MAX_ATTEMPTS) {
      setResult('wrong_final');
      setRevealed(true);
      onAnswer({ questionId: question.id, selectedOption: selected, isCorrect: false, attemptNumber: newAttempts });
    } else {
      setResult('wrong_retry');
    }
  }

  function handleRetry() {
    setSelected(null);
    setResult(null);
  }

  const isLocked = result === 'correct' || result === 'wrong_final';

  function optionStyle(opt) {
    const isSelected   = selected === opt;
    const isCorrectOpt = opt === question.correct_option;

    if (result === 'correct' && isSelected)
      return 'border-green-400 bg-green-50 text-green-800 shadow-sm';
    if (revealed && isCorrectOpt)
      return 'border-green-400 bg-green-50 text-green-800 shadow-sm';
    if (revealed && isSelected && !isCorrectOpt)
      return 'border-red-300 bg-red-50 text-red-700';
    if (isSelected && !isLocked)
      return 'border-pink-400 bg-pink-50 text-pink-800 shadow-sm';
    return 'border-gray-200 bg-white text-gray-700 hover:border-pink-200 hover:bg-pink-50/50';
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden"
    >
      {/* ── Top bar: progress ── */}
      <div className="flex items-center justify-between px-6 pt-5 pb-1">
        <div className="flex gap-1.5">
          {Array.from({ length: totalQuestions }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i < questionNumber      ? 'bg-pink-400 w-6'
                : i === questionNumber - 1 ? 'bg-pink-300 w-6'
                : 'bg-gray-200 w-3'
              }`}
            />
          ))}
        </div>
        <span className="text-xs text-gray-400 font-medium">
          {questionNumber} / {totalQuestions}
        </span>
      </div>

      <div className="px-6 pb-6 pt-4">
        {/* ── Question text ── */}
        <p className="text-gray-900 font-semibold text-base leading-relaxed mb-5">
          {question.question_text}
        </p>

        {/* ── Options ── */}
        <div className="space-y-2.5 mb-5">
          {OPTIONS.map(opt => (
            <button
              key={opt}
              onClick={() => handleSelect(opt)}
              disabled={isLocked}
              className={`w-full text-left border-2 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-150 ${optionStyle(opt)} disabled:cursor-default`}
            >
              <span className="font-bold mr-2 text-gray-400">{opt.toUpperCase()}.</span>
              {optionText[opt]}
            </button>
          ))}
        </div>

        {/* ── Feedback ── */}
        <AnimatePresence mode="wait">
          {result === 'correct' && (
            <motion.div
              key="correct"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-xl p-4 mb-4 bg-green-50 border border-green-200"
            >
              <p className="text-green-700 font-bold text-sm mb-1">✅ Correct!</p>
              <p className="text-green-600 text-sm leading-relaxed">{question.correct_nudge}</p>
            </motion.div>
          )}

          {result === 'wrong_retry' && (
            <motion.div
              key="retry"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-xl p-4 mb-4 bg-orange-50 border border-orange-200"
            >
              <p className="text-orange-700 font-bold text-sm mb-1">❌ Not quite</p>
              <p className="text-orange-600 text-sm">One more try — think carefully.</p>
            </motion.div>
          )}

          {result === 'wrong_final' && (
            <motion.div
              key="final"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-xl p-4 mb-4 bg-blue-50 border border-blue-200"
            >
              <p className="text-blue-700 font-bold text-sm mb-1">💡 Here's what to know</p>
              <p className="text-blue-600 text-sm leading-relaxed">{question.explanation}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Action button ── */}
        {!isLocked && (
          <button
            onClick={result === 'wrong_retry' ? handleRetry : handleSubmit}
            disabled={!selected}
            className="w-full bg-gradient-to-r from-pink-400 to-pink-500 hover:from-pink-500 hover:to-pink-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl text-sm transition-all shadow-sm"
          >
            {result === 'wrong_retry' ? 'Try again →' : 'Submit answer →'}
          </button>
        )}
      </div>
    </motion.div>
  );
}
