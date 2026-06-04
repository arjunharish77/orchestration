export type CsvParseResult = {
  headers: string[];
  rows: Record<string, string>[];
};

export function parseCsv(content: string): CsvParseResult {
  const records = parseCsvRecords(content);
  if (records.length === 0) return { headers: [], rows: [] };

  const headers = records[0].map(normalizeHeader);
  const rows = records.slice(1).filter((record) => record.some((cell) => cell.trim() !== '')).map((record) => {
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = record[index]?.trim() ?? '';
    });
    return row;
  });

  return { headers, rows };
}

export function stringifyCsv(rows: Record<string, unknown>[]) {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];

  for (const row of rows) {
    lines.push(headers.map((header) => escapeCsvCell(row[header])).join(','));
  }

  return `${lines.join('\n')}\n`;
}

export function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}

function parseCsvRecords(content: string) {
  const records: string[][] = [];
  let current = '';
  let record: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      record.push(current);
      current = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1;
      record.push(current);
      records.push(record);
      record = [];
      current = '';
      continue;
    }

    current += char;
  }

  if (current.length > 0 || record.length > 0) {
    record.push(current);
    records.push(record);
  }

  return records;
}

function escapeCsvCell(value: unknown) {
  const text = value === null || value === undefined ? '' : String(value);
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}
