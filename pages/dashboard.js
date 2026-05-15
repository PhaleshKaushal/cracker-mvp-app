import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Tooltip } from 'recharts';
import { supabase } from '../lib/supabase';
import { WEAK_ARTICLE_THRESHOLD } from '../lib/constants';
import Nav from '../components/layout/Nav';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [sessions, setSessions] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [passages, setPassages] = useState([]);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      setUser(user);

      const [sessRes, ansRes, passRes] = await Promise.all([
        supabase.from('study_sessions').select('*').eq('user_id', user.id).order('started_at', { ascending: false }),
        supabase.from('answers').select('*, questions(question_text, correct_option), passages(title, article)').eq('user_id', user.id),
        supabase.from('passages').select('*').order('order_index', { ascending: true }),
      ]);

      setSessions(sessRes.data || []);
      setAnswers(ansRes.data || []);
      setPassages(passRes.data || []);
      setLoading(false);
    }
    load();
  }, [router]);

  // ── Derived stats ────────────────────────────────────────
  const completedPassages = new Set(
    sessions.filter(s => s.is_complete).map(s => s.passage_id)
  );

  // Per-passage accuracy
  const passageStats = passages.map(p => {
    const passAnswers = answers.filter(a => a.passage_id === p.id);
    const correct = passAnswers.filter(a => a.is_correct).length;
    const total = passAnswers.length;
    const accuracy = total > 0 ? correct / total : null;
    return { ...p, correct, total, accuracy };
  });

  const weakArticles = passageStats.filter(
    p => p.accuracy !== null && p.accuracy < WEAK_ARTICLE_THRESHOLD
  );

  const strongArticles = passageStats.filter(
    p => p.accuracy !== null && p.accuracy >= WEAK_ARTICLE_THRESHOLD
  );

  const totalCorrect = answers.filter(a => a.is_correct).length;
  const totalAnswered = answers.length;
  const overallPct = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;

  const totalReadTimeMins = Math.round(
    sessions.reduce((acc, s) => acc + (s.read_time_s || 0), 0) / 60
  );

  // Radar chart data
  const radarData = passageStats
    .filter(p => p.accuracy !== null)
    .map(p => ({
      article: p.article.length > 12 ? p.article.slice(0, 12) + '…' : p.article,
      score: Math.round((p.accuracy || 0) * 100),
    }));

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400 text-sm animate-pulse">Loading your dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Nav user={user} />

      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-black text-gray-900">Your analytics</h1>
          <p className="text-gray-400 text-sm mt-1">
            {user?.email} · Sports analytics for learning
          </p>
        </div>

        {/* Top stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Passages read', value: completedPassages.size, total: passages.length, color: 'text-pink-500' },
            { label: 'Overall accuracy', value: `${overallPct}%`, color: 'text-blue-500' },
            { label: 'Questions answered', value: totalAnswered, color: 'text-purple-500' },
            { label: 'Minutes read', value: totalReadTimeMins, color: 'text-teal-500' },
          ].map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
            >
              <Card>
                <p className="text-xs text-gray-400 font-medium mb-1">{stat.label}</p>
                <p className={`text-3xl font-black ${stat.color}`}>{stat.value}</p>
                {stat.total && (
                  <p className="text-xs text-gray-400 mt-0.5">of {stat.total}</p>
                )}
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Weak articles */}
          <Card>
            <h2 className="font-black text-gray-900 text-lg mb-4">
              Articles to revisit
              {weakArticles.length > 0 && (
                <Badge color="red" className="ml-2">{weakArticles.length}</Badge>
              )}
            </h2>
            {weakArticles.length === 0 ? (
              <p className="text-gray-400 text-sm">
                {completedPassages.size === 0
                  ? 'Complete some passages to see your weak spots.'
                  : '🎉 No weak articles. You\'re doing great.'}
              </p>
            ) : (
              <div className="space-y-3">
                {weakArticles.map(p => (
                  <div key={p.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{p.title}</p>
                      <p className="text-xs text-gray-400">{p.article}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-red-500">
                        {Math.round((p.accuracy || 0) * 100)}%
                      </span>
                      <p className="text-xs text-gray-400">{p.correct}/{p.total}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Strong articles */}
          <Card>
            <h2 className="font-black text-gray-900 text-lg mb-4">
              Strong articles
              {strongArticles.length > 0 && (
                <Badge color="green" className="ml-2">{strongArticles.length}</Badge>
              )}
            </h2>
            {strongArticles.length === 0 ? (
              <p className="text-gray-400 text-sm">Complete passages to see your strengths.</p>
            ) : (
              <div className="space-y-3">
                {strongArticles.map(p => (
                  <div key={p.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{p.title}</p>
                      <p className="text-xs text-gray-400">{p.article}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-green-500">
                        {Math.round((p.accuracy || 0) * 100)}%
                      </span>
                      <p className="text-xs text-gray-400">{p.correct}/{p.total}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Radar chart */}
        {radarData.length > 2 && (
          <Card className="mb-8">
            <h2 className="font-black text-gray-900 text-lg mb-6">Performance by Article</h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#F3F4F6" />
                  <PolarAngleAxis dataKey="article" tick={{ fontSize: 11, fill: '#6B7280' }} />
                  <Radar
                    name="Score"
                    dataKey="score"
                    stroke="#F472B6"
                    fill="#F472B6"
                    fillOpacity={0.2}
                  />
                  <Tooltip
                    formatter={(v) => [`${v}%`, 'Accuracy']}
                    contentStyle={{ borderRadius: 12, border: '1px solid #F3F4F6', fontSize: 12 }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {/* CTA */}
        <div className="text-center">
          <Button onClick={() => router.push('/study')} size="lg">
            Continue reading →
          </Button>
        </div>
      </div>
    </div>
  );
}
