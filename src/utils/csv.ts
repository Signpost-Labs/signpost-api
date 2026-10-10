/**
 * RFC 4180-compliant CSV escaping and row formatting with OWASP formula-injection mitigation.
 */

/**
 * Dangerous leading characters that spreadsheet applications (Excel, Google
 * Sheets, LibreOffice Calc) interpret as formula triggers when they appear as
 * the first character of a CSV field. Prefixing these fields with a tab
 * character is the OWASP-recommended mitigation for CSV injection.
 *
 * @see https://owasp.org/www-community/attacks/CSV_Injection
 */
export const CSV_FORMULA_TRIGGER = /^[=+\-@\t\r]/;

/**
 * Escapes a single CSV field per RFC 4180: any value containing a comma,
 * double quote, newline (\n or \r), or tab is wrapped in double quotes, with
 * internal double quotes doubled.
 *
 * Additionally neutralizes CSV formula injection (OWASP) by prefixing any
 * field whose first character is a spreadsheet formula trigger (=, +, -, @, \t, \r)
 * with a tab character. The tab causes spreadsheet applications to treat the
 * field as a string literal rather than evaluating it as a formula, while
 * remaining invisible in most display contexts. The resulting field is then
 * quoted per RFC 4180 so the tab is preserved correctly by all CSV parsers.
 *
 * @param value The value to escape (string, number, null, undefined)
 * @returns The RFC-4180 escaped and formula-safe CSV field string
 */
export function escapeCsvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);

  // Neutralize formula-injection triggers before quoting so the sanitized
  // value is always safe regardless of whether it also contains RFC 4180
  // special characters.
  const safe = CSV_FORMULA_TRIGGER.test(str) ? `\t${str}` : str;

  if (/[",\n\r\t]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

/**
 * Backwards-compatibility alias for `escapeCsvField`.
 */
export const csvEscapeField = escapeCsvField;

/**
 * Formats an array of fields as a single CSV row (fields joined by comma).
 *
 * @param fields Array of field values
 * @returns The comma-joined, escaped CSV row string
 */
export function formatCsvRow(fields: Array<string | number | null | undefined>): string {
  return fields.map((f) => escapeCsvField(f)).join(',');
}
