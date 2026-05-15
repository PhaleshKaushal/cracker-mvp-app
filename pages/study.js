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

// ── Screens ─────────────────────────────────────────────────
// opening_cards → reading → questions → passage_complete → end

export default function StudyPage() {
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [screen, setScreen] = useState('loading'); // loading | opening_cards | reading | questions | passage_complete | end

  const [openingCards, setOpeningCards] = useState([]);
  const [cardIndex, setCardIndex] = useState(0);

  const [passages, setPassages] = useState([]);
  const [passageIndex, setPassageIndex] = useState(0);
  const [currentPassage, setCurrentPassage] = useState(null);
  const [questions, setQuestions] = useState([]);

  const [sessionId, setSessionId] = useState(null);
  const [sessionStart, setSessionStart] = useState(null);
  const [answers, setAnswers] = useState([]); // { questionId, isCorrect, attemptNumber }

  // ── Auth check ───────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data?.user ?? null));
  }, []);

  // ── Load opening cards + passages ───────────────────────
  useEffect(() => {
    async function load() {
      // Fetch 2 random opening cards
      const { data: cards } = await supabase
        .from('opening_cards')
        .select('*')
        .limit(20);

      if (cards && cards.length) {
        const shuffled = [...cards].sort(() => Math.random() - 0.5);
        setOpeningCards(shuffled.slice(0, OPENING_CARDS_PER_SESSION));
      }

      // Fetch all passages in order
      const { data: passageData } = await supabase
        .from('passages')
        .select('*')
        .order('order_index', { ascending: true });

      if (passageData) {
        setPassages(passageData);
        setCurrentPassage(passageData[0]);
      }

      setScreen('opening_cards');
    }

    load();
  }, []);

  // ── Opening card navigation ──────────────────────────────
  function handleCardNext() {
    if (cardIndex < openingCards.length - 1) {
      setCardIndex(prev => prev + 1);
    } else {
      startReading();
    }
  }

  // ── Start reading a passage ──────────────────────────────
  async function startReading() {
    const passage = passages[passageIndex];
    setCurrentPassage(passage);

    // Create study session
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

  // ── Reading complete → load questions ───────────────────
  async function handleReadingComplete() {
    const passage = passages[passageIndex];
    if (!passage) return;

    // Update session read time
    if (sessionId && sessionStart) {
      const readTimeSec = Math.round((Date.now() - sessionStart) / 1000);
      await supabase
        .from('study_sessions')
        .update({ read_time_s: readTimeSec })
        .eq('id', sessionId);
    }

    // Fetch questions for this passage
    const { data: qs } = await supabase
      .from('questions')
      .select('*')
      .eq('passage_id', passage.id)
      .order('order_index', { ascending: true });

    setQuestions(qs || []);
    setAnswers([]);
    setScreen('questions');
  }

  // ── Save an answer ───────────────────────────────────────
  const handleAnswer = useCallback(async ({ questionId, selectedOption, isCorrect, attemptNumber }) => {
    const passage = passages[passageIndex];
    if (!passage) return;

    // Silently track in background
    if (user && sessionId) {
      await supabase.from('answers').insert({
        session_id: sessionId,
        user_id: user.id,
        question_id: questionId,
        passage_id: passage.id,
        selected_option: selectedOption,
        is_correct: isCorrect,
        attempt_number: attemptNumber,
      });
    }

    setAnswers(prev => [...prev, { questionId, isCorrect, attemptNumber }]);
  }, [user, sessionId, passageIndex, passages]);

  // ── All questions answered → passage complete ────────────
  function handleAllAnswered() {
    // Check if all questions have a logged answer
    if (answers.length >= questions.length) {
      completePassage();
    }
  }

  async function completePassage() {
    // Mark session complete
    if (sessionId) {
      await supabase
        .from('study_sessions')
        .update({ is_complete: true, completed_at: new Date().toISOString() })
        .eq('id', sessionId);
    }
    setScreen('passage_complete');
  }

  // ── Next passage or end ──────────────────────────────────
  function handleNextPassage() {
    const next = passageIndex + 1;
    if (next < passages.length) {
      setPassageIndex(next);
      setCurrentPassage(passages[next]);
      setSessionId(null);
      startReadingPassage(passages[next]);
    } else {
      setScreen('end');
    }
  }

  async function startReadingPassage(passage) {
    let sid = null;
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

  // ── Passage complete score ───────────────────────────────
  const passageScore = questions.length > 0
    ? answers.filter(a => a.isCorrect).length / questions.length
    : 0;

  const isWeak = passageScore < WEAK_ARTICLE_THRESHOLD;

  // ── Prompt sign-up after first session ──────────────────
  const showSignUpPrompt = !user && screen === 'passage_complete';

  // ─────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────

  if (screen === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-3xl mb-3 animate-pulse">📖</div>
          <p className="text-gray-400 text-sm">Loading your session...</p>
        </div>
      </div>
    );
  }

  // Opening cards (no nav)
  if (screen === 'opening_cards' && openingCards.length > 0) {
    return (
      <OpeningCard
        card={openingCards[cardIndex]}
        cardIndex={cardIndex}
        totalCards={openingCards.length}
        onNext={handleCardNext}
      />
    );
  }

  // Reading screen
  if (screen === 'reading' && currentPassage) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Nav user={user} />
        <div className="max-w-3xl mx-auto px-6 py-8">
          {/* Passage header */}
          <div className="mb-6">
            <span className="text-xs font-semibold text-pink-500 uppercase tracking-wider">
              {currentPassage.article}
            </span>
            <h1 className="text-2xl font-black text-gray-900 mt-1">
              {currentPassage.title}
            </h1>
            <p className="text-xs text-gray-400 mt-1">
              Passage {passageIndex + 1} of {passages.length} · Read aloud to continue
            </p>
          </div>

          <KaraokeReader
            passage={currentPassage.content}
            onComplete={handleReadingComplete}
          />

          {/* Manual "Done reading" fallback */}
          <div className="mt-6 text-center">
            <button
              onClick={handleReadingComplete}
              className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2 transition-colors"
            >
              Skip to questions
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Questions screen
  if (screen === 'questions') {
    const answeredCount = answers.length;
    const allDone = answeredCount >= questions.length && questions.length > 0;

    return (
      <div className="min-h-screen bg-gray-50">
        <Nav user={user} />
        <div className="max-w-2xl mx-auto px-6 py-8">
          <div className="mb-6">
            <span className="text-xs font-semibold text-blue-500 uppercase tracking-wider">
              {currentPassage?.article}
            </span>
            <h1 className="text-2xl font-black text-gray-900 mt-1">
              Test your understanding
            </h1>
            <p className="text-xs text-gray-400 mt-1">
              {answeredCount} of {questions.length} answered
            </p>
          </div>

          <div className="space-y-6">
            {questions.map((q, i) => (
              <QuestionCard
                key={q.id}
                question={q}
                questionNumber={i + 1}
                totalQuestions={questions.length}
                onAnswer={(ans) => {
                  handleAnswer(ans);
                  // If this was the last question, complete
                  if (i === questions.length - 1) {
                    setTimeout(completePassage, 600);
                  }
                }}
              />
            ))}
          </div>

          {allDone && (
            <div className="mt-6 text-center">
              <Button onClick={completePassage} size="lg">
                See results →
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Passage complete screen
  if (screen === 'passage_complete') {
    const correct = answers.filter(a => a.isCorrect).length;
    const total = questions.length;

    return (
      <div className="min-h-screen bg-gray-50">
        <Nav user={user} />
        <div className="max-w-lg mx-auto px-6 py-12 text-center">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
            <div className="text-5xl mb-4">{isWeak ? '💪' : '🔥'}</div>
            <h2 className="text-3xl font-black text-gray-900 mb-2">
              {currentPassage?.title}
            </h2>
            <p className="text-gray-500 text-sm mb-8">{currentPassage?.article}</p>

            {/* Score */}
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm mb-6">
              <div className="text-5xl font-black bg-gradient-to-r from-pink-400 to-blue-400 bg-clip-text text-transparent mb-1">
                {correct}/{total}
              </div>
              <p className="text-gray-500 text-sm">
                {isWeak
                  ? 'This article needs more work — we\'ll remind you to revisit it.'
                  : 'Solid. Your brain is building the highway.'}
              </p>
            </div>

            {/* Sign up prompt for guests */}
            {showSignUpPrompt && (
              <div className="bg-gradient-to-r from-pink-50 to-blue-50 border border-pink-100 rounded-2xl p-6 mb-6 text-left">
                <h3 className="font-bold text-gray-900 mb-1">Save your progress</h3>
                <p className="text-gray-500 text-sm mb-4">
                  Sign in with a magic link to track your weak articles and see your improvement over time.
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

  // End screen
  if (screen === 'end') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-blue-50 flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full text-center"
        >
          <div className="text-6xl mb-6">🌟</div>
          <h1 className="text-4xl font-black text-gray-900 mb-3">
            You showed up.
          </h1>
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
            <Button onClick={() => { setPassageIndex(0); setScreen('opening_cards'); setCardIndex(0); }} variant="outline" size="lg" fullWidth>
              Start from the beginning
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return null;
}
