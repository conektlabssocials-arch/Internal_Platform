import { randomBytes } from 'node:crypto';
import { inject, injectable } from 'tsyringe';
import { parse } from 'csv-parse/sync';
import { Types } from 'mongoose';
import type { FilterQuery } from 'mongoose';
import type { Request } from 'express';

import { TOKENS } from '../config/tokens.js';
import { ACTIVITY_ACTIONS } from '../constants/activity.constants.js';
import type {
  ImportJobDocument,
  ImportStoredRow,
  ImportType,
} from '../models/importJob.model.js';
import { importJobStatuses, importTypes } from '../models/importJob.model.js';
import type { IImportJobRepository } from '../repositories/importJob.repository.js';
import type { AuthTokenPayload } from '../types/auth.js';
import { HttpError } from '../utils/httpError.js';
import type { IActivityService } from './activity.service.js';
import { ImportProcessorService } from './importProcessor.service.js';
import { ImportTemplatesService } from './importTemplates.service.js';
import { ImportValidatorsService } from './importValidators.service.js';

type Actor = AuthTokenPayload & { name?: string };

export interface IImportService {
  listTemplates(): ReturnType<ImportTemplatesService['listTemplates']>;
  getTemplate(name: string): ReturnType<ImportTemplatesService['buildTemplate']>;
  upload(
    importType: string,
    file: Express.Multer.File,
    actor: Actor,
    req?: Request,
  ): Promise<unknown>;
  validate(jobId: string, actor: Actor, req?: Request): Promise<unknown>;
  commit(jobId: string, actor: Actor, req?: Request): Promise<unknown>;
  listJobs(filters: Record<string, string | undefined>): Promise<unknown>;
  getJob(jobId: string): Promise<unknown>;
  getErrorCsv(jobId: string): Promise<{ fileName: string; content: string }>;
  cancel(jobId: string, actor: Actor, req?: Request): Promise<void>;
}

const pageNumber = (value?: string, fallback = 1) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
};

@injectable()
export class ImportService implements IImportService {
  constructor(
    @inject(TOKENS.ImportJobRepository)
    private readonly jobs: IImportJobRepository,
    @inject(TOKENS.ActivityService)
    private readonly activity: IActivityService,
    @inject(TOKENS.ImportTemplatesService)
    private readonly templates: ImportTemplatesService,
    @inject(TOKENS.ImportValidatorsService)
    private readonly validators: ImportValidatorsService,
    @inject(TOKENS.ImportProcessorService)
    private readonly processor: ImportProcessorService,
  ) {}

  listTemplates() {
    return this.templates.listTemplates();
  }

  getTemplate(name: string) {
    return this.templates.buildTemplate(name);
  }

  async upload(importTypeValue: string, file: Express.Multer.File, actor: Actor, req?: Request) {
    const importType = this.parseImportType(importTypeValue);
    const rawRows = this.parseCsv(file.buffer);
    if (rawRows.length === 0) {
      throw new HttpError(400, 'The CSV file does not contain any data rows');
    }
    if (rawRows.length > 5000) {
      throw new HttpError(400, 'A maximum of 5,000 rows can be imported at once');
    }

    const pendingRows: ImportStoredRow[] = rawRows.map((data, index) => ({
      rowNumber: index + 2,
      status: 'pending',
      data,
      errors: [],
      warnings: [],
    }));
    const job = await this.jobs.create({
      importType,
      status: 'uploaded',
      fileName: `import-${Date.now()}-${randomBytes(4).toString('hex')}.csv`,
      originalName: file.originalname,
      uploadedBy: new Types.ObjectId(actor.userId),
      totalRows: rawRows.length,
      previewRows: pendingRows.slice(0, 20),
      metadata: { rawRows },
    });

    await this.activity.logEntityActivity({
      actor,
      action: ACTIVITY_ACTIONS.IMPORT_UPLOADED,
      entityType: 'System',
      entityId: job._id.toString(),
      entityTitle: file.originalname,
      message: `${actor.name || actor.email} uploaded ${importType.replace('_', ' ')} import file ${file.originalname}.`,
      metadata: { importType, totalRows: rawRows.length },
      visibility: 'admin_only',
      req,
    });

    return this.mapJob(job);
  }

  async validate(jobId: string, actor: Actor, req?: Request) {
    const job = await this.getJobDocument(jobId);
    if (!['uploaded', 'validated'].includes(job.status)) {
      throw new HttpError(400, `A ${job.status} import cannot be validated`);
    }

    const rawRows = this.getRawRows(job);
    const result = await this.validators.validate(job.importType, rawRows);
    job.status = 'validated';
    job.totalRows = result.totalRows;
    job.validRows = result.validRows;
    job.invalidRows = result.invalidRows;
    job.duplicateRows = result.duplicateRows;
    job.set('errors', result.errors);
    job.warnings = result.warnings;
    job.validatedRows = result.rows;
    job.previewRows = result.rows.slice(0, 20);
    await this.jobs.save(job);

    await this.activity.logEntityActivity({
      actor,
      action: ACTIVITY_ACTIONS.IMPORT_VALIDATED,
      entityType: 'System',
      entityId: job._id.toString(),
      entityTitle: job.originalName,
      message: `${actor.name || actor.email} validated ${job.originalName || 'an import file'}.`,
      metadata: {
        importType: job.importType,
        validRows: result.validRows,
        invalidRows: result.invalidRows,
        duplicateRows: result.duplicateRows,
      },
      visibility: 'admin_only',
      req,
    });

    return {
      job: this.mapJob(job),
      summary: this.getSummary(job),
      previewRows: job.previewRows,
      errors: this.getJobErrors(job),
      warnings: job.warnings,
    };
  }

  async commit(jobId: string, actor: Actor, req?: Request) {
    const job = await this.getJobDocument(jobId);
    if (job.status !== 'validated') {
      throw new HttpError(400, 'Import must be validated before it can be committed');
    }

    try {
      const result = await this.processor.process(
        job.importType,
        job.validatedRows,
        actor.userId,
      );
      const processorErrors = result.rows.flatMap((row) => row.errors || []);
      job.status = 'imported';
      job.validatedRows = result.rows;
      job.previewRows = result.rows.slice(0, 20);
      job.importedRows = result.importedRows;
      job.skippedRows = result.skippedRows;
      job.set('errors', processorErrors);
      job.invalidRows = result.rows.filter(
        (row) => row.status === 'skipped' && (row.errors || []).length > 0,
      ).length;
      await this.jobs.save(job);

      await this.activity.logEntityActivity({
        actor,
        action: ACTIVITY_ACTIONS.IMPORT_COMMITTED,
        entityType: 'System',
        entityId: job._id.toString(),
        entityTitle: job.originalName,
        message: `${actor.name || actor.email} imported ${result.importedRows} ${job.importType.replace('_', ' ')} rows. ${result.skippedRows} rows were skipped.`,
        metadata: {
          importType: job.importType,
          importedRows: result.importedRows,
          skippedRows: result.skippedRows,
        },
        visibility: 'admin_only',
        req,
      });

      return {
        job: this.mapJob(job),
        summary: this.getSummary(job),
      };
    } catch (error) {
      job.status = 'failed';
      await this.jobs.save(job);
      await this.activity.logEntityActivity({
        actor,
        action: ACTIVITY_ACTIONS.IMPORT_FAILED,
        entityType: 'System',
        entityId: job._id.toString(),
        entityTitle: job.originalName,
        message: `${job.originalName || 'Import'} failed.`,
        metadata: { importType: job.importType },
        visibility: 'admin_only',
        req,
      });
      throw error;
    }
  }

  async listJobs(filters: Record<string, string | undefined>) {
    const page = pageNumber(filters.page);
    const limit = Math.min(pageNumber(filters.limit, 20), 100);
    const query: FilterQuery<unknown> = {};
    if (filters.importType) query.importType = this.parseImportType(filters.importType);
    if (filters.status) {
      if (!importJobStatuses.includes(filters.status as never)) {
        throw new HttpError(400, 'status is invalid');
      }
      query.status = filters.status;
    }
    if (filters.from || filters.to) {
      query.createdAt = {};
      if (filters.from) (query.createdAt as Record<string, unknown>).$gte = new Date(filters.from);
      if (filters.to) {
        (query.createdAt as Record<string, unknown>).$lte = new Date(
          `${filters.to}T23:59:59.999`,
        );
      }
    }

    const { items, total } = await this.jobs.findPaginated(query, page, limit);
    return {
      data: items.map((job) => this.mapJob(job, false)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      },
    };
  }

  async getJob(jobId: string) {
    return this.mapJob(await this.getJobDocument(jobId));
  }

  async getErrorCsv(jobId: string) {
    const job = await this.getJobDocument(jobId);
    return {
      fileName: `${(job.originalName || 'import').replace(/\.csv$/i, '')}_errors.csv`,
      content: this.templates.buildErrorReport(this.getJobErrors(job)),
    };
  }

  async cancel(jobId: string, actor: Actor, req?: Request) {
    const job = await this.getJobDocument(jobId);
    if (job.status === 'imported') {
      throw new HttpError(400, 'Completed import history cannot be deleted');
    }
    job.status = 'cancelled';
    await this.jobs.save(job);
    await this.activity.logEntityActivity({
      actor,
      action: ACTIVITY_ACTIONS.IMPORT_CANCELLED,
      entityType: 'System',
      entityId: job._id.toString(),
      entityTitle: job.originalName,
      message: `${actor.name || actor.email} cancelled import ${job.originalName || job._id}.`,
      metadata: { importType: job.importType },
      visibility: 'admin_only',
      req,
    });
  }

  private parseCsv(buffer: Buffer) {
    if (buffer.includes(0)) {
      throw new HttpError(400, 'The uploaded file is not a valid text CSV');
    }
    try {
      return parse(buffer, {
        bom: true,
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: false,
      }) as Record<string, unknown>[];
    } catch {
      throw new HttpError(400, 'Unable to parse CSV file. Check its headers and formatting.');
    }
  }

  private parseImportType(value: string): ImportType {
    if (!importTypes.includes(value as ImportType)) {
      throw new HttpError(400, 'importType is invalid');
    }
    return value as ImportType;
  }

  private async getJobDocument(jobId: string) {
    if (!Types.ObjectId.isValid(jobId)) throw new HttpError(400, 'jobId is invalid');
    const job = await this.jobs.findById(jobId);
    if (!job) throw new HttpError(404, 'Import job not found');
    return job;
  }

  private getRawRows(job: ImportJobDocument) {
    const rawRows = job.metadata?.rawRows;
    if (!Array.isArray(rawRows)) {
      throw new HttpError(400, 'Import source rows are no longer available');
    }
    return rawRows as Record<string, unknown>[];
  }

  private getSummary(job: ImportJobDocument) {
    return {
      totalRows: job.totalRows,
      validRows: job.validRows,
      invalidRows: job.invalidRows,
      duplicateRows: job.duplicateRows,
      importedRows: job.importedRows,
      skippedRows: job.skippedRows,
      warnings: job.warnings.length,
    };
  }

  private mapJob(job: ImportJobDocument, includeRows = true) {
    const uploader = job.uploadedBy as unknown as {
      _id?: Types.ObjectId;
      name?: string;
      email?: string;
      toString(): string;
    };
    return {
      id: job._id.toString(),
      importType: job.importType,
      status: job.status,
      fileName: job.fileName,
      originalName: job.originalName,
      uploadedBy:
        uploader && typeof uploader === 'object' && uploader.name
          ? { id: uploader._id?.toString(), name: uploader.name, email: uploader.email }
          : { id: job.uploadedBy.toString() },
      ...this.getSummary(job),
      errors: includeRows ? this.getJobErrors(job) : undefined,
      warnings: includeRows ? job.warnings : undefined,
      previewRows: includeRows ? job.previewRows : undefined,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };
  }

  private getJobErrors(job: ImportJobDocument) {
    return (job.get('errors') || []) as {
      rowNumber: number;
      field: string;
      message: string;
      value?: string;
    }[];
  }
}
