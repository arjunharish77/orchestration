import { Job } from 'bullmq';
import { Prisma } from '@prisma/client';
import { readFile } from 'fs/promises';
import { activityTypeCodes, prisma, systemActor } from '../context';
import { normalizeTenDigitPhone, toJson } from '../utils';

const requiredColumns = ['customer_name', 'mobile_number', 'loan_id', 'branch_code', 'loan_offer_amount', 'upload_date', 'offer_expiry_date'];

const mandatoryFieldToUploadColumn: Record<string, string> = {
  customerName: 'customer_name',
  mobile: 'mobile_number',
  externalLeadId: 'loan_id',
  branchCode: 'branch_code',
  branchName: 'branch_name',
  offerAmount: 'loan_offer_amount',
  emiAmount: 'emi_amount',
  uploadDate: 'upload_date',
  offerExpiryDate: 'offer_expiry_date',
  location: 'customer_location',
  customerLocation: 'customer_location',
  preferredLanguage: 'preferred_language',
  partnerMapping: 'partner_mapping'
};

const optionalColumnAliases: Record<string, string[]> = {
  loan_id: ['lead_id', 'loan_id_lead_id'],
  offer_expiry_date: ['loan_closure', 'loan_closure_offer_expiry_date'],
  customer_location: ['location'],
  partner_mapping: ['partner']
};

const uploadColumns = [
  ...requiredColumns,
  'branch_name',
  'emi_amount',
  'customer_location',
  'preferred_language',
  'partner_mapping'
];

const defaultCsvMaxRows = 50000;

type NormalizedLeadUploadRow = {
  customerName: string;
  mobile: string | null;
  externalLeadId: string;
  branchCode: string;
  branchName: string;
  offerAmount: string;
  emiAmount: string;
  uploadDate: string;
  offerExpiryDate: string;
  customerLocation: string;
  preferredLanguage: string;
  partnerMapping: string;
};

type ExistingLeadKey = { id: string; mobile: string; externalLeadId: string | null; sourceBatchId: string | null };

type CsvParseResult = {
  headers: string[];
  rows: Record<string, string>[];
};

export async function processLeadUpload(job: Job<{ batchId: string; actor?: string; columnMapping?: Record<string, string> }>) {
  const { batchId, actor = systemActor, columnMapping = {} } = job.data;
  const batch = await prisma.leadUploadBatch.findUnique({ where: { id: batchId } });
  if (!batch) throw new Error(`Upload batch not found: ${batchId}`);
  if (!batch.originalFilePath) throw new Error(`Upload CSV file not found for batch: ${batchId}`);

  await prisma.leadUploadBatch.update({
    where: { id: batchId },
    data: { status: 'processing', validRows: 0, invalidRows: 0, importedRows: 0 }
  });
  await prisma.leadUploadRow.deleteMany({ where: { batchId } });

  const csvText = await readFile(batch.originalFilePath, 'utf8');
  const parsed = applyColumnMapping(parseCsv(csvText), columnMapping);
  assertCsvRowCount(parsed.rows.length);
  const activeRequiredColumns = await uploadRequiredColumns();
  const missingColumns = activeRequiredColumns.filter((column) => !hasColumn(parsed.headers, column));
  if (missingColumns.length > 0) {
    await prisma.leadUploadBatch.update({ where: { id: batchId }, data: { status: 'failed' } });
    throw new Error(`Missing required CSV columns: ${missingColumns.join(', ')}`);
  }
  const normalizedRows = parsed.rows.map((row) => normalizeLeadRow(row));
  const uploadContext = await buildUploadContext(normalizedRows);
  const seenKeys = newSeenUploadKeys();

  let validRows = 0;
  let invalidRows = 0;
  let importedRows = 0;

  for (const [index, row] of parsed.rows.entries()) {
    const rowNumber = index + 2;
    const normalized = normalizedRows[index];
    const validationError = validateLeadRow(normalized, activeRequiredColumns) ?? validateFileDuplicate(normalized, seenKeys);
    const existingLead = findDuplicateLeadFromContext(normalized, uploadContext);

    if (validationError) {
      invalidRows += 1;
      await createUploadRow(batchId, rowNumber, row, normalized, 'invalid', validationError);
      await updateUploadProgress(batchId, validRows, invalidRows, importedRows);
      await job.updateProgress(Math.round(((index + 1) / parsed.rows.length) * 100));
      continue;
    }

    if (existingLead?.sourceBatchId === batchId) {
      validRows += 1;
      importedRows += 1;
      await createUploadRow(batchId, rowNumber, row, { ...normalized, leadId: existingLead.id }, 'imported');
      await updateUploadProgress(batchId, validRows, invalidRows, importedRows);
      await job.updateProgress(Math.round(((index + 1) / parsed.rows.length) * 100));
      continue;
    }

    if (existingLead) {
      invalidRows += 1;
      await createUploadRow(batchId, rowNumber, row, normalized, 'duplicate', 'Duplicate lead mobile or lead id');
      await updateUploadProgress(batchId, validRows, invalidRows, importedRows);
      await job.updateProgress(Math.round(((index + 1) / parsed.rows.length) * 100));
      continue;
    }

    const team = normalized.branchCode ? uploadContext.teamByCode.get(normalized.branchCode) : null;
    if (!team) {
      invalidRows += 1;
      await createUploadRow(batchId, rowNumber, row, normalized, 'invalid', 'branch_code is not mapped to an active team');
      await updateUploadProgress(batchId, validRows, invalidRows, importedRows);
      await job.updateProgress(Math.round(((index + 1) / parsed.rows.length) * 100));
      continue;
    }

    validRows += 1;
    const lead = await prisma.$transaction(async (tx) => {
      const created = await tx.lead.create({
        data: {
          sourceBatchId: batchId,
          externalLeadId: normalized.externalLeadId,
          customerName: normalized.customerName,
          mobile: normalized.mobile as string,
          branchCode: normalized.branchCode,
          branchName: normalized.branchName,
          teamId: team.id,
          offerAmount: normalized.offerAmount,
          emiAmount: normalized.emiAmount,
          uploadDate: parseUploadDate(normalized.uploadDate) ?? undefined,
          offerExpiryDate: parseUploadDate(normalized.offerExpiryDate) ?? undefined,
          location: normalized.customerLocation,
          preferredLanguage: normalized.preferredLanguage,
          partnerMapping: normalized.partnerMapping || undefined,
          status: 'Valid',
          category: null,
          createdBy: actor,
          updatedBy: actor
        }
      });
      await tx.activity.create({
        data: {
          leadId: created.id,
          type: activityTypeCodes.upload,
          title: 'Lead imported from CSV',
          metadata: { batchId, fileName: batch.fileName },
          createdBy: actor
        }
      });
      return created;
    });
    rememberImportedLead(uploadContext, lead);

    importedRows += 1;
    await createUploadRow(batchId, rowNumber, row, { ...normalized, leadId: lead.id }, 'imported');
    await updateUploadProgress(batchId, validRows, invalidRows, importedRows);
    await job.updateProgress(Math.round(((index + 1) / parsed.rows.length) * 100));
  }

  const finalStatus = invalidRows > 0 ? 'completed_with_errors' : 'completed';
  await prisma.leadUploadBatch.update({
    where: { id: batchId },
    data: { status: finalStatus, validRows, invalidRows, importedRows }
  });
  await prisma.auditLog.create({
    data: {
      moduleName: 'LeadUpload',
      entityId: batchId,
      action: 'process_csv',
      newValue: { fileName: batch.fileName, totalRows: parsed.rows.length, validRows, invalidRows, importedRows, status: finalStatus },
      changedBy: actor
    }
  });

  return { ok: true, batchId, validRows, invalidRows, importedRows, status: finalStatus };
}

function updateUploadProgress(batchId: string, validRows: number, invalidRows: number, importedRows: number) {
  return prisma.leadUploadBatch.update({ where: { id: batchId }, data: { validRows, invalidRows, importedRows } });
}

function normalizeLeadRow(row: Record<string, string>) {
  return {
    customerName: getColumn(row, 'customer_name'),
    mobile: normalizeTenDigitPhone(getColumn(row, 'mobile_number')),
    externalLeadId: getColumn(row, 'loan_id'),
    branchCode: getColumn(row, 'branch_code'),
    branchName: getColumn(row, 'branch_name'),
    offerAmount: getColumn(row, 'loan_offer_amount'),
    emiAmount: getColumn(row, 'emi_amount'),
    uploadDate: getColumn(row, 'upload_date'),
    offerExpiryDate: getColumn(row, 'offer_expiry_date'),
    customerLocation: getColumn(row, 'customer_location'),
    preferredLanguage: getColumn(row, 'preferred_language'),
    partnerMapping: getColumn(row, 'partner_mapping')
  };
}

function validateLeadRow(row: NormalizedLeadUploadRow, activeRequiredColumns = requiredColumns) {
  const valueByColumn: Record<string, unknown> = {
    customer_name: row.customerName,
    mobile_number: row.mobile,
    loan_id: row.externalLeadId,
    branch_code: row.branchCode,
    branch_name: row.branchName,
    loan_offer_amount: row.offerAmount,
    emi_amount: row.emiAmount,
    upload_date: row.uploadDate,
    offer_expiry_date: row.offerExpiryDate,
    customer_location: row.customerLocation,
    preferred_language: row.preferredLanguage,
    partner_mapping: row.partnerMapping
  };
  for (const column of activeRequiredColumns) {
    if (!String(valueByColumn[column] ?? '').trim()) {
      if (column === 'mobile_number') return 'mobile_number must be exactly 10 digits';
      if (column === 'loan_id') return 'loan_id / lead_id is required';
      return `${column} is required`;
    }
  }
  if (row.offerAmount && Number.isNaN(Number(row.offerAmount))) return 'loan_offer_amount must be numeric';
  if (row.emiAmount && Number.isNaN(Number(row.emiAmount))) return 'emi_amount must be numeric';
  if (row.uploadDate && !parseUploadDate(row.uploadDate)) return 'upload_date must be a valid date';
  if (row.offerExpiryDate && !parseUploadDate(row.offerExpiryDate)) return 'offer_expiry_date must be a valid date';
  return null;
}

async function uploadRequiredColumns() {
  const rules = await prisma.fieldMandatoryRule.findMany({
    where: {
      moduleName: 'Lead',
      isRequired: true,
      isActive: true,
      OR: [{ context: null }, { context: '' }, { context: 'upload' }, { context: 'csv' }, { context: 'create' }]
    }
  });
  const configured = rules.map((rule) => mandatoryFieldToUploadColumn[rule.fieldKey]).filter(Boolean);
  return Array.from(new Set([...requiredColumns, ...configured]));
}

function createUploadRow(batchId: string, rowNumber: number, rawData: Record<string, string>, normalizedData: Record<string, unknown>, uploadStatus: string, errorMessage?: string) {
  return prisma.leadUploadRow.create({
    data: {
      batchId,
      rowNumber,
      rawData: rawData as Prisma.InputJsonValue,
      normalizedData: normalizedData as Prisma.InputJsonValue,
      uploadStatus,
      errorMessage,
      leadId: typeof normalizedData.leadId === 'string' ? normalizedData.leadId : undefined
    }
  });
}

function assertCsvRowCount(rowCount: number) {
  if (rowCount === 0) throw new Error('CSV file has no lead rows');
  const maxRows = csvMaxRows();
  if (rowCount > maxRows) throw new Error(`CSV file has too many rows. Maximum allowed rows: ${maxRows}.`);
}

function csvMaxRows() {
  const raw = Number(process.env.CSV_MAX_ROWS ?? defaultCsvMaxRows);
  return Number.isFinite(raw) && raw > 0 ? raw : defaultCsvMaxRows;
}

async function buildUploadContext(rows: NormalizedLeadUploadRow[]) {
  const mobiles = uniqueStrings(rows.map((row) => row.mobile));
  const externalLeadIds = uniqueStrings(rows.map((row) => row.externalLeadId));
  const branchCodes = uniqueStrings(rows.map((row) => row.branchCode));
  const [existingLeads, teams] = await Promise.all([
    prisma.lead.findMany({
      where: mobiles.length || externalLeadIds.length
        ? {
            OR: [
              ...(mobiles.length ? [{ mobile: { in: mobiles } }] : []),
              ...(externalLeadIds.length ? [{ externalLeadId: { in: externalLeadIds } }] : [])
            ]
          }
        : { id: '__none__' },
      select: { id: true, mobile: true, externalLeadId: true, sourceBatchId: true }
    }),
    prisma.team.findMany({
      where: { code: { in: branchCodes }, isActive: true },
      select: { id: true, code: true }
    })
  ]);
  return {
    leadByMobile: new Map(existingLeads.map((lead) => [lead.mobile, lead])),
    leadByExternalId: new Map(existingLeads.filter((lead) => lead.externalLeadId).map((lead) => [lead.externalLeadId as string, lead])),
    teamByCode: new Map(teams.filter((team) => team.code).map((team) => [team.code as string, team]))
  };
}

function findDuplicateLeadFromContext(row: NormalizedLeadUploadRow, context: Awaited<ReturnType<typeof buildUploadContext>>) {
  return (row.mobile ? context.leadByMobile.get(row.mobile) : undefined) ?? (row.externalLeadId ? context.leadByExternalId.get(row.externalLeadId) : undefined) ?? null;
}

function rememberImportedLead(context: Awaited<ReturnType<typeof buildUploadContext>>, lead: ExistingLeadKey) {
  context.leadByMobile.set(lead.mobile, lead);
  if (lead.externalLeadId) context.leadByExternalId.set(lead.externalLeadId, lead);
}

function newSeenUploadKeys() {
  return { mobiles: new Set<string>(), externalLeadIds: new Set<string>() };
}

function validateFileDuplicate(row: NormalizedLeadUploadRow, seen: ReturnType<typeof newSeenUploadKeys>) {
  if (row.mobile) {
    if (seen.mobiles.has(row.mobile)) return 'Duplicate mobile number within uploaded CSV';
    seen.mobiles.add(row.mobile);
  }
  if (row.externalLeadId) {
    if (seen.externalLeadIds.has(row.externalLeadId)) return 'Duplicate loan_id / lead_id within uploaded CSV';
    seen.externalLeadIds.add(row.externalLeadId);
  }
  return null;
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))));
}

function parseUploadDate(value?: string | null) {
  const text = value?.trim();
  if (!text) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (iso) return validDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const indian = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(text);
  if (indian) return validDate(Number(indian[3]), Number(indian[2]), Number(indian[1]));
  return null;
}

function validDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

function parseCsv(content: string): CsvParseResult {
  const records = parseCsvRecords(content);
  if (records.length === 0) return { headers: [], rows: [] };
  const headers = records[0].map(normalizeHeader);
  const rows = records.slice(1).filter((record) => record.some((cell) => cell.trim() !== '')).map((record) => {
    const row: Record<string, string> = {};
    headers.forEach((header, index) => { row[header] = record[index]?.trim() ?? ''; });
    return row;
  });
  return { headers, rows };
}

function parseCsvRecords(content: string) {
  const records: string[][] = [];
  let current = '';
  let record: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1];
    if (char === '"' && inQuotes && next === '"') { current += '"'; index += 1; continue; }
    if (char === '"') { inQuotes = !inQuotes; continue; }
    if (char === ',' && !inQuotes) { record.push(current); current = ''; continue; }
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
  if (current.length > 0 || record.length > 0) { record.push(current); records.push(record); }
  return records;
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}

function hasColumn(headers: string[], column: string) {
  return headers.includes(column) || (optionalColumnAliases[column] ?? []).some((alias) => headers.includes(alias));
}

function getColumn(row: Record<string, string>, column: string) {
  const aliases = [column, ...(optionalColumnAliases[column] ?? [])];
  for (const alias of aliases) {
    if (row[alias]) return row[alias];
  }
  return '';
}

function applyColumnMapping(parsed: CsvParseResult, mapping: Record<string, string>) {
  const activeMappings = Object.entries(mapping)
    .filter(([target, source]) => uploadColumns.includes(target) && typeof source === 'string' && source.trim());
  if (activeMappings.length === 0) return parsed;
  const mappedHeaders = new Set(parsed.headers);
  activeMappings.forEach(([target]) => mappedHeaders.add(target));
  return {
    headers: Array.from(mappedHeaders),
    rows: parsed.rows.map((row) => {
      const nextRow = { ...row };
      for (const [target, source] of activeMappings) { nextRow[target] = row[source] ?? ''; }
      return nextRow;
    })
  };
}
