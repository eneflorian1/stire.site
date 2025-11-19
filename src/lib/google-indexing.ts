import { JWT } from 'google-auth-library';

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
};

export type SubmissionResult = SubmissionSuccess | SubmissionSkipped | SubmissionFailure;

const INDEXING_SCOPE = 'https://www.googleapis.com/auth/indexing';
const INDEXING_ENDPOINT = 'https://indexing.googleapis.com/v3/urlNotifications:publish';

const getCredentials = () => {
  const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS_JSON is not valid JSON.');
  }
};

export const submitUrlToGoogle = async (url: string): Promise<SubmissionResult> => {
  const credentials = getCredentials();
  if (!credentials) {
    return {
      success: false,
      skipped: true,
      reason: 'Missing GOOGLE_APPLICATION_CREDENTIALS_JSON environment variable.',
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

    if (!response.ok) {
      return {
        success: false,
        status: response.status,
        error: `Google Indexing API rejected the request: ${response.statusText}`,
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
