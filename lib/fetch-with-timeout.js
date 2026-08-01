/**
 * fetchWithTimeout — drop-in `fetch()` wrapper with AbortController timeout.
 *
 * Default timeout: 8 000 ms (8 seconds).
 * Throws `TimeoutError` when the deadline is exceeded so call-sites can
 * detect timeouts specifically and show a friendly message.
 */

const DEFAULT_TIMEOUT_MS = 8000

export class TimeoutError extends Error {
  constructor(ms = DEFAULT_TIMEOUT_MS) {
    super(`Request timed out after ${ms / 1000} seconds. Please check your connection and try again.`)
    this.name = 'TimeoutError'
  }
}

/**
 * @param {string | URL | Request} url
 * @param {RequestInit}            [options]
 * @param {number}                 [timeoutMs=8000]
 * @returns {Promise<Response>}
 */
export default function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController()
  const { signal: externalSignal, ...rest } = options

  // If the caller already supplies their own signal, forward its abort
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort()
    } else {
      externalSignal.addEventListener('abort', () => controller.abort(), { once: true })
    }
  }

  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  return fetch(url, { ...rest, signal: controller.signal })
    .catch((err) => {
      if (err.name === 'AbortError') {
        throw new TimeoutError(timeoutMs)
      }
      throw err
    })
    .finally(() => clearTimeout(timeoutId))
}
