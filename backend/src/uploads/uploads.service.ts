import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Queue } from 'bullmq';
import { mkdir, readFile, writeFile } from 'fs/promises';
import IORedis from 'ioredis';
import { join } from 'path';
import { AuditService } from '../audit/audit.service';
import { activityTypeCodes } from '../activities/activity-types';
import { AccessService } from '../access/access.service';
import { requiredEnv } from '../common/env';
import { toJsonValue } from '../common/json';
import { normalizeTenDigitPhone } from '../common/phone';
import { CustomFieldsService } from '../custom-fields/custom-fields.service';
import { PrismaService } from '../prisma/prisma.service';
import { parseCsv, stringifyCsv } from './csv';

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
const defaultCsvMaxFileBytes = 25 * 1024 * 1024;
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
  customFields: Record<string, string>;
};
type ExistingLeadKey = {
  id: string;
  mobile: string;
  externalLeadId: string | null;
  customerName?: string | null;
  branchCode?: string | null;
  branchName?: string | null;
  customValues?: Array<{ field: { fieldKey: string }; value: unknown }>;
  sourceBatchId: string | null;
};
type CsvUploadConfig = {
  requiredColumns: string[];
  duplicateKeyFields: string[];
  defaultMapping: Record<string, string>;
};

@Injectable()
export class UploadsService {
  private readonly uploadQueue: Queue;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly customFields: CustomFieldsService,
    private readonly access: AccessService
  ) {
    const connection = new IORedis(requiredEnv('REDIS_URL', 'redis://localhost:6379'), {
      maxRetriesPerRequest: null
    });
    this.uploadQueue = new Queue('lead-upload', {
      connection,
      defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 10_000 } }
    });
  }

  async list(actor = 'system') {
    const where = await this.uploadBatchAccessWhere(actor);
    return this.prisma.leadUploadBatch.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100
    });
  }

  async get(id: string, actor = 'system') {
    const upload = await this.prisma.leadUploadBatch.findUnique({
      where: { id },
      include: {
        rows: {
          orderBy: { rowNumber: 'asc' },
          take: 500
        }
      }
    });

    if (!upload) {
      throw new NotFoundException('Upload batch not found');
    }
    await this.assertUploadBatchVisible(upload, actor);

    return upload;
  }

  async processCsv(file: { originalname?: string; buffer?: Buffer; mimetype?: string }, actor = 'system', columnMappingInput?: string | Record<string, string>) {
    if (!file?.buffer) {
      throw new BadRequestException('CSV file is required');
    }

    const fileName = file.originalname ?? `lead-upload-${Date.now()}.csv`;
    this.assertCsvFile(file, fileName);

    const csvText = file.buffer.toString('utf8');
    const parsed = this.applyColumnMapping(parseCsv(csvText), this.parseColumnMapping(columnMappingInput));
    this.assertCsvRowCount(parsed.rows.length);
    const csvConfig = await this.csvUploadConfig();
    const activeRequiredColumns = await this.uploadRequiredColumns(csvConfig);
    const missingColumns = activeRequiredColumns.filter((column) => !hasColumn(parsed.headers, column));
    if (missingColumns.length > 0) {
      throw new BadRequestException(`Missing required CSV columns: ${missingColumns.join(', ')}`);
    }
    const normalizedRows = parsed.rows.map((row) => this.normalizeLeadRow(row));
    const uploadContext = await this.buildUploadContext(normalizedRows, csvConfig.duplicateKeyFields);
    const seenKeys = new Set<string>();

    const batch = await this.prisma.leadUploadBatch.create({
      data: {
        fileName,
        status: 'processing',
        totalRows: parsed.rows.length,
        uploadedBy: actor
      }
    });

    const uploadPath = await this.persistUploadedCsv(batch.id, fileName, csvText);
    await this.recordUploadedFile(fileName, uploadPath, actor);

    let validRows = 0;
    let invalidRows = 0;
    let importedRows = 0;
    const resultRows: Record<string, unknown>[] = [];

    for (const [index, row] of parsed.rows.entries()) {
      const rowNumber = index + 2;
      const normalized = normalizedRows[index];
      const validationError = this.validateLeadRow(normalized, activeRequiredColumns) ?? this.validateDuplicateKeyBlank(normalized, csvConfig.duplicateKeyFields) ?? this.validateFileDuplicate(normalized, seenKeys, csvConfig.duplicateKeyFields);
      const existingLead = this.findDuplicateLeadFromContext(normalized, uploadContext, csvConfig.duplicateKeyFields);

      if (validationError) {
        invalidRows += 1;
        await this.createUploadRow(batch.id, rowNumber, row, normalized, 'invalid', validationError);
        resultRows.push({ ...row, upload_status: 'invalid', upload_error: validationError });
        continue;
      }

      if (existingLead?.sourceBatchId === batch.id) {
        validRows += 1;
        importedRows += 1;
        await this.createUploadRow(batch.id, rowNumber, row, { ...normalized, leadId: existingLead.id }, 'imported');
        resultRows.push({ ...row, upload_status: 'imported', upload_error: '' });
        continue;
      }

      if (existingLead) {
        invalidRows += 1;
        const duplicateMessage = `Duplicate lead by ${csvConfig.duplicateKeyFields.map(humanizeLeadField).join(' + ')}`;
        await this.createUploadRow(batch.id, rowNumber, row, normalized, 'duplicate', duplicateMessage);
        resultRows.push({ ...row, upload_status: 'duplicate', upload_error: duplicateMessage });
        continue;
      }

      const team = normalized.branchCode ? uploadContext.teamByCode.get(normalized.branchCode) : null;

      if (!team) {
        invalidRows += 1;
        await this.createUploadRow(batch.id, rowNumber, row, normalized, 'invalid', 'branch_code is not mapped to an active team');
        resultRows.push({ ...row, upload_status: 'invalid', upload_error: 'branch_code is not mapped to an active team' });
        continue;
      }

      validRows += 1;
      const lead = await this.prisma.lead.create({
        data: {
          sourceBatchId: batch.id,
          externalLeadId: normalized.externalLeadId,
          customerName: normalized.customerName,
          mobile: normalized.mobile as string,
          branchCode: normalized.branchCode,
          branchName: normalized.branchName,
          teamId: team?.id,
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
      if (Object.keys(normalized.customFields).length > 0) {
        await this.customFields.upsertValues('Lead', lead.id, { values: normalized.customFields });
      }
      this.rememberImportedLead(uploadContext, lead);

      importedRows += 1;
      await this.createUploadRow(batch.id, rowNumber, row, { ...normalized, leadId: lead.id }, 'imported');
      await Promise.all([
        this.prisma.activity.create({
          data: {
            leadId: lead.id,
            type: activityTypeCodes.system,
            title: 'Lead created',
            metadata: { source: 'csv' },
            createdBy: actor
          }
        }),
        this.audit.write({
          moduleName: 'Lead',
          entityId: lead.id,
          action: 'create',
          newValue: lead,
          changedBy: actor
        })
      ]);
      resultRows.push({ ...row, upload_status: 'imported', upload_error: '' });
    }

    const finalStatus = invalidRows > 0 ? 'completed_with_errors' : 'completed';
    const updatedBatch = await this.prisma.leadUploadBatch.update({
      where: { id: batch.id },
      data: {
        originalFilePath: uploadPath,
        status: finalStatus,
        validRows,
        invalidRows,
        importedRows
      }
    });

    return {
      batch: updatedBatch,
      resultCsv: stringifyCsv(resultRows)
    };
  }

  async enqueueCsv(file: { originalname?: string; buffer?: Buffer; mimetype?: string }, actor = 'system', columnMappingInput?: string | Record<string, string>) {
    if (!file?.buffer) {
      throw new BadRequestException('CSV file is required');
    }

    const fileName = file.originalname ?? `lead-upload-${Date.now()}.csv`;
    this.assertCsvFile(file, fileName);

    const csvText = file.buffer.toString('utf8');
    const parsed = this.applyColumnMapping(parseCsv(csvText), this.parseColumnMapping(columnMappingInput));
    this.assertCsvRowCount(parsed.rows.length);
    const csvConfig = await this.csvUploadConfig();
    const activeRequiredColumns = await this.uploadRequiredColumns(csvConfig);
    const missingColumns = activeRequiredColumns.filter((column) => !hasColumn(parsed.headers, column));
    if (missingColumns.length > 0) {
      throw new BadRequestException(`Missing required CSV columns: ${missingColumns.join(', ')}`);
    }

    const batch = await this.prisma.leadUploadBatch.create({
      data: {
        fileName,
        status: 'queued',
        totalRows: parsed.rows.length,
        uploadedBy: actor
      }
    });
    const uploadPath = await this.persistUploadedCsv(batch.id, fileName, csvText);
    await this.recordUploadedFile(fileName, uploadPath, actor);
    const updatedBatch = await this.prisma.leadUploadBatch.update({
      where: { id: batch.id },
      data: { originalFilePath: uploadPath }
    });

    const job = await this.uploadQueue.add(
      'lead-upload.process',
      {
        batchId: batch.id,
        actor,
        columnMapping: this.parseColumnMapping(columnMappingInput)
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 10_000 },
        removeOnComplete: 100,
        removeOnFail: 100
      }
    );

    return {
      batch: updatedBatch,
      queueJobId: job.id,
      queued: true
    };
  }

  async resultCsv(id: string, actor = 'system') {
    const upload = await this.prisma.leadUploadBatch.findUnique({
      where: { id },
      include: {
        rows: {
          orderBy: { rowNumber: 'asc' }
        }
      }
    });

    if (!upload) {
      throw new NotFoundException('Upload batch not found');
    }
    await this.assertUploadBatchVisible(upload, actor);

    const rows = upload.rows.map((row) => ({
      ...(row.rawData as Record<string, unknown>),
      upload_status: row.uploadStatus,
      upload_error: row.errorMessage ?? ''
    }));

    return stringifyCsv(rows);
  }

  async originalCsv(id: string, actor = 'system') {
    const upload = await this.prisma.leadUploadBatch.findUnique({ where: { id } });
    if (!upload) throw new NotFoundException('Upload batch not found');
    await this.assertUploadBatchVisible(upload, actor);
    if (!upload.originalFilePath) throw new NotFoundException('Original uploaded CSV not found');
    return readFile(upload.originalFilePath, 'utf8');
  }

  private async uploadBatchAccessWhere(actor: string): Promise<Prisma.LeadUploadBatchWhereInput> {
    if (actor === 'system' || actor === 'system@unnatify.local') return {};
    const effective = await this.access.effectivePermissions(actor);
    if (this.access.hasLeadAllScope(effective)) return {};
    return { uploadedBy: actor };
  }

  private async assertUploadBatchVisible(upload: { uploadedBy: string | null }, actor: string) {
    const where = await this.uploadBatchAccessWhere(actor);
    if (!where.uploadedBy || upload.uploadedBy === actor) return;
    throw new ForbiddenException('Upload batch is outside your assigned scope');
  }

  private normalizeLeadRow(row: Record<string, string>) {
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
      partnerMapping: getColumn(row, 'partner_mapping'),
      customFields: Object.fromEntries(
        Object.entries(row)
          .filter(([key]) => key.startsWith('custom:'))
          .map(([key, value]) => [key.slice('custom:'.length), value])
      )
    };
  }

  private validateLeadRow(row: ReturnType<UploadsService['normalizeLeadRow']>, activeRequiredColumns = requiredColumns) {
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

  private async uploadRequiredColumns(csvConfig?: CsvUploadConfig) {
    const rules = await this.prisma.fieldMandatoryRule.findMany({
      where: {
        moduleName: 'Lead',
        isRequired: true,
        isActive: true,
        OR: [{ context: null }, { context: '' }, { context: 'upload' }, { context: 'csv' }, { context: 'create' }]
      }
    });
    const configured = rules.map((rule) => mandatoryFieldToUploadColumn[rule.fieldKey]).filter(Boolean);
    return Array.from(new Set([...(csvConfig?.requiredColumns ?? requiredColumns), ...configured]));
  }

  private createUploadRow(batchId: string, rowNumber: number, rawData: Record<string, string>, normalizedData: Record<string, unknown>, uploadStatus: string, errorMessage?: string) {
    return this.prisma.leadUploadRow.create({
      data: {
        batchId,
        rowNumber,
        rawData: toJsonValue(rawData),
        normalizedData: toJsonValue(normalizedData),
        uploadStatus,
        errorMessage,
        leadId: typeof normalizedData.leadId === 'string' ? normalizedData.leadId : undefined
      }
    });
  }

  private async persistUploadedCsv(batchId: string, fileName: string, csvText: string) {
    const uploadDir = process.env.UPLOAD_DIR ?? join(process.cwd(), '..', 'uploads', 'lead-csv');
    await mkdir(uploadDir, { recursive: true });
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = join(uploadDir, `${batchId}-${safeName}`);
    await writeFile(filePath, csvText);
    return filePath;
  }

  private async recordUploadedFile(fileName: string, filePath: string, actor: string) {
    await this.prisma.uploadedFile.create({
      data: {
        fileName,
        filePath,
        fileType: 'lead-upload/original',
        uploadedBy: actor
      }
    });
  }

  private parseColumnMapping(input?: string | Record<string, string>) {
    if (!input) return {};
    if (typeof input !== 'string') return input;
    try {
      const parsed = JSON.parse(input);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, string> : {};
    } catch {
      throw new BadRequestException('columnMapping must be valid JSON');
    }
  }

  private applyColumnMapping(parsed: ReturnType<typeof parseCsv>, mapping: Record<string, string>) {
    const activeMappings = Object.entries(mapping)
      .filter(([target, source]) => (uploadColumns.includes(target) || target.startsWith('custom:')) && typeof source === 'string' && source.trim());

    if (activeMappings.length === 0) return parsed;

    const mappedHeaders = new Set(parsed.headers);
    activeMappings.forEach(([target]) => mappedHeaders.add(target));

    return {
      headers: Array.from(mappedHeaders),
      rows: parsed.rows.map((row) => {
        const nextRow = { ...row };
        for (const [target, source] of activeMappings) {
          nextRow[target] = row[source] ?? '';
        }
        return nextRow;
      })
    };
  }

  private assertCsvFile(file: { buffer?: Buffer; mimetype?: string }, fileName: string) {
    if (!fileName.toLowerCase().endsWith('.csv')) {
      throw new BadRequestException('Only CSV uploads are allowed');
    }
    if (file.mimetype && !['text/csv', 'application/csv', 'application/vnd.ms-excel', 'text/plain'].includes(file.mimetype)) {
      throw new BadRequestException('Only CSV uploads are allowed');
    }
    const maxBytes = csvMaxFileBytes();
    if ((file.buffer?.byteLength ?? 0) > maxBytes) {
      throw new BadRequestException(`CSV file is too large. Maximum allowed size is ${Math.floor(maxBytes / 1024 / 1024)} MB.`);
    }
  }

  private assertCsvRowCount(rowCount: number) {
    if (rowCount === 0) throw new BadRequestException('CSV file has no lead rows');
    const maxRows = csvMaxRows();
    if (rowCount > maxRows) throw new BadRequestException(`CSV file has too many rows. Maximum allowed rows: ${maxRows}.`);
  }

  private async buildUploadContext(rows: NormalizedLeadUploadRow[], duplicateKeyFields: string[]) {
    const mobiles = duplicateKeyFields.includes('mobile') ? uniqueStrings(rows.map((row) => row.mobile)) : [];
    const externalLeadIds = duplicateKeyFields.includes('externalLeadId') ? uniqueStrings(rows.map((row) => row.externalLeadId)) : [];
    const customerNames = duplicateKeyFields.includes('customerName') ? uniqueStrings(rows.map((row) => row.customerName)) : [];
    const duplicateBranchCodes = duplicateKeyFields.includes('branchCode') ? uniqueStrings(rows.map((row) => row.branchCode)) : [];
    const branchNames = duplicateKeyFields.includes('branchName') ? uniqueStrings(rows.map((row) => row.branchName)) : [];
    const customDuplicateFields = duplicateKeyFields.filter((field) => field.startsWith('custom:')).map((field) => field.slice('custom:'.length));
    const branchCodes = uniqueStrings(rows.map((row) => row.branchCode));
    const leadCandidateFilters: Prisma.LeadWhereInput[] = [
      ...(mobiles.length ? [{ mobile: { in: mobiles } }] : []),
      ...(externalLeadIds.length ? [{ externalLeadId: { in: externalLeadIds } }] : []),
      ...(customerNames.length ? [{ customerName: { in: customerNames } }] : []),
      ...(duplicateBranchCodes.length ? [{ branchCode: { in: duplicateBranchCodes } }] : []),
      ...(branchNames.length ? [{ branchName: { in: branchNames } }] : []),
      ...customDuplicateFields.flatMap((fieldKey) => {
        const values = uniqueStrings(rows.map((row) => row.customFields[fieldKey]));
        return values.map((value) => ({
          customValues: {
            some: {
              field: { fieldKey },
              value: { equals: value as Prisma.InputJsonValue }
            }
          }
        }));
      })
    ];
    const [existingLeads, teams] = await Promise.all([
      this.prisma.lead.findMany({
        where: leadCandidateFilters.length
          ? { OR: leadCandidateFilters }
          : { id: '__none__' },
        select: {
          id: true,
          mobile: true,
          externalLeadId: true,
          customerName: true,
          branchCode: true,
          branchName: true,
          sourceBatchId: true,
          customValues: { include: { field: { select: { fieldKey: true } } } }
        }
      }),
      this.prisma.team.findMany({
        where: { code: { in: branchCodes }, isActive: true },
        select: { id: true, code: true }
      })
    ]);

    const existingLeadKeys: ExistingLeadKey[] = existingLeads;
    return {
      leadByMobile: new Map<string, ExistingLeadKey>(existingLeadKeys.map((lead) => [lead.mobile, lead])),
      leadByExternalId: new Map<string, ExistingLeadKey>(existingLeadKeys.filter((lead) => lead.externalLeadId).map((lead) => [lead.externalLeadId as string, lead])),
      leadByCustomerName: new Map<string, ExistingLeadKey>(existingLeadKeys.filter((lead) => lead.customerName).map((lead) => [String(lead.customerName).toLowerCase(), lead])),
      leadByBranchCode: new Map<string, ExistingLeadKey>(existingLeadKeys.filter((lead) => lead.branchCode).map((lead) => [String(lead.branchCode).toLowerCase(), lead])),
      leadByBranchName: new Map<string, ExistingLeadKey>(existingLeadKeys.filter((lead) => lead.branchName).map((lead) => [String(lead.branchName).toLowerCase(), lead])),
      existingLeads: existingLeadKeys,
      teamByCode: new Map(teams.filter((team) => team.code).map((team) => [team.code as string, team]))
    };
  }

  private findDuplicateLeadFromContext(row: NormalizedLeadUploadRow, context: Awaited<ReturnType<UploadsService['buildUploadContext']>>, duplicateKeyFields: string[]) {
    const candidates = [
      ...(row.mobile ? [context.leadByMobile.get(row.mobile)] : []),
      ...(row.externalLeadId ? [context.leadByExternalId.get(row.externalLeadId)] : []),
      ...(row.customerName ? [context.leadByCustomerName.get(row.customerName.toLowerCase())] : []),
      ...(row.branchCode ? [context.leadByBranchCode.get(row.branchCode.toLowerCase())] : []),
      ...(row.branchName ? [context.leadByBranchName.get(row.branchName.toLowerCase())] : []),
      ...context.existingLeads
    ].filter(Boolean) as ExistingLeadKey[];
    return Array.from(new Map(candidates.map((lead) => [lead.id, lead])).values()).find((lead) => duplicateKeyMatches(row, lead, duplicateKeyFields)) ?? null;
  }

  private rememberImportedLead(context: Awaited<ReturnType<UploadsService['buildUploadContext']>>, lead: ExistingLeadKey) {
    context.leadByMobile.set(lead.mobile, lead);
    if (lead.externalLeadId) context.leadByExternalId.set(lead.externalLeadId, lead);
    if (lead.customerName) context.leadByCustomerName.set(lead.customerName.toLowerCase(), lead);
    if (lead.branchCode) context.leadByBranchCode.set(lead.branchCode.toLowerCase(), lead);
    if (lead.branchName) context.leadByBranchName.set(lead.branchName.toLowerCase(), lead);
    context.existingLeads.push(lead);
  }

  private validateDuplicateKeyBlank(row: NormalizedLeadUploadRow, duplicateKeyFields: string[]) {
    const missing = duplicateKeyFields.filter((field) => !String(uploadDuplicateFieldValue(row, field) ?? '').trim());
    return missing.length > 0 ? `Duplicate key field is blank: ${missing.map(humanizeLeadField).join(', ')}` : null;
  }

  private validateFileDuplicate(row: NormalizedLeadUploadRow, seen: Set<string>, duplicateKeyFields: string[]) {
    const key = duplicateCompositeKey(row, duplicateKeyFields);
    if (!key) return null;
    if (seen.has(key)) return `Duplicate ${duplicateKeyFields.map(humanizeLeadField).join(' + ')} within uploaded CSV`;
    seen.add(key);
    return null;
  }

  private async csvUploadConfig(): Promise<CsvUploadConfig> {
    const setting = await this.prisma.appSetting.findUnique({ where: { key: 'csv.upload.config' } });
    const value = setting?.value && typeof setting.value === 'object' ? setting.value as Partial<CsvUploadConfig> : {};
    const required = Array.isArray(value.requiredColumns) ? value.requiredColumns.map(String).filter((column) => uploadColumns.includes(column)) : requiredColumns;
    const duplicates = Array.isArray(value.duplicateKeyFields) ? value.duplicateKeyFields.map(String).filter(isSupportedDuplicateField) : ['mobile', 'externalLeadId'];
    return {
      requiredColumns: required.length > 0 ? Array.from(new Set(required)) : requiredColumns,
      duplicateKeyFields: duplicates.length > 0 ? Array.from(new Set(duplicates)) : ['mobile', 'externalLeadId'],
      defaultMapping: value.defaultMapping && typeof value.defaultMapping === 'object' ? value.defaultMapping as Record<string, string> : {}
    };
  }
}

const supportedDuplicateFields = ['mobile', 'externalLeadId', 'customerName', 'branchCode', 'branchName'] as const;

function isSupportedDuplicateField(field: string) {
  return (supportedDuplicateFields as readonly string[]).includes(field) || field.startsWith('custom:');
}

function uploadDuplicateFieldValue(row: NormalizedLeadUploadRow, field: string) {
  if (field === 'mobile') return row.mobile;
  if (field === 'externalLeadId') return row.externalLeadId;
  if (field === 'customerName') return row.customerName;
  if (field === 'branchCode') return row.branchCode;
  if (field === 'branchName') return row.branchName;
  if (field.startsWith('custom:')) return row.customFields[field.slice('custom:'.length)];
  return '';
}

function leadDuplicateFieldValue(lead: ExistingLeadKey, field: string) {
  if (field === 'mobile') return lead.mobile;
  if (field === 'externalLeadId') return lead.externalLeadId;
  if (field === 'customerName') return lead.customerName;
  if (field === 'branchCode') return lead.branchCode;
  if (field === 'branchName') return lead.branchName;
  if (field.startsWith('custom:')) {
    const fieldKey = field.slice('custom:'.length);
    return lead.customValues?.find((value) => value.field.fieldKey === fieldKey)?.value;
  }
  return '';
}

function duplicateCompositeKey(row: NormalizedLeadUploadRow, fields: string[]) {
  const values = fields.map((field) => String(uploadDuplicateFieldValue(row, field) ?? '').trim().toLowerCase());
  return values.some((value) => !value) ? '' : values.join('::');
}

function duplicateKeyMatches(row: NormalizedLeadUploadRow, lead: ExistingLeadKey, fields: string[]) {
  return fields.every((field) => String(uploadDuplicateFieldValue(row, field) ?? '').trim().toLowerCase() === String(leadDuplicateFieldValue(lead, field) ?? '').trim().toLowerCase());
}

function humanizeLeadField(field: string): string {
  if (field === 'externalLeadId') return 'Loan ID / Lead ID';
  if (field === 'mobile') return 'Mobile';
  if (field.startsWith('custom:')) return `Custom ${humanizeLeadField(field.slice('custom:'.length))}`;
  return field.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\b\w/g, (char) => char.toUpperCase());
}

function csvMaxFileBytes() {
  const raw = Number(process.env.CSV_MAX_FILE_BYTES ?? defaultCsvMaxFileBytes);
  return Number.isFinite(raw) && raw > 0 ? raw : defaultCsvMaxFileBytes;
}

function csvMaxRows() {
  const raw = Number(process.env.CSV_MAX_ROWS ?? defaultCsvMaxRows);
  return Number.isFinite(raw) && raw > 0 ? raw : defaultCsvMaxRows;
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
