import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MAX_ATTEMPTS } from '../../lib/constants';

const OPTIONS = ['a', 'b', 'c', 'd'];
const OPTION_LABELS = { a: 'A', b: 'B', c: 'C', d: 'D' };

export default function QuestionCard({ question, questionNumber, totalQuestions, onAnswer }) {
  const [selected, setSelected] = useState(null);
  const [attempts, setAttempts] = useState(0);
  const [result, setResult] = useState(null); // null | 'correct' | 'wrong_retry' | 'wrong_final'
  const [revealed, setRevealed] = useState(false);

  const optionText = { a: question.option_a, b: question.option_b, c: question.option_c, d: question.option_d };

  function handleSelect(option) {
    if (result === 'correct' || result === 'wrong_final') return;
    setSelected(option);
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          Question {questionNumber} of {totalQuestions}
        </span>
        {attempts > 0 && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${attempts === 1 ? 'bg-blue-50 text-blue-500' : 'bg-orange-50 text-orange-500'}`}>
            Attempt {attempts}/{MAX_ATTEMPTS}
          </span>
        )}
      </div>

      {/* Question */}
      <p className="text-gray-900 font-semibold text-base mb-5 leading-relaxed">
        {question.question_text}
      </p>

      {/* Options */}
      <div className="space-y-2.5 mb-5">
        {OPTIONS.map(opt => {
          const isSelected = selected === opt;
          const isCorrectOpt = opt === question.correct_option;
          const showCorrect = revealed && isCorrectOpt;
          const showWrong = revealed && isSelected && !isCorrectOpt;

          let optClass = 'border-gray-200 bg-white text-gray-700 hover:border-pink-200 hover:bg-pink-50';
          if (isSelected && !isLocked) optClass = 'border-pink-400 bg-pink-50 text-pink-700';
          if (showCorrect) optClass = 'border-green-400 bg-green-50 text-green-700';
          if (showWrong) optClass = 'border-red-300 bg-red-50 text-red-600';
          if (result === 'correct' && isSelected) optClass = 'border-green-400 bg-green-50 text-green-700';

          return (
            <button
              key={opt}
              onClick={() => handleSelect(opt)}
              disabled={isLocked}
              className={`w-full text-left border-2 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-150 ${optClass} disabled:cursor-not-allowed`}
            >
              <span className="font-bold mr-2">{OPTION_LABELS[opt]}.</span>
              {optionText[opt]}
            </button>
          );
        })}
      </div>

      {/* Feedback */}
      <AnimatePresence mode="wait">
        {result === 'correct' && (
          <motion.div
            key="correct"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4"
          >
            <p className="text-green-700 font-semibold text-sm mb-1">✅ Correct!</p>
            <p className="text-green-600 text-sm leading-relaxed">{question.correct_nudge}</p>
          </motion.div>
        )}

        {result === 'wrong_retry' && (
          <motion.div
            key="retry"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-4"
          >
            <p className="text-orange-700 font-semibold text-sm mb-1">❌ Not quite — try again</p>
            <p className="text-orange-600 text-sm">You have one more attempt.</p>
          </motion.div>
        )}

        {result === 'wrong_final' && (
          <motion.div
            key="final"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4"
          >
            <p className="text-blue-700 font-semibold text-sm mb-1">💡 Here's what you need to know</p>
            <p className="text-blue-600 text-sm leading-relaxed">{question.wrong_nudge || question.explanation}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action buttons */}
      {!isLocked && (
        <button
          onClick={result === 'wrong_retry' ? handleRetry : handleSubmit}
          disabled={!selected}
          className="w-full bg-pink-400 hover:bg-pink-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl text-sm transition-colors"
        >
          {result === 'wrong_retry' ? 'Try again' : 'Submit answer'}
        </button>
      )}
    </motion.div>
  );
}
