/**
 * Regression suite for lib/a11y/focus-trap.js — the keyboard-containment rules
 * shared by every modal dialog in the app.
 *
 * These rules were previously implemented once, by hand, inside PinModal:
 *
 *     const focusableElements = modalRef.current.querySelectorAll(
 *       'input, button, [href], [tabIndex]:not([tabIndex="-1"])'
 *     )
 *     const lastElement = focusableElements[focusableElements.length - 1]
 *     if (document.activeElement === lastElement) { firstElement.focus() }
 *
 * Every defect in that selector *silently disables* the trap rather than
 * announcing itself, which is exactly why these rules are extracted and pinned
 * here. The four regressions this suite exists to catch:
 *
 *   1. Disabled controls counted as tabbable. PinModal's submit button is
 *      disabled until six digits are entered, so it was `lastElement` — but the
 *      browser never focuses a disabled button, so the wrap condition was never
 *      true and Tab escaped the dialog in the state the user starts in.
 *   2. `select`, `textarea` and `[contenteditable]` were not matched at all.
 *      CuteLetterModal is built around a textarea.
 *   3. `[tabIndex]` is the JSX property name; the DOM attribute is `tabindex`.
 *   4. Hidden controls (an inactive step of a multi-step dialog) were included,
 *      so Tab landed on something invisible.
 *
 * The module under test is pure by design, so this needs no browser: elements
 * are plain objects exposing only the handful of members the rules read.
 *
 *   node scripts/test-focus-trap.js
 */

import {
  FOCUSABLE_SELECTOR,
  getTabbableElements,
  hasNegativeTabIndex,
  isDisabled,
  isDismissKey,
  isTabKey,
  isTabbable,
  isVisible,
  resolveInitialFocus,
  resolveTabTarget,
  shouldDismissOnBackdrop,
} from '../lib/a11y/focus-trap.js'

let passed = 0
let failed = 0

function check(actual, expected, label) {
  if (Object.is(actual, expected)) {
    passed += 1
    return
  }
  failed += 1
  console.error(`  ❌ ${label}`)
  console.error(`       expected: ${JSON.stringify(expected)}`)
  console.error(`       actual:   ${JSON.stringify(actual)}`)
}

function checkNames(actual, expected, label) {
  const a = JSON.stringify((actual || []).map((el) => el.name))
  const b = JSON.stringify(expected)
  if (a === b) {
    passed += 1
    return
  }
  failed += 1
  console.error(`  ❌ ${label}`)
  console.error(`       expected: ${b}`)
  console.error(`       actual:   ${a}`)
}

function section(name) {
  console.log(`\n— ${name}`)
}

/* ────────────────────────────────────────────────────────────────────────────
 * A minimal element double
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * @param {string} name a label used only in failure output
 * @param {object} [options]
 * @param {Record<string, string>} [options.attrs] DOM attributes
 * @param {boolean} [options.disabled] the DOM *property*, as React sets it
 * @param {boolean} [options.hiddenBox] renders with no layout box
 */
function el(name, { attrs = {}, disabled, hiddenBox = false, hidden = false } = {}) {
  return {
    name,
    disabled,
    hidden,
    offsetWidth: hiddenBox ? 0 : 100,
    offsetHeight: hiddenBox ? 0 : 20,
    getClientRects: () => (hiddenBox ? [] : [{ width: 100, height: 20 }]),
    getAttribute(attr) {
      return Object.prototype.hasOwnProperty.call(attrs, attr) ? attrs[attr] : null
    },
  }
}

/** A container whose querySelectorAll simply returns everything it was given. */
function container(children) {
  return { querySelectorAll: () => children }
}

/* ────────────────────────────────────────────────────────────────────────────
 * The selector
 * ────────────────────────────────────────────────────────────────────────── */

section('the focusable selector covers what the old one missed')
{
  for (const fragment of ['textarea', 'select', 'a[href]', '[contenteditable]', 'audio[controls]']) {
    check(
      FOCUSABLE_SELECTOR.includes(fragment), true,
      `the selector includes \`${fragment}\` — the old hand-rolled one did not`
    )
  }

  // Regression 3: querySelectorAll matches attributes, and the DOM attribute is
  // lowercase. The old selector used the JSX property spelling.
  check(
    FOCUSABLE_SELECTOR.includes('[tabindex]'), true,
    'the selector uses the lowercase DOM attribute `tabindex`'
  )
  check(
    FOCUSABLE_SELECTOR.includes('[tabIndex]'), false,
    'the selector does not use the JSX property spelling `tabIndex`'
  )
}

/* ────────────────────────────────────────────────────────────────────────────
 * isDisabled
 * ────────────────────────────────────────────────────────────────────────── */

section('disabled detection')
{
  check(isDisabled(el('plain')), false, 'an ordinary element is not disabled')
  check(
    isDisabled(el('submit', { disabled: true })), true,
    'the `disabled` property is honoured — this is how React sets it'
  )
  check(
    isDisabled(el('submit', { attrs: { disabled: '' } })), true,
    'a bare `disabled` attribute is honoured'
  )
  check(
    isDisabled(el('submit', { attrs: { 'aria-disabled': 'true' } })), true,
    'aria-disabled makes a control a dead end in the cycle'
  )
  check(
    isDisabled(el('submit', { attrs: { 'aria-disabled': 'false' } })), false,
    'aria-disabled="false" is not disabled'
  )
  check(isDisabled(null), true, 'a missing element is treated as unfocusable')
}

/* ────────────────────────────────────────────────────────────────────────────
 * tabindex and visibility
 * ────────────────────────────────────────────────────────────────────────── */

section('tabindex handling')
{
  check(hasNegativeTabIndex(el('a')), false, 'no tabindex is not negative')
  check(hasNegativeTabIndex(el('a', { attrs: { tabindex: '-1' } })), true, 'tabindex="-1" is negative')
  check(hasNegativeTabIndex(el('a', { attrs: { tabindex: '0' } })), false, 'tabindex="0" is tabbable')
  check(hasNegativeTabIndex(el('a', { attrs: { tabindex: '3' } })), false, 'a positive tabindex is tabbable')
  check(
    hasNegativeTabIndex(el('a', { attrs: { tabindex: '' } })), false,
    'an empty tabindex is not treated as negative'
  )
  check(
    hasNegativeTabIndex(el('a', { attrs: { tabindex: 'nonsense' } })), false,
    'an unparseable tabindex is not treated as negative'
  )
}

section('visibility')
{
  check(isVisible(el('shown')), true, 'an element with a layout box is visible')
  check(isVisible(el('collapsed', { hiddenBox: true })), false, 'an element with no layout box is not visible')
  check(isVisible(el('hidden', { hidden: true })), false, 'the `hidden` attribute hides an element')
  check(
    isVisible(el('aria', { attrs: { 'aria-hidden': 'true' } })), false,
    'aria-hidden removes an element from the cycle'
  )
  check(
    isVisible({ name: 'bare', getAttribute: () => null }), true,
    'an element exposing no box metrics fails open rather than being dropped'
  )
}

/* ────────────────────────────────────────────────────────────────────────────
 * getTabbableElements — the four original regressions, together
 * ────────────────────────────────────────────────────────────────────────── */

section('tabbable collection')
{
  const pin = el('pin-input')
  const unlockDisabled = el('unlock-button', { disabled: true })

  // Regression 1, exactly as it occurred: PinModal on first render.
  checkNames(
    getTabbableElements(container([pin, unlockDisabled])), ['pin-input'],
    'a disabled submit button is excluded — the case that silently broke PinModal'
  )

  check(
    isTabbable(unlockDisabled), false,
    'and the disabled button is not tabbable on its own either'
  )

  // Regression 4: a control in a hidden step of a multi-step dialog.
  checkNames(
    getTabbableElements(container([
      el('step-1-input'),
      el('step-2-input', { hiddenBox: true }),
      el('close', { attrs: { 'data-modal-close': '' } }),
    ])),
    ['step-1-input', 'close'],
    'a control in a hidden step is excluded'
  )

  checkNames(
    getTabbableElements(container([
      el('a'),
      el('skip', { attrs: { tabindex: '-1' } }),
      el('b'),
    ])),
    ['a', 'b'],
    'tabindex="-1" elements are excluded'
  )

  // Document order, not tabindex order — a positive tabindex inside a modal is
  // never what the author meant, and honouring it would desync the cycle from
  // the visual order.
  checkNames(
    getTabbableElements(container([
      el('first', { attrs: { tabindex: '5' } }),
      el('second', { attrs: { tabindex: '1' } }),
    ])),
    ['first', 'second'],
    'positive tabindex values do not reorder the cycle'
  )

  checkNames(getTabbableElements(container([])), [], 'an empty dialog yields an empty cycle')
  checkNames(getTabbableElements(null), [], 'a null container yields an empty cycle')
  checkNames(getTabbableElements({}), [], 'a container with no querySelectorAll yields an empty cycle')
}

/* ────────────────────────────────────────────────────────────────────────────
 * resolveTabTarget — the wrap rules
 * ────────────────────────────────────────────────────────────────────────── */

section('tab wrapping')
{
  const first = el('first')
  const middle = el('middle')
  const last = el('last')
  const tabbables = [first, middle, last]

  const fwdMid = resolveTabTarget({ tabbables, activeElement: middle, shiftKey: false })
  check(fwdMid.preventDefault, false, 'mid-cycle Tab is left to the browser')
  check(fwdMid.element, null, '…with no forced target')

  const fwdLast = resolveTabTarget({ tabbables, activeElement: last, shiftKey: false })
  check(fwdLast.element, first, 'Tab on the last element wraps to the first')
  check(fwdLast.preventDefault, true, '…and suppresses the default')

  const backFirst = resolveTabTarget({ tabbables, activeElement: first, shiftKey: true })
  check(backFirst.element, last, 'Shift+Tab on the first element wraps to the last')
  check(backFirst.preventDefault, true, '…and suppresses the default')

  const backMid = resolveTabTarget({ tabbables, activeElement: middle, shiftKey: true })
  check(backMid.preventDefault, false, 'mid-cycle Shift+Tab is left to the browser')

  // Focus can legitimately be on the dialog container itself (it carries
  // tabindex="-1") or on a control that became untabbable since the last render.
  const outside = resolveTabTarget({ tabbables, activeElement: el('page-nav'), shiftKey: false })
  check(outside.element, first, 'Tab from outside the cycle re-enters at the first element')
  check(outside.preventDefault, true, '…rather than letting focus escape')

  const outsideBack = resolveTabTarget({ tabbables, activeElement: el('page-nav'), shiftKey: true })
  check(outsideBack.element, last, 'Shift+Tab from outside the cycle re-enters at the last element')

  const single = resolveTabTarget({ tabbables: [first], activeElement: first, shiftKey: false })
  check(single.element, first, 'a one-element cycle wraps onto itself')
  check(single.preventDefault, true, '…and still suppresses the default')

  // An informational dialog with no controls must still not leak focus.
  const empty = resolveTabTarget({ tabbables: [], activeElement: first, shiftKey: false })
  check(empty.element, null, 'a dialog with nothing tabbable has no target')
  check(empty.preventDefault, true, '…but Tab is still suppressed, so focus cannot escape')

  const missing = resolveTabTarget({ tabbables: null, activeElement: first, shiftKey: false })
  check(missing.preventDefault, true, 'a missing tabbable list still suppresses Tab')
}

/* ────────────────────────────────────────────────────────────────────────────
 * resolveInitialFocus
 * ────────────────────────────────────────────────────────────────────────── */

section('initial focus')
{
  const close = el('close', { attrs: { 'data-modal-close': '' } })
  const input = el('input')
  const submit = el('submit')

  // Landing on Close first is valid and hostile: the first thing announced
  // would be how to leave the dialog.
  check(
    resolveInitialFocus(container([close, input, submit])), input,
    'the close button is skipped in favour of the first real control'
  )

  const nominated = el('date-field', { attrs: { 'data-autofocus': '' } })
  check(
    resolveInitialFocus(container([close, input, nominated])), nominated,
    'an explicit data-autofocus target wins'
  )

  check(
    resolveInitialFocus(container([close])), close,
    'a dialog whose only control is Close focuses it rather than nothing'
  )

  const informational = container([])
  check(
    resolveInitialFocus(informational), informational,
    'a dialog with no controls focuses its own container'
  )
}

/* ────────────────────────────────────────────────────────────────────────────
 * Key predicates
 * ────────────────────────────────────────────────────────────────────────── */

section('dismiss and tab key predicates')
{
  check(isDismissKey({ key: 'Escape' }), true, 'Escape dismisses')
  check(isDismissKey({ key: 'Esc' }), true, 'the legacy `Esc` spelling dismisses')
  check(isDismissKey({ key: 'Enter' }), false, 'Enter does not dismiss')

  // The bilingual case: Escape cancelling an IME conversion must cancel the
  // conversion, not close the dialog underneath it.
  check(
    isDismissKey({ key: 'Escape', isComposing: true }), false,
    'Escape during an IME composition does not dismiss'
  )
  check(
    isDismissKey({ key: 'Escape', defaultPrevented: true }), false,
    'an already-handled Escape does not dismiss twice'
  )
  check(isDismissKey(null), false, 'a missing event does not dismiss')

  check(isTabKey({ key: 'Tab' }), true, 'Tab is recognised')
  check(isTabKey({ key: 'Tab', defaultPrevented: true }), false, 'an already-handled Tab is ignored')
  check(isTabKey({ key: 'a' }), false, 'other keys are ignored')
  check(isTabKey(undefined), false, 'a missing event is ignored')
}

/* ────────────────────────────────────────────────────────────────────────────
 * Backdrop dismissal
 * ────────────────────────────────────────────────────────────────────────── */

section('backdrop dismissal')
{
  const backdrop = el('backdrop')
  const panel = el('panel')

  check(
    shouldDismissOnBackdrop({ target: backdrop, pressTarget: backdrop, backdrop }), true,
    'a press and release both on the backdrop dismisses'
  )
  check(
    shouldDismissOnBackdrop({ target: panel, pressTarget: panel, backdrop }), false,
    'a click inside the panel does not dismiss'
  )

  // The bug this guard exists for: selecting text inside the dialog and
  // releasing the mouse outside it would otherwise close the dialog and throw
  // the user's input away.
  check(
    shouldDismissOnBackdrop({ target: backdrop, pressTarget: panel, backdrop }), false,
    'a drag that starts inside the panel and ends on the backdrop does not dismiss'
  )
  check(
    shouldDismissOnBackdrop({ target: panel, pressTarget: backdrop, backdrop }), false,
    'a drag that starts on the backdrop and ends inside the panel does not dismiss'
  )
  check(
    shouldDismissOnBackdrop({ target: backdrop, pressTarget: backdrop, backdrop: null }), false,
    'no backdrop means no dismissal'
  )
}

console.log('')
if (failed > 0) {
  console.error(`❌ ${failed} focus trap assertion(s) failed (${passed} passed).`)
  process.exit(1)
}
console.log(`✅ All ${passed} focus trap assertions passed.`)
