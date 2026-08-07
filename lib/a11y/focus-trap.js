/**
 * focus-trap.js — the keyboard-containment rules for a modal dialog.
 *
 * ## The bug this exists to prevent
 *
 * Every hand-rolled overlay in the app was a bare `fixed inset-0` div. Tab
 * walked straight out of the dialog and into the page behind it, so the user
 * ended up typing into a form they could not see. `PinModal` was the only one
 * that tried to contain focus, and its attempt is the reason this module is
 * pure rather than another `useEffect`:
 *
 *     const focusableElements = modalRef.current.querySelectorAll(
 *       'input, button, [href], [tabIndex]:not([tabIndex="-1"])'
 *     )
 *     const lastElement = focusableElements[focusableElements.length - 1]
 *     if (document.activeElement === lastElement) { firstElement.focus() }
 *
 * That selector has four defects, and every one of them silently disables the
 * trap rather than announcing itself:
 *
 * 1. **It matches disabled controls.** `PinModal`'s submit button is disabled
 *    until six digits are entered, so it is `lastElement` — but the browser
 *    never focuses a disabled button, so `activeElement === lastElement` is
 *    never true and Tab escapes the dialog entirely. The trap is off in
 *    precisely the state the user starts in.
 * 2. **It misses `select`, `textarea`, `audio[controls]` and
 *    `[contenteditable]`.** `CuteLetterModal` is built around a `textarea`.
 * 3. **`[tabIndex]` is the JSX property name.** The DOM attribute is
 *    lowercase `tabindex`, and `querySelectorAll` matches attributes, not
 *    properties. In a case-sensitive document this selects nothing.
 * 4. **It ignores visibility.** A control inside a `hidden` step of a
 *    multi-step dialog is still matched, so Tab lands on something invisible.
 *
 * ## Why this file has no DOM in it
 *
 * The rules above are the part that is easy to get wrong and hard to notice,
 * so they are expressed as pure functions over a minimal element shape and
 * unit-tested exhaustively in `scripts/test-focus-trap.js` without a browser.
 * The React wiring lives in `useModalA11y.js`; the decisions live here.
 */

/**
 * Elements that are focusable by default, without an explicit `tabindex`.
 *
 * `[contenteditable]` is matched by attribute presence because the property is
 * the string `"true"`/`"false"`, not a boolean.
 */
export const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button',
  'input',
  'select',
  'textarea',
  'details > summary',
  'iframe',
  'object',
  'embed',
  'audio[controls]',
  'video[controls]',
  '[contenteditable]',
  '[tabindex]',
].join(',')

/**
 * True when an element is disabled, and therefore unfocusable no matter what
 * the selector says.
 *
 * Checks the property first (React sets `disabled` as a property on form
 * controls) and falls back to the attribute, which is how a non-form element
 * with `aria-disabled` or a literal `disabled` attribute presents.
 *
 * @param {{ disabled?: boolean, getAttribute?: (name: string) => string|null }} element
 * @returns {boolean}
 */
export function isDisabled(element) {
  if (!element) return true
  if (element.disabled === true) return true

  const attr = element.getAttribute?.('disabled')
  if (attr !== null && attr !== undefined) return true

  // `aria-disabled` does not stop the browser focusing an element, but it does
  // mean the control is inert to the user, so cycling onto it is a dead end.
  return element.getAttribute?.('aria-disabled') === 'true'
}

/**
 * True when an element is removed from the tab order by `tabindex="-1"`.
 *
 * A negative tabindex means "focusable by script, skipped by Tab" — exactly the
 * elements a Tab cycle must not include.
 *
 * @param {{ getAttribute?: (name: string) => string|null }} element
 * @returns {boolean}
 */
export function hasNegativeTabIndex(element) {
  const raw = element?.getAttribute?.('tabindex')
  if (raw === null || raw === undefined || raw === '') return false
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed < 0
}

/**
 * True when an element is rendered and therefore actually reachable.
 *
 * Uses the layout-box test (`offsetWidth`/`offsetHeight`/`getClientRects`)
 * because it is the only check that catches every way an ancestor can hide a
 * child — `display: none`, `visibility: hidden`, a zero-height collapsed
 * container, and the `hidden` attribute — without walking the tree.
 *
 * Elements that expose none of those measurements (a plain object in a test, a
 * detached node) are treated as visible: the trap failing open on an unknown
 * shape is better than it excluding a real control.
 *
 * @param {object} element
 * @returns {boolean}
 */
export function isVisible(element) {
  if (!element) return false
  if (element.hidden === true) return false
  if (element.getAttribute?.('aria-hidden') === 'true') return false

  const hasBoxMetrics =
    typeof element.offsetWidth === 'number' || typeof element.offsetHeight === 'number'

  if (hasBoxMetrics) {
    if (element.offsetWidth > 0 || element.offsetHeight > 0) return true
    if (typeof element.getClientRects === 'function') {
      return element.getClientRects().length > 0
    }
    return false
  }

  return true
}

/**
 * True when an element belongs in the dialog's Tab cycle.
 *
 * @param {object} element
 * @returns {boolean}
 */
export function isTabbable(element) {
  if (!element) return false
  if (isDisabled(element)) return false
  if (hasNegativeTabIndex(element)) return false
  return isVisible(element)
}

/**
 * Collects the tabbable elements inside `container`, in document order.
 *
 * Deliberately *does not* honour positive `tabindex` values. A positive
 * tabindex reorders the element relative to the whole document, which inside a
 * modal is never what the author meant, and respecting it would make the cycle
 * order differ from the visual order.
 *
 * @param {{ querySelectorAll?: (selector: string) => Iterable<object> }} container
 * @returns {object[]}
 */
export function getTabbableElements(container) {
  if (!container || typeof container.querySelectorAll !== 'function') return []
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(isTabbable)
}

/**
 * Decides where a Tab keypress inside a dialog should send focus.
 *
 * Returning a *decision* rather than calling `.focus()` is what makes the wrap
 * rules testable. The caller focuses `element` and prevents the default only
 * when `preventDefault` is true — letting the browser handle the ordinary
 * mid-cycle case keeps native behaviour (typeahead, IME, custom widgets)
 * intact.
 *
 * @param {object} options
 * @param {object[]} options.tabbables the dialog's tabbable elements, in order
 * @param {object|null} options.activeElement `document.activeElement`
 * @param {boolean} options.shiftKey
 * @returns {{ element: object|null, preventDefault: boolean }}
 */
export function resolveTabTarget({ tabbables, activeElement, shiftKey }) {
  const list = Array.isArray(tabbables) ? tabbables : []

  // A dialog with nothing tabbable still must not leak focus — the container
  // itself is focused instead (the hook gives it `tabindex="-1"`).
  if (list.length === 0) {
    return { element: null, preventDefault: true }
  }

  const first = list[0]
  const last = list[list.length - 1]
  const index = list.indexOf(activeElement)

  // Focus is somewhere the cycle does not know about — the container itself, or
  // an element that became untabbable since the last render. Re-enter at the
  // appropriate end rather than letting Tab escape.
  if (index === -1) {
    return { element: shiftKey ? last : first, preventDefault: true }
  }

  if (shiftKey && activeElement === first) {
    return { element: last, preventDefault: true }
  }

  if (!shiftKey && activeElement === last) {
    return { element: first, preventDefault: true }
  }

  // Mid-cycle: let the browser do it.
  return { element: null, preventDefault: false }
}

/**
 * Picks the element that should receive focus when a dialog opens.
 *
 * Order of preference:
 *
 * 1. An element explicitly marked `data-autofocus`, so a dialog can nominate
 *    its primary field.
 * 2. The first tabbable element that is not the close button. Landing on
 *    "Close" first is technically valid and practically hostile: the first
 *    thing a keyboard user hears is how to leave.
 * 3. The first tabbable element, whatever it is.
 * 4. The container itself, for a dialog that is purely informational.
 *
 * @param {object} container
 * @param {object[]} [tabbables] precomputed, to avoid a second DOM query
 * @returns {object|null}
 */
export function resolveInitialFocus(container, tabbables) {
  const list = tabbables || getTabbableElements(container)

  const explicit = list.find((el) => el.getAttribute?.('data-autofocus') !== null &&
    el.getAttribute?.('data-autofocus') !== undefined)
  if (explicit) return explicit

  const notClose = list.find((el) => el.getAttribute?.('data-modal-close') === null ||
    el.getAttribute?.('data-modal-close') === undefined)
  if (notClose) return notClose

  return list[0] || container || null
}

/**
 * True when a keyboard event should dismiss the dialog.
 *
 * Escape is checked by `key`, not `keyCode`, and a composing IME session is
 * excluded — pressing Escape to cancel a Japanese or Hindi conversion must
 * cancel the conversion, not close the dialog underneath it. This is the exact
 * case that makes a naive `e.key === 'Escape'` handler infuriating on a
 * bilingual app.
 *
 * @param {{ key?: string, isComposing?: boolean, defaultPrevented?: boolean }} event
 * @returns {boolean}
 */
export function isDismissKey(event) {
  if (!event) return false
  if (event.defaultPrevented) return false
  if (event.isComposing) return false
  return event.key === 'Escape' || event.key === 'Esc'
}

/**
 * True when a Tab keypress needs the trap's attention.
 *
 * @param {{ key?: string, defaultPrevented?: boolean }} event
 * @returns {boolean}
 */
export function isTabKey(event) {
  if (!event) return false
  if (event.defaultPrevented) return false
  return event.key === 'Tab'
}

/**
 * Whether a backdrop click should dismiss the dialog.
 *
 * Only a press *and* release that both land on the backdrop count. Without the
 * press check, selecting text inside the dialog and releasing the mouse over
 * the backdrop closes it and throws the user's input away — a real and
 * frequently-hit bug in hand-rolled overlays.
 *
 * @param {object} options
 * @param {object} options.target the element the mouseup landed on
 * @param {object} options.pressTarget the element the mousedown landed on
 * @param {object} options.backdrop the backdrop element
 * @returns {boolean}
 */
export function shouldDismissOnBackdrop({ target, pressTarget, backdrop }) {
  if (!backdrop) return false
  return target === backdrop && pressTarget === backdrop
}
