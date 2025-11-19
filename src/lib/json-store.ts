import { promises as fs } from 'fs';
import path from 'path';

const ensureDir = async (filePath: string) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
};

export const readJsonFile = async <T>(filePath: string, fallback: T): Promise<T> => {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      await ensureDir(filePath);
      await fs.writeFile(filePath, JSON.stringify(fallback, null, 2), 'utf8');
      return fallback;
    }
    try {
      await ensureDir(filePath);
    } catch {
      // ignore
    }
    return fallback;
  }
};

export const writeJsonFile = async <T>(filePath: string, data: T) => {
  await ensureDir(filePath);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
};
