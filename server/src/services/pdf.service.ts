import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { v2 as cloudinary } from 'cloudinary';
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
}: {
  campaignCode: string;
  planVersionLabel: string;
  documentType: DocumentType;
}) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${safeSegment(campaignCode)}-${safeSegment(planVersionLabel)}-${documentType}-${timestamp}.pdf`;
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
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'domcontentloaded' });
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
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  async uploadPdf(buffer: Buffer, fileName: string): Promise<CloudinaryPdfUpload> {
    this.ensureCloudinaryConfigured();
    const publicId = fileName.replace(/\.pdf$/i, '');
    const deliveryType = documentDeliveryType();

    const result = await new Promise<CloudinaryUploadResult>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'raw',
          type: deliveryType,
          folder: documentFolder(),
          public_id: publicId,
          filename_override: fileName,
          use_filename: false,
          unique_filename: false,
          overwrite: false,
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
      format: result.format || 'pdf',
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
