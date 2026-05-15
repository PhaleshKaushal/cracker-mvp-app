import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { motion } from 'framer-motion';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: `${window.location.origin}/study`,
      },
    });

    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-blue-50 flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <span className="text-2xl font-black bg-gradient-to-r from-pink-400 to-blue-400 bg-clip-text text-transparent">
              Cracker
            </span>
          </Link>
          <p className="text-gray-500 text-sm mt-1">Sports analytics for learning</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
          {!sent ? (
            <>
              <h1 className="text-2xl font-black text-gray-900 mb-1">Sign in</h1>
              <p className="text-gray-500 text-sm mb-6">
                We'll send a magic link to your email. No password needed.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Email address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300 focus:border-transparent transition"
                  />
                </div>

                {error && (
                  <p className="text-red-500 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading || !email}
                  className="w-full bg-pink-400 hover:bg-pink-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl text-sm transition-colors"
                >
                  {loading ? 'Sending...' : 'Send magic link →'}
                </button>
              </form>

              <p className="text-center text-xs text-gray-400 mt-5">
                No account needed — we create one automatically.
              </p>
            </>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-4"
            >
              <div className="text-4xl mb-4">📬</div>
              <h2 className="text-xl font-black text-gray-900 mb-2">Check your inbox</h2>
              <p className="text-gray-500 text-sm leading-relaxed">
                We sent a magic link to{' '}
                <span className="font-semibold text-gray-700">{email}</span>.
                <br />
                Click it to sign in and continue reading.
              </p>
              <button
                onClick={() => { setSent(false); setEmail(''); }}
                className="mt-6 text-sm text-pink-500 hover:text-pink-600 font-medium"
              >
                Use a different email
              </button>
            </motion.div>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          <Link href="/study" className="hover:text-gray-600">
            Continue without signing in →
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
