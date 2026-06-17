import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { v2 as cloudinary } from 'cloudinary';
import { PDFDocument } from 'pdf-lib';
import puppeteer from 'puppeteer';

import type { DocumentType } from '../models/document.model.js';
import { HttpError } from '../utils/httpError.js';

const defaultDocumentStoragePath = path.join(os.tmpdir(), 'conekt-ads', 'documents');

export const documentStoragePath = path.resolve(
  process.env.DOCUMENT_STORAGE_PATH || defaultDocumentStoragePath,
);

type CloudinaryPdfUpload = {
  publicId: string;
  secureUrl: string;
  resourceType: string;
  deliveryType: string;
  format: string;
  bytes?: number;
};

type CloudinaryUploadResult = {
  public_id: string;
  secure_url: string;
  resource_type: string;
  type: string;
  format?: string;
  bytes?: number;
};

const documentFolder = () => process.env.CLOUDINARY_DOCUMENT_FOLDER || 'documents';
const documentDeliveryType = () =>
  process.env.CLOUDINARY_DOCUMENT_DELIVERY_TYPE || 'authenticated';

const isCloudinaryConfigured = () =>
  Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET,
  );

const getPuppeteerExecutablePath = () => {
  const configuredPath = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (configuredPath && existsSync(configuredPath)) {
    return configuredPath;
  }

  const candidates = [
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
  ];

  return candidates.find((candidate) => existsSync(candidate));
};

const safeSegment = (value: string) =>
  value
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'document';

export const buildDocumentFileName = ({
  campaignCode,
  planVersionLabel,
  documentType,
  extension = 'pdf',
}: {
  campaignCode: string;
  planVersionLabel: string;
  documentType: DocumentType;
  extension?: string;
}) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${safeSegment(campaignCode)}-${safeSegment(planVersionLabel)}-${documentType}-${timestamp}.${extension}`;
};

export class PdfService {
  private cloudinaryConfigured = false;

  private ensureCloudinaryConfigured() {
    if (this.cloudinaryConfigured) return;
    if (!isCloudinaryConfigured()) {
      throw new HttpError(500, 'Cloudinary document storage is not configured');
    }

    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
    this.cloudinaryConfigured = true;
  }

  async generatePdfFromHtml(html: string) {
    const browser = await puppeteer.launch({
      executablePath: getPuppeteerExecutablePath(),
      headless: true,
      // `--disable-dev-shm-usage` is essential in Docker: the default /dev/shm is
      // only 64 MB and Chrome crashes ("Target closed"/"Page crashed") rendering
      // large multi-page documents. `protocolTimeout` is raised because a big PDF
      // can take well over the 180s default to render.
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
      protocolTimeout: 600_000,
    });

    try {
      const page = await browser.newPage();
      page.setDefaultTimeout(0);
      await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 0 });
      await page.evaluate(async () => {
        const images = Array.from(document.images);
        await Promise.all(
          images.map(
            (image) =>
              new Promise<void>((resolve) => {
                if (image.complete) {
                  resolve();
                  return;
                }
                image.addEventListener('load', () => resolve(), { once: true });
                image.addEventListener('error', () => resolve(), { once: true });
                window.setTimeout(resolve, 10_000);
              }),
          ),
        );
      });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
        timeout: 0,
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  // Merge several PDF buffers (in order) into one. Used by the chunked renderer
  // so a very large document can be rendered in small page batches that each stay
  // within Chrome's memory limits, then stitched together.
  async mergePdfs(buffers: Buffer[]): Promise<Buffer> {
    if (buffers.length === 1) return buffers[0];
    const merged = await PDFDocument.create();
    for (const buffer of buffers) {
      const source = await PDFDocument.load(buffer);
      const pages = await merged.copyPages(source, source.getPageIndices());
      for (const page of pages) merged.addPage(page);
    }
    return Buffer.from(await merged.save());
  }

  async uploadPdf(buffer: Buffer, fileName: string): Promise<CloudinaryPdfUpload> {
    this.ensureCloudinaryConfigured();
    const publicId = fileName.replace(/\.[^.]+$/, '');
    const fileExtension = (fileName.match(/\.([^.]+)$/)?.[1] || 'pdf').toLowerCase();
    const deliveryType = documentDeliveryType();

    const result = await new Promise<CloudinaryUploadResult>((resolve, reject) => {
      // Use chunked upload: a large multi-hundred-page proposal PDF exceeds the
      // single-request size limit and `upload_stream` rejects it with a 413.
      // `upload_chunked_stream` sends the file in parts. The chunk size must stay
      // below the account's per-request max (10 MB here, Cloudinary's minimum
      // chunk is 5 MB), so each part is accepted and the full file is assembled
      // server-side.
      const uploadStream = cloudinary.uploader.upload_chunked_stream(
        {
          resource_type: 'raw',
          type: deliveryType,
          folder: documentFolder(),
          public_id: publicId,
          filename_override: fileName,
          use_filename: false,
          unique_filename: false,
          overwrite: false,
          chunk_size: 6_000_000,
        },
        (error, uploadResult) => {
          if (error || !uploadResult) {
            reject(error || new Error('Cloudinary PDF upload failed'));
            return;
          }
          resolve(uploadResult as CloudinaryUploadResult);
        },
      );

      uploadStream.on('error', reject);
      Readable.from(buffer).pipe(uploadStream);
    });

    return {
      publicId: result.public_id,
      secureUrl: result.secure_url,
      resourceType: result.resource_type,
      deliveryType: result.type || deliveryType,
      format: result.format || fileExtension,
      bytes: result.bytes,
    };
  }

  getDownloadUrl({
    publicId,
    format,
    deliveryType,
  }: {
    publicId: string;
    format?: string;
    deliveryType?: string;
  }) {
    this.ensureCloudinaryConfigured();
    const type = deliveryType || documentDeliveryType();

    if (type === 'upload') {
      return cloudinary.url(publicId, {
        resource_type: 'raw',
        type,
        secure: true,
      });
    }

    return cloudinary.utils.private_download_url(publicId, format || 'pdf', {
      resource_type: 'raw',
      type,
      attachment: true,
      expires_at: Math.floor(Date.now() / 1000) + 300,
    });
  }

  async deletePdf(publicId: string, deliveryType?: string) {
    this.ensureCloudinaryConfigured();
    await cloudinary.uploader.destroy(publicId, {
      resource_type: 'raw',
      type: deliveryType || documentDeliveryType(),
      invalidate: true,
    });
  }
}
