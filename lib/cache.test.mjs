import { InMemoryLRUCache } from './cache.js';

// Simple Assertion Helper
function assert(condition, message) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exit(1);
  }
}

async function runTests() {
  console.log('Running Caching Tests...');

  // Test 1: Basic Set and Get
  {
    console.log('Testing Basic Cache Set/Get...');
    const cache = new InMemoryLRUCache({ max: 5, ttl: 10000 });
    cache.set('key1', 'value1');
    assert(cache.get('key1') === 'value1', 'key1 should return value1');
    assert(cache.get('key2') === undefined, 'key2 should return undefined');
  }

  // Test 2: Invalidation
  {
    console.log('Testing Cache Invalidation...');
    const cache = new InMemoryLRUCache({ max: 5, ttl: 10000 });
    cache.set('key1', 'value1');
    assert(cache.get('key1') === 'value1', 'key1 should be present');
    cache.invalidate('key1');
    assert(cache.get('key1') === undefined, 'key1 should be undefined after invalidation');
  }

  // Test 3: TTL expiration
  {
    console.log('Testing Cache TTL Expiration...');
    const cache = new InMemoryLRUCache({ max: 5, ttl: 50 }); // 50ms TTL
    cache.set('key1', 'value1');
    assert(cache.get('key1') === 'value1', 'key1 should be present immediately');
    
    // Wait for 100ms (exceeding 50ms TTL)
    await new Promise(resolve => setTimeout(resolve, 100));
    assert(cache.get('key1') === undefined, 'key1 should be undefined/expired after TTL');
  }

  // Test 4: LRU Eviction (Simple capacity overflow)
  {
    console.log('Testing Cache LRU Eviction...');
    const cache = new InMemoryLRUCache({ max: 3, ttl: 10000 });
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.set('key3', 'value3');
    
    // Check that all 3 are present
    assert(cache.get('key1') === 'value1', 'key1 should be present');
    assert(cache.get('key2') === 'value2', 'key2 should be present');
    assert(cache.get('key3') === 'value3', 'key3 should be present');

    // Add a 4th key, which should evict key1 (the oldest insertion)
    cache.set('key4', 'value4');
    assert(cache.get('key1') === undefined, 'key1 should be evicted');
    assert(cache.get('key2') === 'value2', 'key2 should be present');
    assert(cache.get('key3') === 'value3', 'key3 should be present');
    assert(cache.get('key4') === 'value4', 'key4 should be present');
  }

  // Test 5: LRU Recency Refresh on Get
  {
    console.log('Testing Cache LRU Recency Refresh on Get...');
    const cache = new InMemoryLRUCache({ max: 3, ttl: 10000 });
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.set('key3', 'value3');

    // Access key1 to refresh its recency
    assert(cache.get('key1') === 'value1', 'key1 should be present');

    // Now key2 is the oldest (least recently used)
    // Adding key4 should evict key2, not key1
    cache.set('key4', 'value4');
    assert(cache.get('key2') === undefined, 'key2 should be evicted');
    assert(cache.get('key1') === 'value1', 'key1 should still be present');
    assert(cache.get('key3') === 'value3', 'key3 should still be present');
    assert(cache.get('key4') === 'value4', 'key4 should be present');
  }

  // Test 6: Clear Cache
  {
    console.log('Testing Cache Clear...');
    const cache = new InMemoryLRUCache({ max: 5, ttl: 10000 });
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.clear();
    assert(cache.get('key1') === undefined, 'key1 should be undefined after clear');
    assert(cache.get('key2') === undefined, 'key2 should be undefined after clear');
  }

  console.log('=== All Caching Tests Passed Successfully! ===');
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
