import { injectable } from 'tsyringe';
import { Parser } from 'json2csv';

import { IMPORT_TEMPLATES, getImportTemplate } from '../constants/import.constants.js';
import { HttpError } from '../utils/httpError.js';

export const protectCsvCell = (value: unknown) => {
  if (typeof value !== 'string') {
    return value;
  }

  return /^[=+\-@]/.test(value) ? `'${value}` : value;
};

@injectable()
export class ImportTemplatesService {
  listTemplates() {
    return IMPORT_TEMPLATES.map(({ name, fileName, importType, description }) => ({
      name,
      fileName,
      importType,
      description,
    }));
  }

  buildTemplate(name: string) {
    const template = getImportTemplate(name);
    if (!template) {
      throw new HttpError(404, 'Import template not found');
    }

    const safeExample = Object.fromEntries(
      Object.entries(template.example).map(([key, value]) => [key, protectCsvCell(value)]),
    );
    const parser = new Parser({ fields: template.fields });

    return {
      fileName: template.fileName,
      content: parser.parse([safeExample]),
    };
  }

  buildErrorReport(errors: { rowNumber: number; field: string; message: string; value?: string }[]) {
    const fields = ['rowNumber', 'field', 'message', 'value'];
    const rows = errors.map((error) => ({
      ...error,
      field: protectCsvCell(error.field),
      message: protectCsvCell(error.message),
      value: protectCsvCell(error.value || ''),
    }));

    return new Parser({ fields }).parse(rows);
  }
}
