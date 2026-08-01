import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"
import { toISODate } from "./date-utils.js"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Normalises a stored date to YYYY-MM-DD in the user's local calendar.
 * Falls back to the original value so a malformed row stays visible rather than
 * silently rendering as an empty cell.
 */
export function toYMD(value) {
  if (!value) return "";
  return toISODate(value) || String(value);
}

/**
 * Same normalisation for CSV export, where an unparseable value must become an
 * empty cell rather than leak a raw timestamp into the spreadsheet.
 */
export function formatDateForCSV(value) {
  if (value === null || value === undefined || value === "") return "";
  return toISODate(value);
}