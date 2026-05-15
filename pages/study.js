import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { OPENING_CARDS_PER_SESSION, WEAK_ARTICLE_THRESHOLD } from '../lib/constants';
import OpeningCard from '../components/karaoke/OpeningCard';
import KaraokeReader from '../components/karaoke/KaraokeReader';
import QuestionCard from '../components/mcq/QuestionCard';
import Nav from '../components/layout/Nav';
import Button from '../components/ui/Button';

// Screens: loading → opening_cards → reading → questions → passage_complete → end

export default function StudyPage() {
  const router = useRouter();

  const [user,         setUser]         = useState(null);
  const [screen,       setScreen]       = useState('loading');

  // Opening cards
  const [openingCards, setOpeningCards] = useState([]);
  const [cardIndex,    setCardIndex]    = useState(0);

  // Passages
  const [passages,       setPassages]       = useState([]);
  const [passageIndex,   setPassageIndex]   = useState(0);
  const [currentPassage, setCurrentPassage] = useState(null);

  // Questions — one at a time
  const [questions,       setQuestions]       = useState([]);
  const [questionIndex,   setQuestionIndex]   = useState(0); // which Q we're on
  const [lastResult,      setLastResult]      = useState(null); // correct | wrong for current Q
  const [answers,         setAnswers]         = useState([]);

  // Session tracking
  const [sessionId,    setSessionId]    = useState(null);
  const [sessionStart, setSessionStart] = useState(null);

  // ── Auth ────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data?.user ?? null));
  }, []);

  // ── Load opening cards + passages ───────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const { data: cards, error: cardErr } = await supabase
          .from('opening_cards').select('*').limit(20);

        if (cardErr) console.error('[Cracker] opening_cards fetch error:', cardErr.message);

        if (cards?.length) {
          const shuffled = [...cards].sort(() => Math.random() - 0.5);
          setOpeningCards(shuffled.slice(0, OPENING_CARDS_PER_SESSION));
        }

        const { data: passageData, error: passErr } = await supabase
          .from('passages')
          .select('*')
          .order('order_index', { ascending: true });

        if (passErr) console.error('[Cracker] passages fetch error:', passErr.message);

        if (passageData?.length) {
          setPassages(passageData);
          setCurrentPassage(passageData[0]);
        }
      } catch (e) {
        console.error('[Cracker] load() threw:', e.message);
      } finally {
        // Always unblock the UI — even on error
        setScreen('opening_cards');
      }
    }
    load();
  }, []);

  // ── Opening card nav ─────────────────────────────────────────
  function handleCardNext() {
    if (cardIndex < openingCards.length - 1) {
      setCardIndex(p => p + 1);
    } else {
      startReading(passages[passageIndex]);
    }
  }

  // ── Start reading ────────────────────────────────────────────
  async function startReading(passage) {
    setCurrentPassage(passage);
    let sid = sessionId;
    if (user && passage) {
      const { data } = await supabase
        .from('study_sessions')
        .insert({ user_id: user.id, passage_id: passage.id })
        .select('id')
        .single();
      if (data) sid = data.id;
    }
    setSessionId(sid);
    setSessionStart(Date.now());
    setScreen('reading');
  }

  // ── Reading done → fetch questions ──────────────────────────
  async function handleReadingComplete() {
    const passage = passages[passageIndex];
    if (!passage) return;

    if (sessionId && sessionStart) {
      const readTimeSec = Math.round((Date.now() - sessionStart) / 1000);
      await supabase.from('study_sessions').update({ read_time_s: readTimeSec }).eq('id', sessionId);
    }

    const { data: qs } = await supabase
      .from('questions')
      .select('*')
      .eq('passage_id', passage.id)
      .order('order_index', { ascending: true });

    setQuestions(qs || []);
    setAnswers([]);
    setQuestionIndex(0);
    setLastResult(null);
    setScreen('questions');
  }

  // ── Save answer for current question ────────────────────────
  const handleAnswer = useCallback(async ({ questionId, selectedOption, isCorrect, attemptNumber }) => {
    const passage = passages[passageIndex];
    if (user && sessionId && passage) {
      await supabase.from('answers').insert({
        session_id:      sessionId,
        user_id:         user.id,
        question_id:     questionId,
        passage_id:      passage.id,
        selected_option: selectedOption,
        is_correct:      isCorrect,
        attempt_number:  attemptNumber,
      });
    }
    setAnswers(prev => [...prev, { questionId, isCorrect, attemptNumber }]);
    setLastResult(isCorrect ? 'correct' : 'wrong');
  }, [user, sessionId, passageIndex, passages]);

  // ── Next question or complete ────────────────────────────────
  function handleNextQuestion() {
    if (questionIndex < questions.length - 1) {
      setQuestionIndex(p => p + 1);
      setLastResult(null);
    } else {
      completePassage();
    }
  }

  async function completePassage() {
    if (sessionId) {
      await supabase
        .from('study_sessions')
        .update({ is_complete: true, completed_at: new Date().toISOString() })
        .eq('id', sessionId);
    }
    setScreen('passage_complete');
  }

  // ── Next passage ─────────────────────────────────────────────
  function handleNextPassage() {
    const next = passageIndex + 1;
    if (next < passages.length) {
      setPassageIndex(next);
      setSessionId(null);
      startReading(passages[next]);
    } else {
      setScreen('end');
    }
  }

  // ── Derived ──────────────────────────────────────────────────
  const correctCount  = answers.filter(a => a.isCorrect).length;
  const passageScore  = questions.length > 0 ? correctCount / questions.length : 0;
  const isWeak        = passageScore < WEAK_ARTICLE_THRESHOLD;
  const currentQ      = questions[questionIndex];
  const questionAnswered = lastResult !== null;

  // ──────────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────────

  if (screen === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3 animate-pulse">📖</div>
          <p className="text-gray-400 text-sm font-medium">Loading your session...</p>
        </div>
      </div>
    );
  }

  // ── Opening cards ───────────────────────────────────────────
  if (screen === 'opening_cards') {
    // Guard: cards didn't load (Supabase error or empty DB)
    if (!openingCards.length) {
      return (
        <div className="min-h-screen flex items-center justify-center px-6">
          <div className="text-center max-w-sm">
            <div className="text-4xl mb-3">😕</div>
            <p className="text-gray-700 font-semibold mb-2">Couldn't load session data</p>
            <p className="text-gray-400 text-sm mb-5">There might be a connection issue. Open browser console (F12) for details.</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-pink-400 text-white font-bold px-6 py-2.5 rounded-xl text-sm hover:bg-pink-500 transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return (
      <OpeningCard
        card={openingCards[cardIndex]}
        cardIndex={cardIndex}
        totalCards={openingCards.length}
        onNext={handleCardNext}
      />
    );
  }

  // ── Reading ─────────────────────────────────────────────────
  if (screen === 'reading' && currentPassage) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Nav user={user} />
        <div className="max-w-3xl mx-auto px-6 py-8">
          <div className="mb-6">
            <span className="text-xs font-bold text-pink-500 uppercase tracking-widest">
              {currentPassage.article}
            </span>
            <h1 className="text-2xl font-black text-gray-900 mt-1 mb-0.5">
              {currentPassage.title}
            </h1>
            <p className="text-xs text-gray-400 font-medium">
              Passage {passageIndex + 1} of {passages.length} · Read every word aloud
            </p>
          </div>

          <KaraokeReader passage={currentPassage.content} onComplete={handleReadingComplete} />

          <div className="mt-5 text-center">
            <button
              onClick={handleReadingComplete}
              className="text-xs text-gray-300 hover:text-gray-500 underline underline-offset-2 transition-colors"
            >
              Skip to questions
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Questions — one at a time ────────────────────────────────
  if (screen === 'questions' && currentQ) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Nav user={user} />
        <div className="max-w-2xl mx-auto px-6 py-8">

          {/* Header */}
          <div className="mb-7">
            <span className="text-xs font-bold text-blue-500 uppercase tracking-widest">
              {currentPassage?.article}
            </span>
            <h1 className="text-2xl font-black text-gray-900 mt-1">
              Test your understanding
            </h1>
          </div>

          {/* Question card */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentQ.id}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.25 }}
            >
              <QuestionCard
                question={currentQ}
                questionNumber={questionIndex + 1}
                totalQuestions={questions.length}
                onAnswer={handleAnswer}
              />
            </motion.div>
          </AnimatePresence>

          {/* Next / Finish button — appears after answering */}
          <AnimatePresence>
            {questionAnswered && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-4 flex justify-end"
              >
                <Button onClick={handleNextQuestion} size="lg">
                  {questionIndex < questions.length - 1 ? 'Next question →' : 'See results →'}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </div>
    );
  }

  // ── Passage complete ─────────────────────────────────────────
  if (screen === 'passage_complete') {
    const emoji = passageScore === 1 ? '🔥' : passageScore >= WEAK_ARTICLE_THRESHOLD ? '💪' : '📚';
    const message = passageScore === 1
      ? 'Perfect. Every answer locked in. That passage is now wired in.'
      : passageScore >= WEAK_ARTICLE_THRESHOLD
      ? "Solid work. Your brain is building the highway."
      : "This one needs another pass — we'll flag it in your dashboard.";

    return (
      <div className="min-h-screen bg-gray-50">
        <Nav user={user} />
        <div className="max-w-lg mx-auto px-6 py-12 text-center">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>

            <div className="text-6xl mb-5">{emoji}</div>
            <h2 className="text-3xl font-black text-gray-900 mb-1">{currentPassage?.title}</h2>
            <p className="text-gray-400 text-sm mb-8">{currentPassage?.article}</p>

            {/* Score card */}
            <div className="bg-white border border-gray-100 rounded-2xl p-7 shadow-sm mb-6">
              <div className="text-6xl font-black bg-gradient-to-r from-pink-400 to-blue-400 bg-clip-text text-transparent mb-3">
                {correctCount}/{questions.length}
              </div>

              {/* Answer dots */}
              <div className="flex justify-center gap-2 mb-4">
                {answers.map((a, i) => (
                  <div
                    key={i}
                    className={`h-3 w-3 rounded-full ${a.isCorrect ? 'bg-green-400' : 'bg-red-300'}`}
                  />
                ))}
              </div>

              <p className="text-gray-500 text-sm leading-relaxed">{message}</p>
            </div>

            {/* Sign-up nudge for guests */}
            {!user && (
              <div className="bg-gradient-to-r from-pink-50 to-blue-50 border border-pink-100 rounded-2xl p-5 mb-6 text-left">
                <h3 className="font-bold text-gray-900 mb-1">Save your progress 🔒</h3>
                <p className="text-gray-500 text-sm mb-4">
                  Sign in with a magic link to track weak articles and see your improvement over time.
                </p>
                <Button onClick={() => router.push('/login')} fullWidth>
                  Sign in to save progress →
                </Button>
              </div>
            )}

            <div className="flex gap-3 justify-center">
              {passageIndex < passages.length - 1 ? (
                <Button onClick={handleNextPassage} size="lg">
                  Next passage →
                </Button>
              ) : (
                <Button onClick={() => setScreen('end')} size="lg">
                  See final results →
                </Button>
              )}
              {user && (
                <Button onClick={() => router.push('/dashboard')} variant="outline" size="lg">
                  Dashboard
                </Button>
              )}
            </div>

          </motion.div>
        </div>
      </div>
    );
  }

  // ── End screen ───────────────────────────────────────────────
  if (screen === 'end') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-blue-50 flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full text-center"
        >
          <div className="text-6xl mb-6">🌟</div>
          <h1 className="text-4xl font-black text-gray-900 mb-3">You showed up.</h1>
          <p className="text-gray-500 text-lg leading-relaxed mb-8">
            The UPSC topper reads Laxmikant five times.
            You read once — aloud, actively, with your full voice.
            Science says that's the same thing.
          </p>
          <div className="flex flex-col gap-3">
            {user ? (
              <Button onClick={() => router.push('/dashboard')} size="lg" fullWidth>
                See your analytics →
              </Button>
            ) : (
              <Button onClick={() => router.push('/login')} size="lg" fullWidth>
                Save your progress →
              </Button>
            )}
            <Button
              onClick={() => { setPassageIndex(0); setCardIndex(0); setScreen('opening_cards'); }}
              variant="outline" size="lg" fullWidth
            >
              Start from the beginning
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return null;
}
