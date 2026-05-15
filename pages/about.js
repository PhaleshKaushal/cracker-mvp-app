import Nav from '../components/layout/Nav';
import { motion } from 'framer-motion';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Nav />
      <div className="max-w-lg mx-auto px-6 py-24 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-5xl mb-6">🌱</div>
          <h1 className="text-3xl font-black text-gray-900 mb-3">About Cracker</h1>
          <div className="bg-white border border-gray-100 rounded-2xl p-8 shadow-sm">
            <p className="text-4xl font-black bg-gradient-to-r from-pink-400 to-blue-400 bg-clip-text text-transparent mb-3">
              We will tell you soon!
            </p>
            <p className="text-gray-400 text-sm leading-relaxed">
              Something meaningful is being written here. Check back soon.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
