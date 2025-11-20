import { JWT } from 'google-auth-library';
import { loadStoredGoogleCredentials } from './google-service-account';

type SubmissionSuccess = {
  success: true;
  status: number;
  body: unknown;
};

type SubmissionSkipped = {
  success: false;
  skipped: true;
  reason: string;
};

type SubmissionFailure = {
  success: false;
  skipped?: false;
  status?: number;
  error: string;
  // Optional raw error payload from Google (for debugging)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  googleErrorBody?: any;
};

export type SubmissionResult = SubmissionSuccess | SubmissionSkipped | SubmissionFailure;

const INDEXING_SCOPE = 'https://www.googleapis.com/auth/indexing';
const INDEXING_ENDPOINT = 'https://indexing.googleapis.com/v3/urlNotifications:publish';

const parseJson = (raw: string, source: 'env' | 'stored') => {
  try {
    return JSON.parse(raw);
  } catch {
    if (source === 'stored') {
      throw new Error('Credentialele salvate nu contin JSON valid. Incarca din nou fisierul.');
    }
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS_JSON din .env nu este JSON valid.');
  }
};

const getCredentials = async () => {
  const stored = await loadStoredGoogleCredentials();
  if (stored?.raw) {
    return parseJson(stored.raw, 'stored');
  }

  const rawEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (rawEnv) {
    return parseJson(rawEnv, 'env');
  }

  return null;
};

export const submitUrlToGoogle = async (url: string): Promise<SubmissionResult> => {
  let credentials: ReturnType<typeof JSON.parse> | null = null;
  try {
    credentials = await getCredentials();
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Nu am putut incarca credentialele.',
    };
  }

  if (!credentials) {
    return {
      success: false,
      skipped: true,
      reason:
        'Lipsesc credentialele Google Indexing. Incarca JSON-ul in dashboard sau seteaza GOOGLE_APPLICATION_CREDENTIALS_JSON.',
    };
  }

  const client = new JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: [INDEXING_SCOPE],
  });

  try {
    const { access_token } = await client.authorize();
    if (!access_token) {
      return { success: false, error: 'Failed to retrieve access token from Google.' };
    }

    const response = await fetch(INDEXING_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${access_token}`,
      },
      body: JSON.stringify({
        url,
        type: 'URL_UPDATED',
      }),
    });

    const body = await response.json().catch(() => ({}));
    // eslint-disable-next-line no-console
    console.log('[Google Indexing] response', {
      url,
      status: response.status,
      ok: response.ok,
      body,
    });

    if (!response.ok) {
      // Try to surface a clearer message from Google's error payload, if present
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anyBody = body as any;
      const googleErrorMessage: string | undefined = anyBody?.error?.message;
      const baseMessage =
        googleErrorMessage ||
        `Google Indexing API rejected the request: ${response.statusText || 'Unknown error'}`;
      return {
        success: false,
        status: response.status,
        error: `${baseMessage} (status: ${response.status})`,
        googleErrorBody: anyBody?.error ?? anyBody,
      };
    }

    return { success: true, status: response.status, body };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown Google submission error.',
    };
  }
};
