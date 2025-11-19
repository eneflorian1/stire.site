import { randomUUID } from 'crypto';
import path from 'path';
import { readJsonFile, writeJsonFile } from './json-store';

export type GeminiState = {
  apiKey: string | null;
  status: 'idle' | 'running' | 'stopped';
  startedAt: string | null;
  lastError: string | null;
  logs: GeminiLog[];
};

export type GeminiLog = {
  id: string;
  message: string;
  level: 'info' | 'error';
  createdAt: string;
};

const DATA_PATH = path.join(process.cwd(), 'data', 'gemini.json');

const defaultState: GeminiState = {
  apiKey: null,
  status: 'idle',
  startedAt: null,
  lastError: 'Missing Gemini API key',
  logs: [],
};

const createLogEntry = (
  message: string,
  level: GeminiLog['level'] = 'info',
  createdAt: string = new Date().toISOString()
): GeminiLog => ({
  id: randomUUID(),
  message,
  level,
  createdAt,
});

const normalizeState = (state: Partial<GeminiState>): GeminiState => ({
  apiKey: state.apiKey ?? null,
  status: state.status ?? 'idle',
  startedAt: state.startedAt ?? null,
  lastError: state.lastError ?? defaultState.lastError,
  logs: (state.logs ?? []).map((log) => ({
    id: log.id ?? randomUUID(),
    message: log.message ?? '',
    level: log.level === 'error' ? 'error' : 'info',
    createdAt: log.createdAt ?? new Date().toISOString(),
  })),
});

export const getGeminiState = async (): Promise<GeminiState> => {
  const data = await readJsonFile<GeminiState>(DATA_PATH, defaultState);
  return normalizeState(data);
};

const persistState = async (state: GeminiState) => {
  await writeJsonFile(DATA_PATH, state);
  return state;
};

export const updateGeminiApiKey = async (apiKey: string) => {
  const state = await getGeminiState();
  state.apiKey = apiKey.trim() || null;
  state.lastError = state.apiKey ? null : defaultState.lastError;
  const message = state.apiKey
    ? 'Cheia Gemini a fost actualizata.'
    : 'Cheia Gemini a fost stearsa.';
  state.logs = [createLogEntry(message), ...state.logs].slice(0, 100);
  return persistState(state);
};

export const runGeminiAction = async (action: 'start' | 'stop' | 'reset') => {
  const state = await getGeminiState();
  const now = new Date().toISOString();

  if (action === 'start') {
    if (!state.apiKey) {
      state.lastError = defaultState.lastError;
      state.logs.unshift(createLogEntry('Nu poti porni fara cheia API.', 'error', now));
    } else {
      state.status = 'running';
      state.startedAt = now;
      state.lastError = null;
      state.logs.unshift(createLogEntry('Gemini a fost pornit.', 'info', now));
    }
  }

  if (action === 'stop') {
    state.status = 'stopped';
    state.logs.unshift(createLogEntry('Gemini a fost oprit.', 'info', now));
  }

  if (action === 'reset') {
    state.status = 'idle';
    state.startedAt = null;
    state.lastError = state.apiKey ? null : defaultState.lastError;
    state.logs.unshift(createLogEntry('Starea Gemini a fost resetata.', 'info', now));
  }

  state.logs = state.logs.slice(0, 100);
  return persistState(state);
};
