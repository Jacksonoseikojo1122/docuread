import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { DocType } from "./schemas.js";
import type { FieldResult } from "./validate.js";

export type ReviewItem = {
  id: string;
  type: DocType;
  createdAt: string;
  status: "pending" | "resolved";
  fields: Record<string, FieldResult>;
  notes: string;
  resolvedAt?: string;
  corrections?: Record<string, string | null>;
};

export interface ReviewStore {
  add(item: ReviewItem): Promise<void>;
  list(status?: ReviewItem["status"]): Promise<ReviewItem[]>;
  get(id: string): Promise<ReviewItem | undefined>;
  resolve(id: string, corrections: Record<string, string | null>): Promise<ReviewItem | undefined>;
}

export class MemoryReviewStore implements ReviewStore {
  protected items = new Map<string, ReviewItem>();

  async add(item: ReviewItem) {
    this.items.set(item.id, item);
  }
  async list(status?: ReviewItem["status"]) {
    const all = [...this.items.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return status ? all.filter((i) => i.status === status) : all;
  }
  async get(id: string) {
    return this.items.get(id);
  }
  async resolve(id: string, corrections: Record<string, string | null>) {
    const item = this.items.get(id);
    if (!item) return undefined;
    // Only fields the document actually has can be corrected.
    const known = Object.fromEntries(Object.entries(corrections).filter(([k]) => k in item.fields));
    const done: ReviewItem = { ...item, status: "resolved", resolvedAt: new Date().toISOString(), corrections: known };
    this.items.set(id, done);
    return done;
  }
}

/** Same as memory, but survives a restart. Fine for a demo; use Postgres for real traffic. */
export class FileReviewStore extends MemoryReviewStore {
  private loaded = false;
  constructor(private path: string) {
    super();
  }
  private async load() {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const rows = JSON.parse(await readFile(this.path, "utf8")) as ReviewItem[];
      for (const r of rows) this.items.set(r.id, r);
    } catch {
      /* first run: no file yet */
    }
  }
  private async save() {
    await mkdir(dirname(this.path), { recursive: true });
    await writeFile(this.path, JSON.stringify([...this.items.values()], null, 2));
  }
  override async add(item: ReviewItem) {
    await this.load();
    await super.add(item);
    await this.save();
  }
  override async list(status?: ReviewItem["status"]) {
    await this.load();
    return super.list(status);
  }
  override async get(id: string) {
    await this.load();
    return super.get(id);
  }
  override async resolve(id: string, corrections: Record<string, string | null>) {
    await this.load();
    const r = await super.resolve(id, corrections);
    if (r) await this.save();
    return r;
  }
}
