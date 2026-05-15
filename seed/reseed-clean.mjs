// Full clean reseed — wipes and reloads everything
import { createClient } from '@supabase/supabase-js';
import { openingCards, passages, questions } from './data.js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🧹 Cleaning DB...');

// Delete in order (FK constraints)
await supabase.from('answers').delete().neq('id', 0);
await supabase.from('study_sessions').delete().neq('id', 0);
await supabase.from('questions').delete().neq('id', 0);
await supabase.from('passages').delete().neq('id', 0);
await supabase.from('opening_cards').delete().neq('id', 0);
console.log('✅ All tables cleared\n');

// Opening cards
const { error: e1 } = await supabase.from('opening_cards').insert(openingCards);
if (e1) { console.error('Cards:', e1.message); process.exit(1); }
console.log(`✅ ${openingCards.length} opening cards`);

// Passages
const { data: insertedPassages, error: e2 } = await supabase
  .from('passages').insert(passages).select('id, order_index');
if (e2) { console.error('Passages:', e2.message); process.exit(1); }
console.log(`✅ ${insertedPassages.length} passages`);

// Build map
const passageMap = {};
insertedPassages.forEach(p => { passageMap[p.order_index] = p.id; });

// Questions
const qs = questions.map(({ passage_order_index, wrong_nudge, ...q }) => ({
  ...q,
  passage_id:  passageMap[passage_order_index],
  explanation: wrong_nudge,
}));
const { error: e3 } = await supabase.from('questions').insert(qs);
if (e3) { console.error('Questions:', e3.message); process.exit(1); }
console.log(`✅ ${qs.length} questions`);

console.log('\n🎉 Clean reseed done.');
