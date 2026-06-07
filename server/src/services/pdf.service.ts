import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

import type { DocumentType } from '../models/document.model.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
export const documentStoragePath = path.resolve(currentDir, '..', '..', 'uploads', 'documents');

const safeSegment = (value: string) =>
  value
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'document';

export const buildDocumentFileName = ({
  campaignCode,
  planVersionLabel,
  documentType,
}: {
  campaignCode: string;
  planVersionLabel: string;
  documentType: DocumentType;
}) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${safeSegment(campaignCode)}-${safeSegment(planVersionLabel)}-${documentType}-${timestamp}.pdf`;
};

export const ensureDocumentStorage = () =>
  fs.mkdir(documentStoragePath, { recursive: true });

export class PdfService {
  async generatePdfFromHtml(html: string, outputPath: string) {
    await ensureDocumentStorage();
    const browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'domcontentloaded' });
      await page.pdf({
        path: outputPath,
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
      });
    } finally {
      await browser.close();
    }
  }
}
