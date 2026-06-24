import fs from "fs";
import path from "path";

export interface StorageAdapter {
  upload(fileBuffer: Buffer, projectId: number | string, filename: string): Promise<string>;
  download(storagePath: string): Promise<Buffer>;
  delete(storagePath: string): Promise<void>;
}

export class LocalDiskStorageAdapter implements StorageAdapter {
  private readonly uploadsRoot: string;

  constructor(uploadsRoot: string = path.resolve("uploads")) {
    this.uploadsRoot = uploadsRoot;
  }

  async upload(fileBuffer: Buffer, projectId: number | string, filename: string): Promise<string> {
    const dir = path.join(this.uploadsRoot, "projects", String(projectId), "files");
    fs.mkdirSync(dir, { recursive: true });
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const ext = path.extname(filename) || "";
    const storagePath = path.join(dir, `${unique}${ext}`);
    fs.writeFileSync(storagePath, fileBuffer);
    return storagePath;
  }

  async download(storagePath: string): Promise<Buffer> {
    return fs.readFileSync(storagePath);
  }

  async delete(storagePath: string): Promise<void> {
    try {
      fs.unlinkSync(storagePath);
    } catch {
      void 0;
    }
  }
}

export const storage: StorageAdapter = new LocalDiskStorageAdapter();
