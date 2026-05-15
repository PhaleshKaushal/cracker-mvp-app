import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';
import Nav from '../components/layout/Nav';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'phalesh.kaushal@gmail.com';

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState('');
  const [pwError, setPwError] = useState('');
  const [loading, setLoading] = useState(true);

  const [sessions, setSessions] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [passages, setPassages] = useState([]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data?.user ?? null);
      setLoading(false);
    });
  }, []);

  function handlePasswordSubmit(e) {
    e.preventDefault();
    if (password === 'cracker2025') {
      setAuthed(true);
      loadData();
    } else {
      setPwError('Incorrect password.');
    }
  }

  async function loadData() {
    const [sessRes, ansRes, profRes, passRes] = await Promise.all([
      supabase.from('study_sessions').select('*').order('started_at', { ascending: false }),
      supabase.from('answers').select('*, questions(question_text, correct_option), passages(title, article)'),
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('passages').select('*').order('order_index', { ascending: true }),
    ]);

    setSessions(sessRes.data || []);
    setAnswers(ansRes.data || []);
    setProfiles(profRes.data || []);
    setPassages(passRes.data || []);
  }

  // ── Derived stats ──────────────────────────────────────────
  const totalUsers = profiles.length;
  const totalSessions = sessions.length;
  const completedSessions = sessions.filter(s => s.is_complete).length;
  const totalAnswers = answers.length;
  const correctAnswers = answers.filter(a => a.is_correct).length;
  const overallAccuracy = totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0;

  // Most missed questions
  const questionMissCount = {};
  answers.filter(a => !a.is_correct).forEach(a => {
    const key = a.question_id;
    if (!questionMissCount[key]) questionMissCount[key] = { count: 0, text: a.questions?.question_text };
    questionMissCount[key].count++;
  });
  const missedQuestions = Object.entries(questionMissCount)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5);

  // Per-passage completion
  const passageCompletion = passages.map(p => {
    const passAnswers = answers.filter(a => a.passage_id === p.id);
    const correct = passAnswers.filter(a => a.is_correct).length;
    const total = passAnswers.length;
    const completedCount = sessions.filter(s => s.passage_id === p.id && s.is_complete).length;
    return { ...p, correct, total, completedCount, accuracy: total > 0 ? Math.round((correct / total) * 100) : null };
  });

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-400 text-sm">Loading...</p></div>;
  }

  // Password gate
  if (!authed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <div className="text-center mb-6">
            <span className="text-2xl font-black bg-gradient-to-r from-pink-400 to-blue-400 bg-clip-text text-transparent">
              Cracker Admin
            </span>
          </div>
          <Card>
            <h1 className="font-black text-gray-900 text-xl mb-4">Enter admin password</h1>
            <form onSubmit={handlePasswordSubmit} className="space-y-3">
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
              />
              {pwError && <p className="text-red-500 text-xs">{pwError}</p>}
              <button
                type="submit"
                className="w-full bg-pink-400 hover:bg-pink-500 text-white font-bold py-3 rounded-xl text-sm transition-colors"
              >
                Enter
              </button>
            </form>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Nav user={user} />

      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-gray-900">Admin panel</h1>
          <p className="text-gray-400 text-sm mt-1">Cracker · Internal analytics</p>
        </div>

        {/* Top stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total users', value: totalUsers, color: 'text-pink-500' },
            { label: 'Total sessions', value: totalSessions, color: 'text-blue-500' },
            { label: 'Completed sessions', value: completedSessions, color: 'text-green-500' },
            { label: 'Overall accuracy', value: `${overallAccuracy}%`, color: 'text-purple-500' },
          ].map((stat, i) => (
            <Card key={i}>
              <p className="text-xs text-gray-400 font-medium mb-1">{stat.label}</p>
              <p className={`text-3xl font-black ${stat.color}`}>{stat.value}</p>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Most missed questions */}
          <Card>
            <h2 className="font-black text-gray-900 text-lg mb-4">Most missed questions</h2>
            {missedQuestions.length === 0 ? (
              <p className="text-gray-400 text-sm">No data yet.</p>
            ) : (
              <div className="space-y-3">
                {missedQuestions.map(([id, data], i) => (
                  <div key={id} className="flex items-start gap-3">
                    <span className="text-xs font-bold text-gray-400 mt-0.5 w-5">{i + 1}.</span>
                    <div className="flex-1">
                      <p className="text-sm text-gray-700 leading-snug">{data.text || 'Unknown question'}</p>
                    </div>
                    <Badge color="red">{data.count}×</Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Passage completion */}
          <Card>
            <h2 className="font-black text-gray-900 text-lg mb-4">Passage performance</h2>
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {passageCompletion.map(p => (
                <div key={p.id} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-700 truncate">{p.title}</p>
                    <p className="text-xs text-gray-400">{p.article}</p>
                  </div>
                  <div className="text-right shrink-0">
                    {p.accuracy !== null ? (
                      <span className={`text-xs font-bold ${p.accuracy >= 70 ? 'text-green-500' : 'text-red-500'}`}>
                        {p.accuracy}%
                      </span>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                    <p className="text-xs text-gray-400">{p.completedCount} done</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Recent users */}
        <Card>
          <h2 className="font-black text-gray-900 text-lg mb-4">Recent users</h2>
          {profiles.length === 0 ? (
            <p className="text-gray-400 text-sm">No signed-up users yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-400 font-semibold border-b border-gray-100">
                    <th className="pb-2 pr-6">Email</th>
                    <th className="pb-2 pr-6">Joined</th>
                    <th className="pb-2">Sessions</th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.slice(0, 20).map(p => {
                    const userSessions = sessions.filter(s => s.user_id === p.id);
                    return (
                      <tr key={p.id} className="border-b border-gray-50 last:border-0">
                        <td className="py-2.5 pr-6 text-gray-700">{p.email}</td>
                        <td className="py-2.5 pr-6 text-gray-400 text-xs">
                          {new Date(p.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-2.5 text-gray-500">{userSessions.length}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
