'use client'

/**
 * FailedSyncPanel — the surface that dead-lettered offline changes never had.
 *
 * `lib/OfflineContext.jsx` has exposed `failedSyncItems`, `retryFailedSync` and
 * `discardFailedSync` since the sync-queue rewrite, and nothing in the app has
 * ever consumed them. A change that permanently failed to sync was moved into
 * an IndexedDB store the user cannot see, announced by a single transient
 * toast, and then forgotten — which for a menstrual-health tracker means the
 * data someone may be keeping specifically to show a clinician quietly stops
 * existing.
 *
 * Three deliberate choices:
 *
 * 1. **Discarding is confirmed inline, per item.** Retrying is safe and one
 *    click; discarding destroys a health log the server never received and
 *    there is no undo, so it takes a second, explicit press.
 * 2. **Failures are grouped by what they affect, not by request.** Editing the
 *    same day three times offline queues three operations; when the server
 *    rejects that day, all three dead-letter. Three identical rows would imply
 *    three separate losses when there is one affected day and one decision.
 * 3. **"Retry all" only offers to retry what a retry can fix.** A payload the
 *    server rejected will be rejected again, and a button that silently
 *    achieves nothing is worse than no button.
 *
 * All grouping, wording and severity logic lives in `lib/sync-failure-view.js`.
 */

import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { AlertTriangle, RefreshCw, Trash2, X } from 'lucide-react'
import { useOffline } from '@/lib/OfflineContext'
import { SEVERITY, explainFailure, groupFailures, summariseFailures } from '@/lib/sync-failure-view'

/**
 * @param {object} props
 * @param {boolean} [props.isOpen]
 * @param {() => void} [props.onClose]
 */
export default function FailedSyncPanel({ isOpen = true, onClose }) {
  const t = useTranslations('SyncFailures')
  const locale = useLocale()
  const { failedSyncItems, retryFailedSync, discardFailedSync } = useOffline()

  const [pendingDiscard, setPendingDiscard] = useState(null)
  const [busyKey, setBusyKey] = useState(null)

  const formatDate = useMemo(() => (isoDate) => {
    const parsed = new Date(`${String(isoDate).slice(0, 10)}T00:00:00`)
    if (Number.isNaN(parsed.getTime())) return isoDate
    return new Intl.DateTimeFormat(locale === 'hi' ? 'hi-IN' : 'en-US', {
      day: 'numeric', month: 'long', year: 'numeric',
    }).format(parsed)
  }, [locale])

  // `Date.now()` is read once per render rather than inside the pure grouping
  // module, which takes the clock as an argument so its output stays testable.
  const groups = useMemo(
    () => groupFailures(failedSyncItems, { now: Date.now(), formatDate }),
    [failedSyncItems, formatDate]
  )
  const summary = useMemo(() => summariseFailures(groups), [groups])

  if (!isOpen || summary.total === 0) return null

  const runRetry = async (group) => {
    setBusyKey(group.key)
    try {
      // The context's retry takes a single dead-letter id, and a group can hold
      // several — so a grouped retry is every underlying record, in order.
      for (const id of group.ids) {
        await retryFailedSync(id)
      }
    } finally {
      setBusyKey(null)
    }
  }

  const runRetryAll = async () => {
    setBusyKey('__all__')
    try {
      for (const group of groups.filter((entry) => entry.isRetryable)) {
        for (const id of group.ids) {
          await retryFailedSync(id)
        }
      }
    } finally {
      setBusyKey(null)
    }
  }

  const runDiscard = async (group) => {
    setBusyKey(group.key)
    try {
      for (const id of group.ids) {
        await discardFailedSync(id)
      }
    } finally {
      setBusyKey(null)
      setPendingDiscard(null)
    }
  }

  const panelRef = useRef(null)

  const isCritical = summary.severity === SEVERITY.ACTION_REQUIRED

  return (
    <section
      ref={panelRef}
      tabIndex={-1}
      aria-labelledby="failed-sync-title"
      className="rounded-2xl border p-4 sm:p-5 focus:outline-none"
      style={{
        background: isCritical ? 'rgba(244,63,94,0.10)' : 'rgba(251,191,36,0.10)',
        borderColor: isCritical ? 'rgba(244,63,94,0.35)' : 'rgba(251,191,36,0.35)',
      }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-2.5">
          <AlertTriangle
            className="mt-0.5 h-5 w-5 shrink-0"
            style={{ color: isCritical ? '#fb7185' : '#fcd34d' }}
            aria-hidden="true"
          />
          <div>
            <h2 id="failed-sync-title" className="text-sm font-semibold text-white">
              {t('title', { count: summary.total })}
            </h2>
            <p className="mt-0.5 text-xs text-white/65">{t('subtitle')}</p>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label={t('dismiss_panel')}
            className="rounded-full p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      <ul className="space-y-2.5">
        {groups.map((group) => {
          const explanation = explainFailure(group)
          const isBusy = busyKey === group.key || busyKey === '__all__'
          const isConfirmingDiscard = pendingDiscard === group.key

          return (
            <li
              key={group.key}
              className="rounded-xl border border-white/10 bg-black/20 p-3"
            >
              <p className="text-sm font-medium text-white">
                {group.description}
                {group.occurrences > 1 && (
                  <span className="ml-2 text-xs font-normal text-white/50">
                    {t('edit_count', { count: group.occurrences })}
                  </span>
                )}
              </p>
              <p className="mt-1 text-xs text-white/60">
                {t(explanation.key, explanation.params)} · {group.failedAtLabel}
              </p>

              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                {group.isRetryable && (
                  <button
                    type="button"
                    onClick={() => runRetry(group)}
                    disabled={isBusy}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/20 disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${isBusy ? 'animate-spin' : ''}`}
                      aria-hidden="true"
                    />
                    {t('retry')}
                  </button>
                )}

                {isConfirmingDiscard ? (
                  <>
                    {/* There is no undo — the server never received this — so
                        discarding takes a second, explicit press. */}
                    <span className="text-xs text-white/70">{t('discard_confirm')}</span>
                    <button
                      type="button"
                      onClick={() => runDiscard(group)}
                      disabled={isBusy}
                      className="rounded-lg bg-rose-500/80 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-rose-500 disabled:opacity-50"
                    >
                      {t('discard_yes')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDiscard(null)}
                      className="rounded-lg px-3 py-1.5 text-xs text-white/70 transition-colors hover:bg-white/10"
                    >
                      {t('discard_cancel')}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPendingDiscard(group.key)}
                    disabled={isBusy}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-white/60 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    {t('discard')}
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      {/* Only offered when a retry can actually achieve something. */}
      {summary.anyRetryable && groups.length > 1 && (
        <button
          type="button"
          onClick={runRetryAll}
          disabled={busyKey !== null}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/20 disabled:opacity-50"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${busyKey === '__all__' ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
          {t('retry_all', { count: summary.retryable })}
        </button>
      )}

      {summary.actionRequired > 0 && (
        <p className="mt-3 text-xs text-white/55">
          {t('action_required_note', { count: summary.actionRequired })}
        </p>
      )}
    </section>
  )
}
