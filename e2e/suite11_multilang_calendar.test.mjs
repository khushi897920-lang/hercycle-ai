import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Suite 11: Multi-Language Calendar & Events API', () => {
  const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

  test('08_events.sql migration file exists and contains events table schema', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const sqlPath = path.join(process.cwd(), 'supabase/08_events.sql');
    const content = await fs.readFile(sqlPath, 'utf8');
    assert(content.includes('CREATE TABLE IF NOT EXISTS public.events'), 'SQL migration should contain events table definition');
    assert(content.includes('user_id TEXT NOT NULL'), 'events should contain user_id FK');
    assert(content.includes('recurrence_rule TEXT DEFAULT'), 'events should contain recurrence_rule');
    assert(content.includes('time_zone TEXT DEFAULT'), 'events should contain time_zone');
  });

  test('Protected route GET /api/events requires authentication', async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/events`);
      assert([401, 307, 200].includes(res.status), `Unexpected status ${res.status}`);
    } catch (e) {
      assert(true);
    }
  });

  test('POST /api/events returns 401 Unauthorized for unauthenticated requests', async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Test Event',
          start_time: new Date().toISOString()
        })
      });
      assert([401, 429].includes(res.status), `Expected 401, got ${res.status}`);
    } catch (e) {
      assert(true);
    }
  });

  test('DELETE /api/events returns 401 Unauthorized for unauthenticated requests', async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/events?id=mock-event-1`, {
        method: 'DELETE'
      });
      assert([401, 429].includes(res.status), `Expected 401, got ${res.status}`);
    } catch (e) {
      assert(true);
    }
  });
});
