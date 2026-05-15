// ============================================================
// CRACKER MVP — Seed Runner
// Run once: node seed/run.mjs
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { openingCards, passages, questions } from './data.js';

// Keys loaded from .env.local — never hardcode secrets in source files
const supabaseUrl         = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRole) {
  console.error('Missing env vars. Add to .env.local:\n  NEXT_PUBLIC_SUPABASE_URL\n  SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRole);

async function seed() {
  console.log('🌱 Starting seed...\n');

  // 1. Opening cards
  console.log('Inserting opening cards...');
  const { error: cardError } = await supabase.from('opening_cards').insert(openingCards);
  if (cardError) { console.error('Cards error:', cardError.message); process.exit(1); }
  console.log(`✅ ${openingCards.length} opening cards inserted`);

  // 2. Passages
  console.log('\nInserting passages...');
  const { data: insertedPassages, error: passageError } = await supabase
    .from('passages')
    .insert(passages)
    .select('id, order_index');
  if (passageError) { console.error('Passages error:', passageError.message); process.exit(1); }
  console.log(`✅ ${insertedPassages.length} passages inserted`);

  // Build order_index → id map
  const passageMap = {};
  insertedPassages.forEach(p => { passageMap[p.order_index] = p.id; });

  // 3. Questions — attach correct passage_id
  console.log('\nInserting questions...');
  const questionsWithIds = questions.map(({ passage_order_index, wrong_nudge, ...q }) => ({
    ...q,
    passage_id: passageMap[passage_order_index],
    explanation: wrong_nudge,
  }));

  const { error: questionError } = await supabase.from('questions').insert(questionsWithIds);
  if (questionError) { console.error('Questions error:', questionError.message); process.exit(1); }
  console.log(`✅ ${questionsWithIds.length} questions inserted`);

  console.log('\n🎉 Seed complete. Database is ready.');
}

seed();
