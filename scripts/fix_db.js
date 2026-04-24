const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in environment variables.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  console.log('Fetching first user...')
  const { data: users, error: userError } = await supabase.auth.admin.listUsers()
  if (userError || !users?.users?.length) {
    console.error('Failed to fetch user:', userError)
    return
  }
  const userId = users.users[0].id
  console.log('Using userId:', userId)

  console.log('Deleting test row...')
  const { error: delError } = await supabase
    .from('cycles')
    .delete()
    .eq('cycle_length', 28)
    .eq('start_date', '2026-03-10')

  if (delError) {
    console.error('Error deleting:', delError)
  } else {
    console.log('Test row deleted.')
  }

  console.log('Inserting seed cycles...')
  const seeds = [
    { user_id: userId, start_date: '2025-11-01', end_date: '2025-11-06', cycle_length: 28 },
    { user_id: userId, start_date: '2025-11-29', end_date: '2025-12-04', cycle_length: 28 },
    { user_id: userId, start_date: '2025-12-27', end_date: '2026-01-01', cycle_length: 28 },
    { user_id: userId, start_date: '2026-01-24', end_date: '2026-01-29', cycle_length: 28 },
    { user_id: userId, start_date: '2026-02-21', end_date: '2026-02-26', cycle_length: 28 },
    { user_id: userId, start_date: '2026-03-21', end_date: '2026-03-26', cycle_length: 28 }
  ]

  const { data: insData, error: insError } = await supabase
    .from('cycles')
    .insert(seeds)
    .select()

  if (insError) {
    console.error('Error inserting:', insError)
  } else {
    console.log('Seed cycles inserted successfully:', insData.length)
  }
}

run()
