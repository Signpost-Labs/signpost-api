import {
  escapeCsvField,
  csvEscapeField,
  formatCsvRow,
  CSV_FORMULA_TRIGGER,
} from '../../src/utils/csv';

/**
 * Minimal RFC 4180-aware CSV parser for test round-tripping.
 */
function parseCsvRow(text: string): string[] {
  const row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += char;
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }

    if (char === ',') {
      row.push(field);
      field = '';
      i += 1;
      continue;
    }

    field += char;
    i += 1;
  }
  row.push(field);
  return row;
}

describe('src/utils/csv', () => {
  describe('escapeCsvField', () => {
    describe('plain safe fields', () => {
      it('returns plain text without quotes', () => {
        expect(escapeCsvField('hello')).toBe('hello');
        expect(escapeCsvField('hello world')).toBe('hello world');
        expect(escapeCsvField('user123_test')).toBe('user123_test');
      });

      it('handles numeric and primitive values cleanly', () => {
        expect(escapeCsvField(123)).toBe('123');
        expect(escapeCsvField(0)).toBe('0');
        expect(escapeCsvField(99.95)).toBe('99.95');
      });

      it('handles null and undefined by returning empty string', () => {
        expect(escapeCsvField(null)).toBe('');
        expect(escapeCsvField(undefined)).toBe('');
        expect(escapeCsvField('')).toBe('');
      });

      it('aliases csvEscapeField to escapeCsvField', () => {
        expect(csvEscapeField).toBe(escapeCsvField);
        expect(csvEscapeField('test')).toBe('test');
      });
    });

    describe('RFC 4180 special character escaping', () => {
      it('quotes a field containing a comma', () => {
        expect(escapeCsvField('hello,world')).toBe('"hello,world"');
        expect(escapeCsvField('one, two, three')).toBe('"one, two, three"');
      });

      it('quotes a field containing double quotes and doubles internal quotes', () => {
        expect(escapeCsvField('say "hello"')).toBe('"say ""hello"""');
        expect(escapeCsvField('"quoted"')).toBe('"""quoted"""');
        expect(escapeCsvField('""')).toBe('""""""');
      });

      it('quotes a field containing line feeds (\\n)', () => {
        expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"');
      });

      it('quotes a field containing carriage returns (\\r)', () => {
        expect(escapeCsvField('line1\r\nline2')).toBe('"line1\r\nline2"');
      });

      it('escapes complex fields containing commas, quotes, and newlines together', () => {
        const input = 'line1, with "quotes"\nline2, with "more quotes"';
        const escaped = escapeCsvField(input);
        expect(escaped).toBe('"line1, with ""quotes""\nline2, with ""more quotes"""');

        const parsed = parseCsvRow(escaped);
        expect(parsed[0]).toBe(input);
      });
    });

    describe('OWASP formula injection prevention', () => {
      it('neutralizes fields starting with =', () => {
        const input = '=SUM(A1:A10)';
        const escaped = escapeCsvField(input);
        expect(escaped).toBe('"\t=SUM(A1:A10)"');
        const parsed = parseCsvRow(escaped);
        expect(parsed[0]).toBe('\t=SUM(A1:A10)');
      });

      it('neutralizes fields starting with +', () => {
        const input = '+cmd|\' /C calc\'!A0';
        const escaped = escapeCsvField(input);
        expect(escaped).toBe('"\t+cmd|\' /C calc\'!A0"');
        const parsed = parseCsvRow(escaped);
        expect(parsed[0]).toBe('\t+cmd|\' /C calc\'!A0');
      });

      it('neutralizes fields starting with -', () => {
        const input = '-5+10';
        const escaped = escapeCsvField(input);
        expect(escaped).toBe('"\t-5+10"');
        const parsed = parseCsvRow(escaped);
        expect(parsed[0]).toBe('\t-5+10');
      });

      it('neutralizes fields starting with @', () => {
        const input = '@SUM(1,2)';
        const escaped = escapeCsvField(input);
        expect(escaped).toBe('"\t@SUM(1,2)"');
        const parsed = parseCsvRow(escaped);
        expect(parsed[0]).toBe('\t@SUM(1,2)');
      });

      it('neutralizes fields starting with \\t or \\r', () => {
        expect(escapeCsvField('\tleadingTab')).toBe('"\t\tleadingTab"');
        expect(escapeCsvField('\rleadingCr')).toBe('"\t\rleadingCr"');
      });

      it('does not alter normal fields where trigger character appears in the middle', () => {
        expect(escapeCsvField('apple=banana')).toBe('apple=banana');
        expect(escapeCsvField('user@example.com')).toBe('user@example.com');
        expect(escapeCsvField('positive+negative')).toBe('positive+negative');
        expect(escapeCsvField('item-one')).toBe('item-one');
      });

      it('handles formula injection combined with quotes, commas, and newlines', () => {
        const input = '=CMD("calc.exe", 1)\n+more';
        const escaped = escapeCsvField(input);
        expect(escaped).toBe('"\t=CMD(""calc.exe"", 1)\n+more"');
        const parsed = parseCsvRow(escaped);
        expect(parsed[0]).toBe('\t=CMD("calc.exe", 1)\n+more');
      });

      it('correctly tests formula triggers using CSV_FORMULA_TRIGGER regex', () => {
        expect(CSV_FORMULA_TRIGGER.test('=SUM')).toBe(true);
        expect(CSV_FORMULA_TRIGGER.test('+1')).toBe(true);
        expect(CSV_FORMULA_TRIGGER.test('-1')).toBe(true);
        expect(CSV_FORMULA_TRIGGER.test('@NAME')).toBe(true);
        expect(CSV_FORMULA_TRIGGER.test('\ttab')).toBe(true);
        expect(CSV_FORMULA_TRIGGER.test('\rcarriage')).toBe(true);
        expect(CSV_FORMULA_TRIGGER.test('normal')).toBe(false);
      });
    });
  });

  describe('formatCsvRow', () => {
    it('formats a simple row of safe strings', () => {
      const row = formatCsvRow(['col1', 'col2', 'col3']);
      expect(row).toBe('col1,col2,col3');
    });

    it('formats mixed fields with escaping and formula neutralization', () => {
      const fields = [
        'id_123',
        '=2+2',
        'hello, world',
        'say "hi"',
        42,
        null,
      ];
      const line = formatCsvRow(fields);
      expect(line).toBe('id_123,"\t=2+2","hello, world","say ""hi""",42,');

      const parsed = parseCsvRow(line);
      expect(parsed).toEqual([
        'id_123',
        '\t=2+2',
        'hello, world',
        'say "hi"',
        '42',
        '',
      ]);
    });

    it('formats payment export rows correctly', () => {
      const payment = [
        'tx_abc123',
        'contact_unlock',
        '25.0',
        'player_456',
        'pro',
        '0xfeedbeef',
        '2026-10-09T08:00:00.000Z',
      ];
      const line = formatCsvRow(payment);
      expect(line).toBe(
        'tx_abc123,contact_unlock,25.0,player_456,pro,0xfeedbeef,2026-10-09T08:00:00.000Z',
      );
    });
  });
});
