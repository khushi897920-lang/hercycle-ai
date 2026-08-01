import { EventBus } from './events.js';

// Simple Assertion Helper
function assert(condition, message) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exit(1);
  }
}

async function runTests() {
  console.log('Running EventBus Tests...');

  // Test 1: Basic Subscribe and Publish
  {
    console.log('Testing Basic Event on/emit...');
    const bus = new EventBus();
    let receivedData = null;
    
    bus.on('test-event', (data) => {
      receivedData = data;
    });

    await bus.emit('test-event', { foo: 'bar' });
    assert(receivedData !== null, 'Listener should have received the event');
    assert(receivedData.foo === 'bar', 'Event payload should match');
  }

  // Test 2: Unsubscribe (off)
  {
    console.log('Testing Event off (Unsubscribe)...');
    const bus = new EventBus();
    let callCount = 0;
    
    const unsubscribe = bus.on('test-event', () => {
      callCount++;
    });

    await bus.emit('test-event');
    assert(callCount === 1, 'Should call listener once');

    unsubscribe(); // Unsubscribe via returned function
    await bus.emit('test-event');
    assert(callCount === 1, 'Should not call listener after unsubscribing');

    // Test explicit bus.off
    callCount = 0;
    const listener = () => { callCount++; };
    bus.on('test-event', listener);
    await bus.emit('test-event');
    assert(callCount === 1, 'Should call listener');
    
    bus.off('test-event', listener);
    await bus.emit('test-event');
    assert(callCount === 1, 'Should not call listener after explicit off()');
  }

  // Test 3: Wildcard Listeners
  {
    console.log('Testing Wildcard "*" Listeners...');
    const bus = new EventBus();
    const receivedEvents = [];

    bus.on('*', (data, event) => {
      receivedEvents.push({ event, data });
    });

    await bus.emit('event-a', 'payload-a');
    await bus.emit('event-b', 'payload-b');

    assert(receivedEvents.length === 2, 'Wildcard listener should receive all events');
    assert(receivedEvents[0].event === 'event-a' && receivedEvents[0].data === 'payload-a', 'First event details should match');
    assert(receivedEvents[1].event === 'event-b' && receivedEvents[1].data === 'payload-b', 'Second event details should match');
  }

  // Test 4: Error isolation
  {
    console.log('Testing Error Isolation...');
    const bus = new EventBus();
    let secondListenerCalled = false;

    // First listener throws an error
    bus.on('test-event', () => {
      throw new Error('Some listener failure');
    });

    // Second listener should still run
    bus.on('test-event', () => {
      secondListenerCalled = true;
    });

    // Verify it doesn't crash the emit call
    await bus.emit('test-event');
    assert(secondListenerCalled === true, 'Second listener should still be called even if the first throws an error');
  }

  // Test 5: Asynchronous Execution
  {
    console.log('Testing Asynchronous/Concurrent Execution...');
    const bus = new EventBus();
    const executionOrder = [];

    bus.on('async-event', async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
      executionOrder.push('listener-1');
    });

    bus.on('async-event', async () => {
      executionOrder.push('listener-2');
    });

    const start = Date.now();
    await bus.emit('async-event');
    const elapsed = Date.now() - start;

    assert(executionOrder.includes('listener-1') && executionOrder.includes('listener-2'), 'Both listeners should execute');
    // Because listener-1 waits 50ms, but listener-2 finishes immediately, listener-2 executes first
    assert(executionOrder[0] === 'listener-2', 'listener-2 should execute first because it is synchronous');
    assert(executionOrder[1] === 'listener-1', 'listener-1 should execute second after timeout');
    assert(elapsed >= 45, 'Emit should wait for async listeners to complete');
  }

  console.log('=== All EventBus Tests Passed Successfully! ===');
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
