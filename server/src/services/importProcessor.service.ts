import { inject, injectable } from 'tsyringe';

import { TOKENS } from '../config/tokens.js';
import type { ContactMutationDto, CrmEntityMutationDto } from '../dto/crm.dto.js';
import type { InventoryMutationDto } from '../dto/inventory.dto.js';
import type { ImportStoredRow, ImportType } from '../models/importJob.model.js';
import type { ICrmService } from './crm.service.js';
import type { IInventoryService } from './inventory.service.js';

export type ImportProcessResult = {
  rows: ImportStoredRow[];
  importedRows: number;
  skippedRows: number;
};

@injectable()
export class ImportProcessorService {
  constructor(
    @inject(TOKENS.InventoryService)
    private readonly inventoryService: IInventoryService,
    @inject(TOKENS.CrmService)
    private readonly crmService: ICrmService,
  ) {}

  async process(importType: ImportType, rows: ImportStoredRow[], actorId: string) {
    const processedRows: ImportStoredRow[] = [];
    let importedRows = 0;

    for (const row of rows) {
      if (row.status !== 'valid') {
        processedRows.push({ ...row, status: 'skipped' });
        continue;
      }

      try {
        await this.createRecord(importType, row.data, actorId);
        processedRows.push({ ...row, status: 'imported' });
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

    return {
      rows: processedRows,
      importedRows,
      skippedRows: processedRows.length - importedRows,
    } satisfies ImportProcessResult;
  }

  private async createRecord(
    importType: ImportType,
    data: Record<string, unknown>,
    actorId: string,
  ) {
    if (importType === 'inventory') {
      await this.inventoryService.createInventory({
        ...(data as InventoryMutationDto),
        status: 'active',
        confirmationStatus: 'never_confirmed',
        createdBy: actorId,
        updatedBy: actorId,
      });
      return;
    }

    if (importType === 'crm_entities') {
      await this.crmService.createEntity({
        ...(data as CrmEntityMutationDto),
        status: 'active',
        createdBy: actorId,
        updatedBy: actorId,
      });
      return;
    }

    const { crmEntityId, crmEntityName: _crmEntityName, ...contactData } = data;
    await this.crmService.createContact(String(crmEntityId), {
      ...(contactData as ContactMutationDto),
      status: 'active',
      createdBy: actorId,
      updatedBy: actorId,
    });
  }
}
