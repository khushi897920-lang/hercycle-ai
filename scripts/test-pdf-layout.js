/**
 * Regression suite for lib/pdf-layout.js.
 *
 * The bug this is part of fixing: `lib/generateReport.js` laid out an A4 page
 * with a single `currentY` counter that only ever increased and was never
 * compared against the page height. jsPDF neither paginates for you nor warns
 * — text placed past 297 mm is drawn outside the media box and is not in the
 * file. There was no `addPage()` call in the module at all, so on a report
 * with six cycles and a normal symptom list the medical disclaimer, drawn
 * last, was simply missing from the PDF a user hands to a doctor.
 *
 * The arithmetic is what is tested here, because it is the part that was
 * wrong and the part nobody can eyeball. Text measurement arrives as a
 * callback, so a stub measurer with predictable widths makes wrapping,
 * overflow and the header layout fully deterministic.
 *
 *   node scripts/test-pdf-layout.js
 */

import {
  A4,
  CONTENT_TOP,
  CONTENT_WIDTH,
  MARGINS,
  createCursor,
  encodeBase64Chunked,
  layoutLabelledFields,
  lineHeightMm,
  measureBlock,
  renderMeasuredValue,
  reportFileName,
  resolveReportLocale,
  truncateToWidth,
  wrapText,
} from '../lib/pdf-layout.js'

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

function checkDeep(actual, expected, label) {
  const a = JSON.stringify(actual)
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

function checkTruthy(value, label) {
  check(Boolean(value), true, label)
}

function checkClose(actual, expected, tolerance, label) {
  if (Math.abs(actual - expected) <= tolerance) {
    passed += 1
    return
  }
  failed += 1
  console.error(`  ❌ ${label}`)
  console.error(`       expected: ${expected} ±${tolerance}`)
  console.error(`       actual:   ${actual}`)
}

function section(title) {
  console.log(`\n${title}`)
}

/** Every character is 2 mm wide — enough to make wrapping arithmetic exact. */
const measure = (text) => String(text ?? '').length * 2

// ---------------------------------------------------------------------------

section('page geometry')

check(A4.width, 210, 'A4 is 210 mm wide')
check(A4.height, 297, 'A4 is 297 mm tall')
check(CONTENT_WIDTH, 210 - MARGINS.left - MARGINS.right, 'content width is the page minus both margins')
checkTruthy(CONTENT_TOP > MARGINS.top, 'content starts below the top margin')

// 10 pt at 1.15 spacing is about 4.06 mm. The old layout used 8, 12 and 15 mm
// constants for blocks of this size with no relationship to either number.
checkClose(lineHeightMm(10), 4.06, 0.02, 'a 10 pt line is about 4.06 mm')
checkClose(lineHeightMm(20), 8.11, 0.02, 'a 20 pt line is about 8.11 mm')
check(lineHeightMm(0), 0, 'a zero font size has no height')
check(lineHeightMm(-5), 0, 'a negative font size has no height')
check(lineHeightMm(NaN), 0, 'a non-numeric font size has no height')

// ---------------------------------------------------------------------------

section('the cursor — nothing may be drawn past the bottom margin')

let pageBreaks = 0
const cursor = createCursor({ onPageBreak: () => { pageBreaks += 1 } })

check(cursor.y, CONTENT_TOP, 'the cursor starts at the top of the content area')
check(cursor.pageCount, 1, 'one page to begin with')
check(cursor.remaining, A4.height - MARGINS.bottom - CONTENT_TOP, 'remaining space is measured to the bottom margin')

const firstY = cursor.reserve(10)
check(firstY, CONTENT_TOP, 'the first reservation draws at the top')
check(cursor.y, CONTENT_TOP + 10, 'the cursor advances by what was reserved')

// Fill the page to just under the limit.
const limit = A4.height - MARGINS.bottom
while (cursor.fits(10) && cursor.pageCount === 1) cursor.reserve(10)

check(cursor.pageCount, 1, 'no page break while blocks still fit')
checkTruthy(cursor.y <= limit, 'the cursor never passes the bottom margin')

// The reservation that does not fit is what triggers the break. This is the
// case the old code had no equivalent of — it just kept adding to currentY.
const overflowY = cursor.reserve(50)
check(cursor.pageCount, 2, 'an oversized reservation starts a new page')
check(pageBreaks, 1, 'the page-break callback fired exactly once')
check(overflowY, CONTENT_TOP, 'the overflowing block is drawn at the top of the new page')

section('the disclaimer case')

// A page filled to within a few millimetres of the bottom, then asked for the
// footer disclaimer — the exact situation that dropped it from the PDF.
const tight = createCursor()
tight.reserve(tight.remaining - 2)
check(tight.fits(6), false, 'a 6 mm disclaimer does not fit in 2 mm of space')

const disclaimerY = tight.reserve(6)
check(tight.pageCount, 2, 'the disclaimer gets its own page rather than falling off this one')
check(disclaimerY, CONTENT_TOP, 'and is drawn at the top of it')
checkTruthy(disclaimerY + 6 <= limit, 'the disclaimer is inside the printable area')

section('cursor edge cases')

const edge = createCursor()
check(edge.fits(0), true, 'a zero-height block always fits')
check(edge.fits(NaN), true, 'a non-numeric height is treated as zero')
check(edge.reserve(-5), CONTENT_TOP, 'a negative height reserves nothing')
check(edge.y, CONTENT_TOP, 'and does not move the cursor backwards')

// A block taller than a whole page cannot fit anywhere. It must be placed, not
// loop forever looking for room.
const huge = createCursor()
huge.reserve(10)
const hugeY = huge.reserve(A4.height * 2)
check(huge.pageCount, 2, 'an over-tall block still starts one new page')
check(hugeY, CONTENT_TOP, 'and is placed at the top rather than looping')

// Reserving an over-tall block on an *empty* page must not break to another
// empty page.
const emptyPage = createCursor()
emptyPage.reserve(A4.height * 2)
check(emptyPage.pageCount, 1, 'an over-tall block at the top of a page does not add a blank page first')

section('gaps and absolute moves')

const gapped = createCursor()
gapped.gap(10)
check(gapped.y, CONTENT_TOP + 10, 'a gap moves the cursor')
gapped.gap(A4.height)
check(gapped.y, limit, 'a gap clamps at the bottom margin instead of pushing a page break')
check(gapped.pageCount, 1, 'trailing space never creates a page on its own')

const moved = createCursor()
moved.moveTo(150)
check(moved.y, 150, 'moveTo positions the cursor absolutely — for use after autoTable')
moved.moveTo(A4.height + 100)
check(moved.y, limit, 'moveTo clamps below the bottom margin')
moved.moveTo(0)
check(moved.y, CONTENT_TOP, 'moveTo clamps above the top of the content area')
moved.moveTo(NaN)
check(moved.y, CONTENT_TOP, 'moveTo ignores a non-numeric value')

const counted = createCursor()
counted.notePagesAdded(3)
check(counted.pageCount, 4, 'pages added by autoTable are counted')
counted.notePagesAdded(-1)
check(counted.pageCount, 4, 'a negative page count is ignored')

// ---------------------------------------------------------------------------

section('wrapping — the count of lines, which is what was missing')

checkDeep(wrapText('one two three', 100, measure), ['one two three'], 'text that fits stays on one line')

// 2 mm per character, 20 mm wide, so ten characters per line.
checkDeep(
  wrapText('aaaa bbbb cccc dddd', 20, measure),
  ['aaaa bbbb', 'cccc dddd'],
  'text wraps at the width, on word boundaries'
)

checkDeep(
  wrapText('short\nlines', 100, measure),
  ['short', 'lines'],
  'explicit newlines are honoured'
)

// A single word wider than the line is left over-wide rather than hyphenated:
// breaking a symptom name mid-word in a clinical document is worse.
checkDeep(
  wrapText('supercalifragilistic', 10, measure),
  ['supercalifragilistic'],
  'a word longer than the line is not broken'
)

checkDeep(wrapText('', 100, measure), [], 'empty text produces no lines')
checkDeep(wrapText(null, 100, measure), [], 'null produces no lines')
checkDeep(wrapText('   ', 100, measure), [''], 'whitespace-only text is one empty line')
checkDeep(wrapText('abc', 0, measure), ['abc'], 'a zero width returns the text unwrapped rather than looping')
checkDeep(wrapText('abc', 100, null), ['abc'], 'no measurer returns the text unwrapped')

section('measureBlock')

const oneLine = measureBlock('four', { maxWidth: 100, fontSize: 10, measureText: measure })
check(oneLine.lines.length, 1, 'a short block is one line')
checkClose(oneLine.height, lineHeightMm(10), 0.001, 'and one line high')

const fiveLines = measureBlock('aaaa bbbb cccc dddd eeee ffff gggg hhhh iiii jjjj', {
  maxWidth: 20,
  fontSize: 10,
  measureText: measure,
})
check(fiveLines.lines.length, 5, 'a long block wraps to five lines')
checkClose(fiveLines.height, 5 * lineHeightMm(10), 0.001, 'and is five lines high')

// This is the bug in one assertion: the old code advanced by a flat 15 mm
// after a block like the one above, which is about 20 mm tall.
checkTruthy(
  fiveLines.height > 15,
  'a five-line symptom list is taller than the 15 mm the old layout assumed'
)

check(measureBlock('', { maxWidth: 100, fontSize: 10, measureText: measure }).height, 0, 'an empty block has no height')
check(measureBlock('x', {}).lines.length, 1, 'a block with no options still returns its text')

// ---------------------------------------------------------------------------

section('the patient header — measured, not assumed')

const shortHeader = layoutLabelledFields(
  [
    { label: 'Patient: ', value: 'Ada' },
    { label: 'Email: ', value: 'a@b.c' },
  ],
  { startX: MARGINS.left, maxWidth: CONTENT_WIDTH, gap: 6, measureText: measure }
)
check(shortHeader.stacked, false, 'two short fields share one line')
check(shortHeader.rows.length, 1, 'one row')
check(shortHeader.rows[0].length, 2, 'holding both fields')
check(shortHeader.rows[0][0].labelX, MARGINS.left, 'the first label starts at the margin')
check(shortHeader.rows[0][0].valueX, MARGINS.left + measure('Patient: '), 'the value starts after the measured label')

// The property the old fixed offsets did not have: the second label always
// begins after the first value ends. `marginLeft + 45` was a guess, and a name
// wider than the 31 mm it left ran straight through the word "Email:".
const [firstField, secondField] = shortHeader.rows[0]
checkTruthy(
  secondField.labelX >= firstField.valueX + measure(firstField.value),
  'the second label begins after the first value ends, however long the name is'
)

// The same check with a name long enough to have overlapped under the old
// layout: twenty-six characters against the twenty the fixed offset allowed.
const wideName = layoutLabelledFields(
  [
    { label: 'Patient: ', value: 'Priyadarshini Venkataraman' },
    { label: 'Email: ', value: 'p.v@example.com' },
  ],
  { startX: MARGINS.left, maxWidth: CONTENT_WIDTH, gap: 6, measureText: measure }
)
check(wideName.stacked, false, 'a long name still fits on one line when there is room for it')
checkTruthy(
  wideName.rows[0][1].labelX >= wideName.rows[0][0].valueX + measure('Priyadarshini Venkataraman'),
  'and the email label is pushed clear of it rather than drawn over it'
)
// Under the old layout this name would have started at marginLeft + 14 and run
// to marginLeft + 66, while "Email:" was drawn at marginLeft + 45.
checkTruthy(
  14 + measure('Priyadarshini Venkataraman') > 45,
  'the old fixed offsets would have overlapped for this name'
)

// When the pair genuinely cannot share a line, each gets its own.
const stacked = layoutLabelledFields(
  [
    { label: 'Patient: ', value: 'Priyadarshini Venkataraman' },
    { label: 'Email: ', value: 'priyadarshini.venkataraman@example.com' },
  ],
  { startX: MARGINS.left, maxWidth: 80, gap: 6, measureText: measure }
)
check(stacked.stacked, true, 'fields that cannot share a line stack instead of overlapping')
check(stacked.rows.length, 2, 'one row per field')
check(stacked.rows[0][0].labelX, MARGINS.left, 'each stacked label starts at the margin')

// The layout reads the label's width rather than assuming an English one — the
// reason the Hindi header overlapped on its very first line, where `रोगी: ` is
// wider than the 14 mm the old code allotted it.
const hindiHeader = layoutLabelledFields(
  [{ label: 'रोगी: ', value: 'नाम' }],
  { startX: MARGINS.left, maxWidth: CONTENT_WIDTH, gap: 6, measureText: measure }
)
check(
  hindiHeader.rows[0][0].valueX,
  MARGINS.left + measure('रोगी: '),
  'a Hindi label positions its value by its own measured width, not an English constant'
)
checkTruthy(
  hindiHeader.rows[0][0].valueX !== shortHeader.rows[0][0].valueX,
  'and lands somewhere different from the English label, as it must'
)

checkDeep(layoutLabelledFields([], { startX: 20, maxWidth: 100, measureText: measure }).rows, [], 'no fields, no rows')
checkDeep(layoutLabelledFields(null, { startX: 20, maxWidth: 100, measureText: measure }).rows, [], 'null fields are handled')
check(
  layoutLabelledFields([{ label: 'A: ', value: 'b' }], { startX: 20, maxWidth: 100 }).stacked,
  true,
  'with no measurer, fields stack — the safe choice'
)
check(
  layoutLabelledFields([{ label: 'A: ' }], { startX: 20, maxWidth: 100, measureText: measure }).rows[0][0].value,
  '',
  'a missing value becomes an empty string rather than "undefined"'
)

section('truncation')

check(truncateToWidth('short', 100, measure), 'short', 'text that fits is untouched')
checkTruthy(measure(truncateToWidth('a'.repeat(50), 20, measure)) <= 20, 'truncated text fits the width')
checkTruthy(truncateToWidth('a'.repeat(50), 20, measure).endsWith('…'), 'truncated text is marked with an ellipsis')
check(truncateToWidth('', 20, measure), '', 'empty text truncates to empty')
check(truncateToWidth('abc', 0, measure), 'abc', 'a zero width returns the text rather than an empty string')
check(truncateToWidth('abcdef', 100, null), 'abcdef', 'no measurer returns the text')
check(truncateToWidth('abcdef', 1, measure), '…', 'a width too small for any character is just the ellipsis')

// ---------------------------------------------------------------------------

section('the Hindi fallback — a readable English report beats an unreadable Hindi one')

checkDeep(
  resolveReportLocale('en', false),
  { locale: 'en', fellBack: false, needsNotice: false },
  'English never needs an embedded font'
)
checkDeep(
  resolveReportLocale('hi', true),
  { locale: 'hi', fellBack: false, needsNotice: false },
  'Hindi with the font embedded stays Hindi'
)

// The case that produced a page of empty boxes: Hindi labels selected
// independently of whether the Devanagari font had loaded.
const fallback = resolveReportLocale('hi', false)
check(fallback.locale, 'en', 'Hindi without the font falls back to English labels')
check(fallback.fellBack, true, 'the fallback is recorded')
check(fallback.needsNotice, true, 'and the reader is told why on the page')

checkDeep(
  resolveReportLocale(undefined, false),
  { locale: 'en', fellBack: false, needsNotice: false },
  'a missing locale defaults to English'
)

section('measured values — no fabricated defaults')

check(renderMeasuredValue(28, 'Not recorded'), '28', 'a real number renders')
check(renderMeasuredValue(28, 'Not recorded', (n) => `${n} days`), '28 days', 'a formatter is applied to numbers')
check(renderMeasuredValue('2026-08-01', 'Not recorded'), '2026-08-01', 'a date string renders')

// `pcod?.averageCycleLength || … : 28` printed "28 days" for a user with no
// cycles at all, in a document a clinician reads as data.
check(renderMeasuredValue(null, 'Not recorded'), 'Not recorded', 'null is reported as not recorded')
check(renderMeasuredValue(undefined, 'Not recorded'), 'Not recorded', 'undefined is reported as not recorded')
check(renderMeasuredValue('', 'Not recorded'), 'Not recorded', 'an empty string is reported as not recorded')
check(renderMeasuredValue(NaN, 'Not recorded'), 'Not recorded', 'NaN is reported as not recorded')
check(renderMeasuredValue(Infinity, 'Not recorded'), 'Not recorded', 'Infinity is reported as not recorded')
check(renderMeasuredValue(0, 'Not recorded'), '0', 'zero is a real measurement, not a missing one')

section('filenames')

check(reportFileName(new Date('2026-08-06T10:30:00Z')), 'hercycle-report-2026-08-06.pdf', 'the filename carries the date')
check(reportFileName('2026-01-02T00:00:00Z'), 'hercycle-report-2026-01-02.pdf', 'a date string works too')
check(reportFileName('not a date'), 'hercycle-report.pdf', 'an unparseable date falls back to the plain name')
checkTruthy(
  reportFileName(new Date('2026-08-06')) !== reportFileName(new Date('2026-08-07')),
  'two reports from different days do not share a filename'
)

section('font encoding')

// The font was encoded with a byte-at-a-time reduce over ~250 KB, on the main
// thread, on every download. Chunked encoding must produce the same bytes.
const toBase64 = (binary) => Buffer.from(binary, 'binary').toString('base64')
const sample = new Uint8Array(20000).map((_, i) => i % 256)

const chunked = encodeBase64Chunked(sample, toBase64)
const reference = Buffer.from(sample).toString('base64')
check(chunked, reference, 'chunked encoding matches a straight encode of the same bytes')
check(encodeBase64Chunked(new Uint8Array(0), toBase64), '', 'an empty buffer encodes to an empty string')
check(
  encodeBase64Chunked(sample.buffer, toBase64),
  reference,
  'an ArrayBuffer is accepted as well as a Uint8Array'
)
check(
  encodeBase64Chunked(sample, toBase64, 64),
  reference,
  'the result is independent of the chunk size'
)

// ---------------------------------------------------------------------------

console.log(`\n${failed === 0 ? '✅' : '❌'} ${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
