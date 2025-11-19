import { randomUUID } from 'crypto';
import path from 'path';
import { readJsonFile, writeJsonFile } from './json-store';
import { submitUrlToGoogle, type SubmissionResult } from './google-indexing';

export type SMGoogleLog = {
  id: string;
  url: string;
  status: 'success' | 'skipped' | 'error';
  detail: string;
  submission: SubmissionResult;
  createdAt: string;
  source: 'auto' | 'manual';
};

const DATA_PATH = path.join(process.cwd(), 'data', 'smgoogle.json');

const normalizeLog = (log: Partial<SMGoogleLog>): SMGoogleLog | null => {
  if (!log.url || !log.submission) return null;

  const status: SMGoogleLog['status'] =
    log.status ?? (log.submission.success ? 'success' : log.submission.skipped ? 'skipped' : 'error');
  const now = new Date().toISOString();
  return {
    id: log.id ?? randomUUID(),
    url: log.url,
    status,
    detail: log.detail ?? '',
    submission: log.submission,
    source: log.source === 'manual' ? 'manual' : 'auto',
    createdAt: log.createdAt ?? now,
  };
};

const getRawLogs = async () => {
  const data = await readJsonFile<SMGoogleLog[]>(DATA_PATH, []);
  return data
    .map((item) => normalizeLog(item))
    .filter((item): item is SMGoogleLog => Boolean(item));
};

const saveLogs = async (logs: SMGoogleLog[]) => writeJsonFile(DATA_PATH, logs);

export const getSMGoogleLogs = async () => {
  const logs = await getRawLogs();
  return logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

export const logSMGoogleSubmission = async (
  url: string,
  submission: SubmissionResult,
  source: 'auto' | 'manual' = 'auto'
) => {
  const logs = await getSMGoogleLogs();
  const status: SMGoogleLog['status'] = submission.success
    ? 'success'
    : submission.skipped
    ? 'skipped'
    : 'error';

  const log: SMGoogleLog = {
    id: randomUUID(),
    url,
    status,
    detail: submission.success
      ? 'Indexare trimisa'
      : submission.skipped
      ? submission.reason ?? 'Trimitere sarita'
      : submission.error ?? 'Eroare Google Indexing',
    submission,
    createdAt: new Date().toISOString(),
    source,
  };

  await saveLogs([log, ...logs]);
  return log;
};

export const submitManualSMGoogle = async (url: string) => {
  const submission = await submitUrlToGoogle(url);
  const log = await logSMGoogleSubmission(url, submission, 'manual');
  return { submission, log };
};
