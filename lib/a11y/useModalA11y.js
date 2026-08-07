'use client'

/**
 * useModalA11y — the React wiring for an accessible modal dialog.
 *
 * Everything here is the *plumbing*; the rules it enforces live in
 * `./focus-trap.js`, which is pure and separately tested. This hook only
 * decides when to ask.
 *
 * What it guarantees for the dialog it is attached to:
 *
 * - Focus moves into the dialog on open, preferring the primary control over
 *   the close button.
 * - Tab and Shift+Tab cycle within the dialog and cannot reach the page behind.
 * - Escape dismisses (unless the dialog opts out — a PIN gate has nowhere to
 *   dismiss *to*).
 * - Focus returns to whatever opened the dialog when it closes, so the user
 *   does not lose their place in the page.
 * - `document.body` cannot scroll while a dialog is open, without the layout
 *   shift that naively setting `overflow: hidden` causes on desktop.
 *
 * ## Why the scroll lock counts references
 *
 * Two dialogs can legitimately be open at once — the PIN gate over the day-log
 * drawer, for instance. If each one restored `document.body.style.overflow` on
 * unmount, closing the inner dialog would unlock scrolling while the outer one
 * was still open. The lock is therefore module-level and reference-counted, and
 * only the last dialog to close restores the original style.
 */

import { useCallback, useEffect, useRef } from 'react'
import {
  getTabbableElements,
  isDismissKey,
  isTabKey,
  resolveInitialFocus,
  resolveTabTarget,
  shouldDismissOnBackdrop,
} from './focus-trap'

/**
 * How many dialogs currently hold the scroll lock, and what the body looked
 * like before the first of them took it.
 */
let scrollLockCount = 0
let savedBodyStyle = null

/**
 * Locks `document.body` against scrolling.
 *
 * Compensates for the scrollbar's width so the page does not jump sideways the
 * instant a dialog opens — the single most common visual artefact of a
 * hand-rolled `overflow: hidden` lock. `overscroll-behavior` stops a scroll
 * gesture that reaches the end of the dialog's own scroller from chaining to
 * the page behind it, which is the mobile half of the same problem.
 */
function lockBodyScroll() {
  if (typeof document === 'undefined') return

  scrollLockCount += 1
  if (scrollLockCount > 1) return

  const { body, documentElement } = document
  savedBodyStyle = {
    overflow: body.style.overflow,
    paddingRight: body.style.paddingRight,
    overscrollBehavior: body.style.overscrollBehavior,
  }

  const scrollbarWidth = window.innerWidth - documentElement.clientWidth
  if (scrollbarWidth > 0) {
    const existing = Number.parseFloat(window.getComputedStyle(body).paddingRight) || 0
    body.style.paddingRight = `${existing + scrollbarWidth}px`
  }

  body.style.overflow = 'hidden'
  body.style.overscrollBehavior = 'contain'
}

/** Releases this dialog's claim on the scroll lock. */
function unlockBodyScroll() {
  if (typeof document === 'undefined') return

  scrollLockCount = Math.max(0, scrollLockCount - 1)
  if (scrollLockCount > 0 || !savedBodyStyle) return

  const { body } = document
  body.style.overflow = savedBodyStyle.overflow
  body.style.paddingRight = savedBodyStyle.paddingRight
  body.style.overscrollBehavior = savedBodyStyle.overscrollBehavior
  savedBodyStyle = null
}

/**
 * Wires accessible-dialog behaviour onto a container element.
 *
 * @param {object} options
 * @param {boolean} [options.isOpen=true] whether the dialog is mounted and visible
 * @param {() => void} [options.onClose] called on Escape and on a backdrop dismiss
 * @param {boolean} [options.closeOnEscape=true] set false for a gate the user
 *   cannot dismiss (the encryption PIN modal has nowhere to dismiss to)
 * @param {boolean} [options.closeOnBackdrop=true]
 * @param {boolean} [options.lockScroll=true]
 * @param {boolean} [options.restoreFocus=true]
 * @returns {{
 *   containerRef: import('react').RefObject<any>,
 *   backdropRef: import('react').RefObject<any>,
 *   onBackdropMouseDown: (event: any) => void,
 *   onBackdropClick: (event: any) => void
 * }}
 */
export function useModalA11y({
  isOpen = true,
  onClose,
  closeOnEscape = true,
  closeOnBackdrop = true,
  lockScroll = true,
  restoreFocus = true,
} = {}) {
  const containerRef = useRef(null)
  const backdropRef = useRef(null)
  const pressTargetRef = useRef(null)
  const previouslyFocusedRef = useRef(null)

  // Held in a ref so the keydown effect does not re-subscribe on every render
  // when the parent passes an inline arrow function — which is every parent.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  /* ── Focus capture and restore ─────────────────────────────────────────── */
  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return undefined

    // Captured before focus moves, so it survives however the dialog closes.
    previouslyFocusedRef.current = document.activeElement

    const container = containerRef.current
    if (container) {
      const target = resolveInitialFocus(container, getTabbableElements(container))
      // `preventScroll` stops the browser scrolling the *page* to reveal a
      // control that is already visible inside the fixed overlay.
      target?.focus?.({ preventScroll: true })
    }

    return () => {
      if (!restoreFocus) return
      const previous = previouslyFocusedRef.current
      // The trigger can legitimately be gone — a dialog opened from a row that
      // the dialog itself deleted. Focusing a detached node throws in some
      // engines and silently no-ops in others, so guard on connectivity.
      if (previous && typeof previous.focus === 'function' && previous.isConnected !== false) {
        previous.focus({ preventScroll: true })
      }
    }
  }, [isOpen, restoreFocus])

  /* ── Scroll lock ───────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!isOpen || !lockScroll) return undefined
    lockBodyScroll()
    return unlockBodyScroll
  }, [isOpen, lockScroll])

  /* ── Escape and Tab ────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return undefined

    const handleKeyDown = (event) => {
      if (closeOnEscape && isDismissKey(event)) {
        event.preventDefault()
        // Only the topmost dialog should react. Checking containment means a
        // nested dialog closes itself and leaves its parent open.
        event.stopPropagation()
        onCloseRef.current?.()
        return
      }

      if (!isTabKey(event)) return

      const container = containerRef.current
      if (!container) return

      const { element, preventDefault } = resolveTabTarget({
        tabbables: getTabbableElements(container),
        activeElement: document.activeElement,
        shiftKey: event.shiftKey,
      })

      if (!preventDefault) return

      event.preventDefault()
      // `element` is null for a dialog with nothing tabbable; focus the
      // container so Tab still cannot reach the page behind it.
      ;(element || container).focus?.({ preventScroll: true })
    }

    // Capture phase: a control inside the dialog that stops propagation on
    // keydown (a combobox swallowing Escape, say) must not be able to disable
    // the trap for the whole dialog.
    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [isOpen, closeOnEscape])

  /* ── Backdrop dismissal ────────────────────────────────────────────────── */

  const onBackdropMouseDown = useCallback((event) => {
    pressTargetRef.current = event.target
  }, [])

  const onBackdropClick = useCallback((event) => {
    if (!closeOnBackdrop) return

    const dismiss = shouldDismissOnBackdrop({
      target: event.target,
      pressTarget: pressTargetRef.current,
      backdrop: backdropRef.current,
    })

    pressTargetRef.current = null
    if (dismiss) onCloseRef.current?.()
  }, [closeOnBackdrop])

  return { containerRef, backdropRef, onBackdropMouseDown, onBackdropClick }
}

export default useModalA11y
