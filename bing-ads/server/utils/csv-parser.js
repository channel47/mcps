import { inflateRawSync } from 'node:zlib';

export function parseCsvRows(csvText, { maxRows = Number.POSITIVE_INFINITY } = {}) {
  const rowLimit = (
    typeof maxRows === 'number'
    && Number.isFinite(maxRows)
    && maxRows > 0
  )
    ? Math.floor(maxRows)
    : Number.POSITIVE_INFINITY;

  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  const pushRow = () => {
    row.push(field);
    field = '';
    if (row.length === 1 && row[0] === '') {
      row = [];
      return false;
    }

    rows.push(row);
    row = [];
    return rows.length >= rowLimit;
  };

  for (let i = 0; i < csvText.length; i += 1) {
    const char = csvText[i];

    if (char === '"') {
      if (inQuotes && csvText[i + 1] === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(field);
      field = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && csvText[i + 1] === '\n') {
        i += 1;
      }
      if (pushRow()) {
        return rows;
      }
      continue;
    }

    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    pushRow();
  }

  return rows;
}

export function parseCsv(csvText, { limit = 100 } = {}) {
  const normalized = String(csvText || '').replace(/^\uFEFF/, '');
  const normalizedLimit = (
    typeof limit === 'number'
    && Number.isFinite(limit)
    && limit >= 0
  )
    ? Math.trunc(limit)
    : null;

  if (normalizedLimit === 0) {
    return [];
  }

  const maxRows = normalizedLimit === null ? undefined : normalizedLimit + 1;
  const rows = parseCsvRows(
    normalized,
    maxRows === undefined ? undefined : { maxRows }
  );

  if (rows.length === 0) {
    return [];
  }

  const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
  const headers = rows[0];
  const result = rows.slice(1).map((row) => {
    const item = Object.create(null);
    headers.forEach((header, index) => {
      if (!DANGEROUS_KEYS.has(header)) {
        item[header] = row[index] ?? '';
      }
    });
    return item;
  });

  return result;
}

function findEndOfCentralDirectory(buffer) {
  for (let i = buffer.length - 22; i >= 0; i -= 1) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      return i;
    }
  }
  throw new Error('Invalid ZIP archive: end of central directory not found');
}

export function extractCsvFromZip(zipInput) {
  const zip = Buffer.isBuffer(zipInput) ? zipInput : Buffer.from(zipInput);
  const eocdOffset = findEndOfCentralDirectory(zip);
  const entryCount = zip.readUInt16LE(eocdOffset + 10);
  const centralDirectoryOffset = zip.readUInt32LE(eocdOffset + 16);

  if (entryCount < 1) {
    throw new Error('ZIP archive does not contain any files');
  }

  if (zip.readUInt32LE(centralDirectoryOffset) !== 0x02014b50) {
    throw new Error('Invalid ZIP archive: central directory header missing');
  }

  const compressionMethod = zip.readUInt16LE(centralDirectoryOffset + 10);
  const compressedSize = zip.readUInt32LE(centralDirectoryOffset + 20);
  const fileNameLength = zip.readUInt16LE(centralDirectoryOffset + 28);
  const localHeaderOffset = zip.readUInt32LE(centralDirectoryOffset + 42);

  if (zip.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
    throw new Error('Invalid ZIP archive: local file header missing');
  }

  const localFileNameLength = zip.readUInt16LE(localHeaderOffset + 26);
  const localExtraLength = zip.readUInt16LE(localHeaderOffset + 28);
  const dataStart = localHeaderOffset + 30 + localFileNameLength + localExtraLength;
  const dataEnd = dataStart + compressedSize;
  const compressedData = zip.subarray(dataStart, dataEnd);

  let contentBuffer;
  if (compressionMethod === 0) {
    contentBuffer = compressedData;
  } else if (compressionMethod === 8) {
    contentBuffer = inflateRawSync(compressedData, { maxOutputLength: 50 * 1024 * 1024 });
  } else {
    throw new Error(`Unsupported ZIP compression method: ${compressionMethod}`);
  }

  const filenameStart = centralDirectoryOffset + 46;
  const filename = zip.toString('utf8', filenameStart, filenameStart + fileNameLength).trim();
  if (filename && !filename.toLowerCase().endsWith('.csv')) {
    throw new Error(`Expected CSV file in ZIP archive, got: ${filename}`);
  }

  return contentBuffer.toString('utf8').replace(/^\uFEFF/, '');
}
