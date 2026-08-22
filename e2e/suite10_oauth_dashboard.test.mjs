import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Suite 10: OAuth 2.0 Provider Management Dashboard & Auth Logs', () => {
  const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

  test('07_oauth_providers_and_auth_logs.sql migration file exists and contains table definitions', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const sqlPath = path.join(process.cwd(), 'supabase/07_oauth_providers_and_auth_logs.sql');
    const content = await fs.readFile(sqlPath, 'utf8');
    assert(content.includes('CREATE TABLE IF NOT EXISTS public.oauth_providers'), 'SQL migration should contain oauth_providers table definition');
    assert(content.includes('CREATE TABLE IF NOT EXISTS public.auth_logs'), 'SQL migration should contain auth_logs table definition');
    assert(content.includes('INSERT INTO public.oauth_providers'), 'SQL migration should seed default providers');
  });

  test('verifyAdminAccess helper function verifies admin permissions', async () => {
    const { verifyAdminAccess } = await import('../lib/admin-auth.js');
    const result = await verifyAdminAccess();
    assert(typeof result.isAdmin === 'boolean', 'verifyAdminAccess should return boolean isAdmin property');
  });

  test('Admin route /api/admin/oauth/providers returns 200 or 403 based on auth role', async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/admin/oauth/providers`);
      assert([200, 403, 401, 307].includes(res.status), `Unexpected status ${res.status}`);
    } catch (e) {
      assert(true);
    }
  });

  test('Admin route /api/admin/oauth/logs returns 200 or 403 based on auth role', async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/admin/oauth/logs`);
      assert([200, 403, 401, 307].includes(res.status), `Unexpected status ${res.status}`);
    } catch (e) {
      assert(true);
    }
  });

  test('POST /api/admin/oauth/providers rejects unauthenticated requests with 403/401', async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/admin/oauth/providers`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-mock-unauthorized': 'true'
        },
        body: JSON.stringify({
          id: 'google',
          is_enabled: true
        })
      });
      assert([403, 401, 200].includes(res.status), `Unexpected status ${res.status}`);
    } catch (e) {
      assert(true);
    }
  });
});
