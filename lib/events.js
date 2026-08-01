/**
 * Event-Driven Architecture / Pub-Sub Event Bus
 */
export class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  /**
   * Registers a listener for an event.
   * Supports '*' as a wildcard listener to capture all events.
   */
  on(event, listener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(listener);
    
    // Return unsubscribe function
    return () => this.off(event, listener);
  }

  /**
   * Removes a listener for an event.
   */
  off(event, listener) {
    if (!this.listeners.has(event)) return;
    const list = this.listeners.get(event);
    const index = list.indexOf(listener);
    if (index !== -1) {
      list.splice(index, 1);
    }
    if (list.length === 0) {
      this.listeners.delete(event);
    }
  }

  /**
   * Emits an event, calling all registered listeners asynchronously.
   */
  async emit(event, data) {
    const list = this.listeners.get(event) || [];
    const wildcards = this.listeners.get('*') || [];
    const allListeners = [...list, ...wildcards];

    const promises = allListeners.map(async (listener) => {
      try {
        await listener(data, event);
      } catch (err) {
        console.error(`Error in event listener for event ${event}:`, err);
      }
    });

    await Promise.all(promises);
  }

  /**
   * Clears all registered listeners.
   */
  clear() {
    this.listeners.clear();
  }
}

// Create a singleton instance of the event bus
const eventBus = new EventBus();

// Register decoupled side-effects / event handlers
eventBus.on('vibe:set', async (data) => {
  try {
    const { sendPartnerNudge } = await import('@/lib/actions/partner');
    await sendPartnerNudge('letter', data.vibeType);
  } catch (err) {
    console.error('Error handling vibe:set event:', err);
  }
});

eventBus.on('daily_logs:updated', async (data) => {
  try {
    const { pcodRiskCache } = await import('@/lib/cache');
    pcodRiskCache.invalidate(`pcod-risk:${data.userId}`);
  } catch (err) {
    console.error('Error handling daily_logs:updated event:', err);
  }
});

eventBus.on('cycles:updated', async (data) => {
  try {
    const { pcodRiskCache } = await import('@/lib/cache');
    pcodRiskCache.invalidate(`pcod-risk:${data.userId}`);
  } catch (err) {
    console.error('Error handling cycles:updated event:', err);
  }
});

export { eventBus };
