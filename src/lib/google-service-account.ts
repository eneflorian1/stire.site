import path from 'path';
import { readJsonFile, writeJsonFile } from './json-store';

type StoredCredentials = {
  raw: string | null;
  updatedAt?: string | null;
};

const DATA_PATH = path.join(process.cwd(), 'data', 'smgoogle-account.json');
const DEFAULT_DATA: StoredCredentials = { raw: null, updatedAt: null };

export const loadStoredGoogleCredentials = async (): Promise<StoredCredentials | null> => {
  const data = await readJsonFile<StoredCredentials>(DATA_PATH, DEFAULT_DATA);
  if (!data.raw) {
    return null;
  }

  return {
    raw: data.raw,
    updatedAt: data.updatedAt ?? null,
  };
};

export const saveStoredGoogleCredentials = async (raw: string) => {
  const payload: StoredCredentials = {
    raw,
    updatedAt: new Date().toISOString(),
  };
  await writeJsonFile(DATA_PATH, payload);
  return payload;
};

export const deleteStoredGoogleCredentials = async () => {
  await writeJsonFile(DATA_PATH, DEFAULT_DATA);
};
