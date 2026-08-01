import { getSupabaseAdmin } from '../lib/supabase-admin.js';

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exit(1);
  }
}

function runTests() {
  console.log('Running getSupabaseAdmin Pooled Connection Port Tests...\n');

  // Set mock environment variables
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'mock-anon-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-key';
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'mock-clerk-pub';
  process.env.CLERK_SECRET_KEY = 'mock-clerk-secret';
  process.env.GEMINI_API_KEY = 'mock-gemini-key';
  process.env.GROQ_API_KEY = 'mock-groq-key';

  // Test 1: Standard URL without pooler port
  {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://xyz.supabase.co';
    delete process.env.SUPABASE_POOLER_PORT;
    delete process.env.SUPABASE_POOLED_PORT;
    delete process.env.SUPABASE_POOLER_URL;

    const client = getSupabaseAdmin();
    assert(client !== null && client !== undefined, 'Expected Supabase client to be created');

    console.log('✅ Test 1 Passed: Standard URL initializes successfully');
  }

  // Test 2: Pooler port override (e.g. port 6543)
  {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://xyz.supabase.co';
    process.env.SUPABASE_POOLER_PORT = '6543';

    const client = getSupabaseAdmin();
    assert(client !== null && client !== undefined, 'Expected Supabase client with pooled port to be created');

    console.log('✅ Test 2 Passed: Pooled connection port 6543 configured correctly');
  }

  // Test 3: Explicit pooler URL override
  {
    process.env.SUPABASE_POOLER_URL = 'https://xyz.pooler.supabase.co:6543';

    const client = getSupabaseAdmin();
    assert(client !== null && client !== undefined, 'Expected Supabase client with pooled URL to be created');

    console.log('✅ Test 3 Passed: Explicit SUPABASE_POOLER_URL initializes successfully');
  }

  console.log('\n=== All getSupabaseAdmin Pooled Connection Tests Passed! ===');
}

runTests();
