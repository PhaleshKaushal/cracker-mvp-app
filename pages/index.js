import { motion } from 'framer-motion';
import Link from 'next/link';
import Nav from '../components/layout/Nav';

const stats = [
  { number: '87%', label: 'words retained reading aloud vs 70% silent' },
  { number: '3×', label: 'brain regions active when you speak' },
  { number: '1×', label: 'aloud read = 3 silent reads (neuroscience)' },
];

const steps = [
  { icon: '🧠', title: 'Two warm-up cards', body: 'Science-backed facts about why reading aloud works. 30 seconds. Sets your brain up.' },
  { icon: '🎤', title: 'Read aloud — karaoke style', body: 'Constitutional law passages highlight word by word as you speak. Your voice is tracked. No cheating your brain.' },
  { icon: '📝', title: 'Answer MCQs', body: '2 attempts per question. Wrong answers get explained. Right answers get reinforced. Every session builds the map.' },
  { icon: '📊', title: 'See your weak spots', body: 'Your dashboard shows exactly which Articles need more work. Study smarter, not harder.' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <Nav />

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-20 pb-24 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Pill */}
          <span className="inline-flex items-center gap-1.5 bg-pink-50 text-pink-600 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
            🏏 Sports analytics for learning
          </span>

          <h1 className="text-5xl sm:text-6xl font-black text-gray-900 leading-tight mb-6">
            Read the Constitution.{' '}
            <span className="bg-gradient-to-r from-pink-400 to-blue-400 bg-clip-text text-transparent">
              Out loud.
            </span>
          </h1>

          <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
            UPSC Fundamental Rights — karaoke style. Your voice keeps your brain engaged.
            Science says one aloud read beats three silent ones.
            We track the data. You see the gains.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/study"
              className="inline-flex items-center justify-center gap-2 bg-pink-400 hover:bg-pink-500 text-white font-bold px-8 py-4 rounded-xl text-base transition-colors shadow-sm"
            >
              Start Reading — it's free →
            </Link>
            <Link
              href="/how-it-works"
              className="inline-flex items-center justify-center gap-2 border-2 border-gray-200 text-gray-600 hover:border-gray-300 font-semibold px-8 py-4 rounded-xl text-base transition-colors"
            >
              How it works
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Stats strip */}
      <section className="bg-gradient-to-r from-pink-50 to-blue-50 py-12">
        <div className="max-w-4xl mx-auto px-6 grid grid-cols-1 sm:grid-cols-3 gap-8">
          {stats.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * i }}
              className="text-center"
            >
              <div className="text-4xl font-black bg-gradient-to-r from-pink-400 to-blue-400 bg-clip-text text-transparent mb-1">
                {s.number}
              </div>
              <div className="text-sm text-gray-500">{s.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-5xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-black text-gray-900 mb-3">
            How Cracker works
          </h2>
          <p className="text-gray-500 text-lg">Four steps. Built on neuroscience.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {steps.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * i }}
              className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm"
            >
              <div className="text-3xl mb-3">{step.icon}</div>
              <h3 className="font-bold text-gray-900 text-lg mb-2">{step.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{step.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-br from-pink-400 to-blue-400 py-20">
        <div className="max-w-3xl mx-auto px-6 text-center text-white">
          <h2 className="text-4xl font-black mb-4">
            Your voice is your best highlighter.
          </h2>
          <p className="text-white/80 text-lg mb-8">
            No signup needed. Just open your mouth and start.
          </p>
          <Link
            href="/study"
            className="inline-flex items-center justify-center bg-white text-pink-500 font-bold px-8 py-4 rounded-xl text-base hover:bg-pink-50 transition-colors shadow-sm"
          >
            Start reading now →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 text-center text-sm text-gray-400">
        <p>Cracker · Sports analytics for learning · Built for UPSC aspirants</p>
        <div className="flex justify-center gap-4 mt-2">
          <Link href="/about" className="hover:text-gray-600 transition-colors">About</Link>
          <Link href="/how-it-works" className="hover:text-gray-600 transition-colors">How it works</Link>
        </div>
      </footer>
    </div>
  );
}
