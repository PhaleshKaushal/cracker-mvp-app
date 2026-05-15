import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data: passages } = await supabase.from('passages').select('id, order_index, title').order('order_index');
console.log('\nPASSAGES:');
passages?.slice(0,5).forEach(p => console.log(`  id=${p.id} order=${p.order_index} "${p.title?.slice(0,35)}"`));
console.log(`  total: ${passages?.length}`);

const { data: questions } = await supabase.from('questions').select('id, passage_id').order('passage_id');
console.log('\nQUESTIONS:');
const qByPassage = {};
questions?.forEach(q => { qByPassage[q.passage_id] = (qByPassage[q.passage_id]||0)+1; });
console.log('  questions per passage_id:', qByPassage);
console.log(`  total: ${questions?.length}`);

// Find mismatches
const passageIds = new Set(passages?.map(p => p.id));
const orphaned = Object.keys(qByPassage).filter(id => !passageIds.has(Number(id)));
console.log('\n  Orphaned passage_ids (questions with no matching passage):', orphaned.length ? orphaned : 'none ✅');

// Duplicates
const orderCounts = {};
passages?.forEach(p => { orderCounts[p.order_index] = (orderCounts[p.order_index]||0)+1; });
const dupes = Object.entries(orderCounts).filter(([,c])=>c>1);
console.log('  Duplicate order_indexes:', dupes.length ? dupes : 'none ✅');
