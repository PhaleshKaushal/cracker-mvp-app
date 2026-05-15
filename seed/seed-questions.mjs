// ============================================================
// Seeds ONLY questions — run this if passages already exist in DB
// node seed/seed-questions.mjs
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { questions } from './data.js';

const supabaseUrl         = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRole) {
  console.error('Missing env vars. Make sure .env.local has NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRole);

async function seedQuestions() {
  console.log('🌱 Seeding questions...\n');

  // 1. Fetch existing passages to build order_index → id map
  const { data: existingPassages, error: fetchErr } = await supabase
    .from('passages')
    .select('id, order_index')
    .order('order_index');

  if (fetchErr) { console.error('Failed to fetch passages:', fetchErr.message); process.exit(1); }
  if (!existingPassages?.length) { console.error('No passages found in DB. Run the full seed first.'); process.exit(1); }

  console.log(`Found ${existingPassages.length} passages.`);

  const passageMap = {};
  existingPassages.forEach(p => { passageMap[p.order_index] = p.id; });

  // 2. Delete existing questions to avoid duplicates
  console.log('Deleting existing questions...');
  const { error: deleteErr } = await supabase.from('questions').delete().neq('id', 0);
  if (deleteErr) { console.error('Delete error:', deleteErr.message); process.exit(1); }
  console.log('✅ Existing questions cleared');

  // 3. Map and insert questions
  const questionsWithIds = questions.map(({ passage_order_index, wrong_nudge, ...q }) => ({
    ...q,
    passage_id:  passageMap[passage_order_index],
    explanation: wrong_nudge,
  }));

  // Check all questions have a valid passage_id
  const missing = questionsWithIds.filter(q => !q.passage_id);
  if (missing.length) {
    console.error(`${missing.length} questions have no matching passage. Check passage_order_index values.`);
    console.error('Missing:', missing.map(q => q.question_text?.slice(0,40)));
    process.exit(1);
  }

  console.log(`\nInserting ${questionsWithIds.length} questions...`);
  const { error: insertErr } = await supabase.from('questions').insert(questionsWithIds);
  if (insertErr) { console.error('Insert error:', insertErr.message); process.exit(1); }

  console.log(`✅ ${questionsWithIds.length} questions inserted`);
  console.log('\n🎉 Done. Questions are live.');
}

seedQuestions();
