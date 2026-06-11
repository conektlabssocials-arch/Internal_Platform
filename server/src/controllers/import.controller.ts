import { inject, injectable } from 'tsyringe';
import type { Request, Response } from 'express';

import { TOKENS } from '../config/tokens.js';
import type { IImportService } from '../services/import.service.js';
import type { AuthTokenPayload } from '../types/auth.js';
import { HttpError } from '../utils/httpError.js';

const getAuthUser = (locals: { authUser?: AuthTokenPayload & { name?: string } }) => {
  if (!locals.authUser) throw new HttpError(401, 'Authentication required');
  return locals.authUser;
};

@injectable()
export class ImportController {
  constructor(
    @inject(TOKENS.ImportService)
    private readonly service: IImportService,
  ) {}

  listTemplates = async (_req: Request, res: Response) => {
    res.status(200).json({ data: this.service.listTemplates() });
  };

  downloadTemplate = async (req: Request, res: Response) => {
    const template = this.service.getTemplate(req.params.templateName);
    this.sendCsv(res, template.fileName, template.content);
  };

  upload = async (req: Request, res: Response) => {
    if (!req.file) throw new HttpError(400, 'A CSV file is required');
    const job = await this.service.upload(
      req.params.importType,
      req.file,
      getAuthUser(res.locals),
      req,
    );
    res.status(201).json({ data: job });
  };

  listJobs = async (req: Request, res: Response) => {
    res.status(200).json(await this.service.listJobs(req.query as Record<string, string>));
  };

  getJob = async (req: Request, res: Response) => {
    res.status(200).json({ data: await this.service.getJob(req.params.jobId) });
  };

  validate = async (req: Request, res: Response) => {
    res.status(200).json({
      data: await this.service.validate(req.params.jobId, getAuthUser(res.locals), req),
    });
  };

  commit = async (req: Request, res: Response) => {
    res.status(200).json({
      data: await this.service.commit(req.params.jobId, getAuthUser(res.locals), req),
    });
  };

  downloadErrors = async (req: Request, res: Response) => {
    const report = await this.service.getErrorCsv(req.params.jobId);
    this.sendCsv(res, report.fileName, report.content);
  };

  cancel = async (req: Request, res: Response) => {
    await this.service.cancel(req.params.jobId, getAuthUser(res.locals), req);
    res.status(204).send();
  };

  private sendCsv(res: Response, fileName: string, content: string) {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.status(200).send(`\uFEFF${content}`);
  }
}
