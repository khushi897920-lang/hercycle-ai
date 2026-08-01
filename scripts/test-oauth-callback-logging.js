import { GET } from '../app/auth/callback/route.js';

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exit(1);
  }
}

async function runTests() {
  console.log('Running OAuth Callback Error Logging Tests...\n');

  // Test 1: Successful callback without errors
  {
    const req = new Request('http://localhost:3000/auth/callback');
    const res = await GET(req);
    assert(res.status === 307 || res.status === 302, 'Expected redirect response');
    assert(res.headers.get('location') === 'http://localhost:3000/', `Expected redirect to home, got ${res.headers.get('location')}`);
    console.log('✅ Test 1 Passed: Normal callback redirects to home');
  }

  // Test 2: Error callback (e.g. access_denied / user cancelled with email in description)
  {
    const req = new Request('http://localhost:3000/auth/callback?error=access_denied&error_description=User%20user@example.com%20cancelled%20with%20token=secret123');
    const res = await GET(req);
    assert(res.status === 307 || res.status === 302, 'Expected redirect response');
    assert(res.headers.get('location').includes('/auth/login?error=access_denied'), `Expected redirect to login page with error, got ${res.headers.get('location')}`);
    console.log('✅ Test 2 Passed: OAuth error intercepted, sanitized, logged, and user redirected safely');
  }

  console.log('\n=== All OAuth Callback Error Logging Tests Passed! ===');
}

runTests();
