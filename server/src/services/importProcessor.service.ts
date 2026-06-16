import { inject, injectable } from 'tsyringe';

import { TOKENS } from '../config/tokens.js';
import type { ContactMutationDto, CrmEntityMutationDto } from '../dto/crm.dto.js';
import type { InventoryMutationDto } from '../dto/inventory.dto.js';
import type { ImportStoredRow, ImportType } from '../models/importJob.model.js';
import type { ICrmService } from './crm.service.js';
import type { IGoogleDrivePhotoService } from './googleDrivePhoto.service.js';
import type { IInventoryService } from './inventory.service.js';

export type DrivePhotoImportFailure = {
  rowNumber: number;
  title?: string;
  folderId?: string;
  reason: string;
};

export type DrivePhotoImportSummary = {
  totalRowsProcessed: number;
  totalInventoriesCreated: number;
  totalFoldersProcessed: number;
  totalPhotosExtracted: number;
  failedFolderCount: number;
  failedRows: DrivePhotoImportFailure[];
};

export type ImportProcessResult = {
  rows: ImportStoredRow[];
  importedRows: number;
  skippedRows: number;
  drivePhotoImport?: DrivePhotoImportSummary;
};

type CreateRecordResult = {
  errors?: NonNullable<ImportStoredRow['errors']>;
};

@injectable()
export class ImportProcessorService {
  constructor(
    @inject(TOKENS.InventoryService)
    private readonly inventoryService: IInventoryService,
    @inject(TOKENS.CrmService)
    private readonly crmService: ICrmService,
    @inject(TOKENS.GoogleDrivePhotoService)
    private readonly googleDrivePhotos: IGoogleDrivePhotoService,
  ) {}

  async process(importType: ImportType, rows: ImportStoredRow[], actorId: string) {
    const processedRows: ImportStoredRow[] = [];
    let importedRows = 0;
    const drivePhotoImport = this.createDrivePhotoImportSummary(rows);

    for (const row of rows) {
      if (row.status !== 'valid') {
        processedRows.push({ ...row, status: 'skipped' });
        continue;
      }

      try {
        const result = await this.createRecord(
          importType,
          row.data,
          actorId,
          row,
          drivePhotoImport,
        );
        processedRows.push({
          ...row,
          status: 'imported',
          errors: [...(row.errors || []), ...(result.errors || [])],
        });
        importedRows += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Row import failed';
        processedRows.push({
          ...row,
          status: 'skipped',
          errors: [
            ...(row.errors || []),
            {
              rowNumber: row.rowNumber,
              field: 'row',
              message,
            },
          ],
        });
      }
    }

    drivePhotoImport.totalInventoriesCreated =
      importType === 'inventory' ? importedRows : 0;

    return {
      rows: processedRows,
      importedRows,
      skippedRows: processedRows.length - importedRows,
      drivePhotoImport: importType === 'inventory' ? drivePhotoImport : undefined,
    } satisfies ImportProcessResult;
  }

  private async createRecord(
    importType: ImportType,
    data: Record<string, unknown>,
    actorId: string,
    row: ImportStoredRow,
    drivePhotoImport: DrivePhotoImportSummary,
  ): Promise<CreateRecordResult> {
    if (importType === 'inventory') {
      const { photos, error } = await this.getDrivePhotosForInventoryRow(
        data,
        row,
        drivePhotoImport,
      );
      await this.inventoryService.createInventory({
        ...(data as InventoryMutationDto),
        photos,
        status: 'active',
        confirmationStatus: 'never_confirmed',
        createdBy: actorId,
        updatedBy: actorId,
      });
      return {
        errors: error
          ? [
              {
                rowNumber: row.rowNumber,
                field: 'propertyVisualLink',
                message: error,
                value:
                  typeof data.propertyVisualLink === 'string'
                    ? data.propertyVisualLink
                    : undefined,
              },
            ]
          : [],
      };
    }

    if (importType === 'crm_entities') {
      await this.crmService.createEntity({
        ...(data as CrmEntityMutationDto),
        status: 'active',
        createdBy: actorId,
        updatedBy: actorId,
      });
      return {};
    }

    const { crmEntityId, crmEntityName: _crmEntityName, ...contactData } = data;
    await this.crmService.createContact(String(crmEntityId), {
      ...(contactData as ContactMutationDto),
      status: 'active',
      createdBy: actorId,
      updatedBy: actorId,
    });
    return {};
  }

  private createDrivePhotoImportSummary(rows: ImportStoredRow[]): DrivePhotoImportSummary {
    return {
      totalRowsProcessed: rows.length,
      totalInventoriesCreated: 0,
      totalFoldersProcessed: 0,
      totalPhotosExtracted: 0,
      failedFolderCount: 0,
      failedRows: [],
    };
  }

  private async getDrivePhotosForInventoryRow(
    data: Record<string, unknown>,
    row: ImportStoredRow,
    drivePhotoImport: DrivePhotoImportSummary,
  ) {
    const folderUrl = typeof data.propertyVisualLink === 'string'
      ? data.propertyVisualLink.trim()
      : '';
    const title = typeof data.title === 'string'
      ? data.title
      : typeof data.propertyName === 'string'
        ? data.propertyName
        : undefined;

    if (!folderUrl) return { photos: [] as string[] };

    const folderId = this.googleDrivePhotos.extractDriveFolderId(folderUrl);
    const result = await this.googleDrivePhotos.getImagesFromDriveFolder(folderUrl);
    drivePhotoImport.totalFoldersProcessed += 1;
    drivePhotoImport.totalPhotosExtracted += result.photos.length;

    console.info(
      [
        '[bulk-inventory-import] Drive folder processed',
        `row=${row.rowNumber}`,
        `title=${title || 'unknown'}`,
        `folderId=${folderId || 'unknown'}`,
        `images=${result.photos.length}`,
      ].join(' '),
    );

    if (result.error) {
      drivePhotoImport.failedFolderCount += 1;
      drivePhotoImport.failedRows.push({
        rowNumber: row.rowNumber,
        title,
        folderId,
        reason: result.error,
      });

      console.error(
        [
          '[bulk-inventory-import] Drive folder failed',
          `row=${row.rowNumber}`,
          `title=${title || 'unknown'}`,
          `folderId=${folderId || 'unknown'}`,
          `error=${result.error}`,
        ].join(' '),
      );
    }

    return {
      photos: result.photos,
      error: result.error,
    };
  }
}
