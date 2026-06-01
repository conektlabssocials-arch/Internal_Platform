import type { FilterQuery, Model } from 'mongoose';

type SaveableDocument<TDocument> = TDocument & {
  save(): Promise<TDocument>;
};

export interface IBaseRepository<TDocument> {
  create(data: Record<string, unknown>): Promise<TDocument>;
  find(filter?: FilterQuery<unknown>): Promise<TDocument[]>;
  findById(id: string): Promise<TDocument | null>;
  findOne(filter: FilterQuery<unknown>): Promise<TDocument | null>;
  save(document: SaveableDocument<TDocument>): Promise<TDocument>;
}

export class BaseRepository<TDocument> implements IBaseRepository<TDocument> {
  constructor(protected readonly model: Model<any>) {}

  create(data: Record<string, unknown>) {
    return this.model.create(data) as Promise<TDocument>;
  }

  find(filter: FilterQuery<unknown> = {}) {
    return this.model.find(filter).exec() as Promise<TDocument[]>;
  }

  findById(id: string) {
    return this.model.findById(id).exec() as Promise<TDocument | null>;
  }

  findOne(filter: FilterQuery<unknown>) {
    return this.model.findOne(filter).exec() as Promise<TDocument | null>;
  }

  save(document: SaveableDocument<TDocument>) {
    return document.save();
  }
}
