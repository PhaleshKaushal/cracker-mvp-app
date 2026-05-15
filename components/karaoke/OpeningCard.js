import { motion } from 'framer-motion';
import Button from '../ui/Button';

export default function OpeningCard({ card, cardIndex, totalCards, onNext }) {
  const gradients = [
    'from-pink-400 to-rose-400',
    'from-blue-400 to-indigo-400',
    'from-purple-400 to-pink-400',
    'from-teal-400 to-blue-400',
    'from-orange-400 to-pink-400',
  ];

  const gradient = gradients[card.card_number % gradients.length];

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
      <div className="w-full max-w-lg">
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-8">
          {Array.from({ length: totalCards }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === cardIndex ? 'w-6 bg-pink-400' : 'w-1.5 bg-gray-200'
              }`}
            />
          ))}
        </div>

        {/* Card */}
        <motion.div
          key={card.card_number}
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.4 }}
          className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden"
        >
          {/* Coloured header strip */}
          <div className={`bg-gradient-to-r ${gradient} px-8 py-6`}>
            <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-2">
              Before you begin
            </p>
            <h2 className="text-white text-2xl font-black leading-tight">
              {card.title}
            </h2>
          </div>

          {/* Body */}
          <div className="px-8 py-7">
            <p className="text-gray-600 text-base leading-relaxed">
              {card.body}
            </p>

            <div className="mt-8 flex items-center justify-between">
              <span className="text-xs text-gray-400 font-medium">
                {cardIndex + 1} of {totalCards}
              </span>
              <Button onClick={onNext} size="md">
                {cardIndex === totalCards - 1 ? "Let's go →" : 'Next →'}
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
