'use client'

/**
 * ModalShell — the accessible container every hand-rolled overlay in the app
 * now renders inside.
 *
 * Before this existed, each modal built its own `fixed inset-0` backdrop and
 * each one was inaccessible in the same seven ways: no `role="dialog"`, no
 * `aria-modal`, no accessible name, no focus trap, no focus restore, no
 * Escape-to-close, and no scroll lock. Fixing that seven times over would have
 * meant seven chances to get it subtly wrong — `DayLogDrawer` had already put
 * `role="dialog"` on the *backdrop* rather than on the panel, so the dialog
 * role wrapped an empty div while the actual content sat outside it.
 *
 * The shell owns the parts that must be identical everywhere; each modal keeps
 * its own visual design by passing `panelClassName` / `panelStyle`, or by
 * opting out of the default chrome entirely with `unstyled`.
 *
 * Accessible naming is not optional here: `title` is required, and it is wired
 * to the panel with `aria-labelledby` via a generated id. A dialog with no
 * accessible name is announced as an unlabelled group, which is barely more
 * useful than no dialog role at all.
 */

import { useId } from 'react'
import { X } from 'lucide-react'
import useModalA11y from '@/lib/a11y/useModalA11y'

/**
 * @param {object} props
 * @param {boolean} [props.isOpen=true] when false, nothing renders
 * @param {() => void} [props.onClose]
 * @param {import('react').ReactNode} props.title the visible heading, or a
 *   string used as the accessible name when `hideTitle` is set
 * @param {import('react').ReactNode} [props.description] optional supporting
 *   text, wired to `aria-describedby`
 * @param {import('react').ReactNode} props.children
 * @param {boolean} [props.hideTitle=false] render the heading visually hidden,
 *   for dialogs whose design already shows their own heading
 * @param {string} [props.titleClassName] styling for the visible heading
 * @param {string} [props.descriptionClassName] styling for the visible description
 * @param {boolean} [props.showCloseButton=true]
 * @param {string} [props.closeLabel='Close dialog'] accessible name for the
 *   close button — never leave this as a bare glyph
 * @param {boolean} [props.closeOnEscape=true]
 * @param {boolean} [props.closeOnBackdrop=true]
 * @param {string} [props.backdropClassName]
 * @param {object} [props.backdropStyle]
 * @param {string} [props.panelClassName]
 * @param {object} [props.panelStyle]
 * @param {string} [props.headerClassName]
 * @param {boolean} [props.unstyled=false] drop the shell's own backdrop/panel
 *   classes entirely and use only what the caller passes
 * @param {string} [props.role='dialog'] use 'alertdialog' for a destructive
 *   confirmation
 */
export default function ModalShell({
  isOpen = true,
  onClose,
  title,
  description,
  children,
  hideTitle = false,
  titleClassName = '',
  descriptionClassName = '',
  showCloseButton = true,
  closeLabel = 'Close dialog',
  closeOnEscape = true,
  closeOnBackdrop = true,
  backdropClassName = '',
  backdropStyle,
  panelClassName = '',
  panelStyle,
  headerClassName = '',
  unstyled = false,
  role = 'dialog',
}) {
  const generatedId = useId()
  const titleId = `${generatedId}-title`
  const descriptionId = `${generatedId}-description`

  const { containerRef, backdropRef, onBackdropMouseDown, onBackdropClick } = useModalA11y({
    isOpen,
    onClose,
    closeOnEscape,
    closeOnBackdrop,
  })

  if (!isOpen) return null

  const defaultBackdrop = unstyled
    ? ''
    : 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm'
  const defaultPanel = unstyled
    ? ''
    : 'relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl'

  return (
    <div
      ref={backdropRef}
      className={`${defaultBackdrop} ${backdropClassName}`.trim()}
      style={backdropStyle}
      onMouseDown={onBackdropMouseDown}
      onClick={onBackdropClick}
    >
      <div
        ref={containerRef}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        // Focusable by script but skipped by Tab, so the trap always has
        // somewhere to put focus even in a dialog with no controls.
        tabIndex={-1}
        className={`${defaultPanel} ${panelClassName} focus:outline-none`.trim()}
        style={panelStyle}
      >
        {showCloseButton && onClose && (
          <button
            type="button"
            onClick={onClose}
            // Read by resolveInitialFocus, which deliberately skips the close
            // button when picking where focus lands: the first thing a
            // keyboard user hears should not be how to leave.
            data-modal-close=""
            aria-label={closeLabel}
            className="absolute top-4 right-4 z-10 rounded-full p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        )}

        <div className={headerClassName}>
          <h2 id={titleId} className={hideTitle ? 'sr-only' : titleClassName}>
            {title}
          </h2>
          {description && (
            <p id={descriptionId} className={hideTitle ? 'sr-only' : descriptionClassName}>
              {description}
            </p>
          )}
        </div>

        {children}
      </div>
    </div>
  )
}
