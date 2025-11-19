import { NextRequest, NextResponse } from 'next/server';
import {
  deleteStoredGoogleCredentials,
  loadStoredGoogleCredentials,
  saveStoredGoogleCredentials,
} from '@/lib/google-service-account';

type CredentialsSource = 'env' | 'stored' | 'missing';

export async function GET() {
  try {
    const envValue = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    if (envValue) {
      return NextResponse.json<{ source: CredentialsSource; hasValue: boolean }>({
        source: 'env',
        hasValue: true,
      });
    }

    const stored = await loadStoredGoogleCredentials();
    if (stored?.raw) {
      return NextResponse.json({
        source: 'stored',
        json: stored.raw,
        updatedAt: stored.updatedAt ?? null,
      });
    }

    return NextResponse.json({ source: 'missing' });
  } catch (error) {
    console.error('/api/smgoogle/credentials GET error', error);
    return NextResponse.json(
      { error: 'Nu am putut incarca credentialele.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json().catch(() => null);
    const raw = typeof payload?.json === 'string' ? payload.json.trim() : '';
    if (!raw) {
      return NextResponse.json({ error: 'Introdu continutul JSON.' }, { status: 400 });
    }

    try {
      const parsed = JSON.parse(raw);
      if (!parsed.client_email || !parsed.private_key) {
        return NextResponse.json(
          { error: 'JSON-ul trebuie sa contina campurile client_email si private_key.' },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json({ error: 'Continutul nu este JSON valid.' }, { status: 400 });
    }

    const saved = await saveStoredGoogleCredentials(raw);
    return NextResponse.json({
      source: 'stored',
      json: saved.raw,
      updatedAt: saved.updatedAt ?? null,
    });
  } catch (error) {
    console.error('/api/smgoogle/credentials POST error', error);
    return NextResponse.json(
      { error: 'Nu am putut salva credentialele.' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    await deleteStoredGoogleCredentials();
    return NextResponse.json({ source: 'missing' });
  } catch (error) {
    console.error('/api/smgoogle/credentials DELETE error', error);
    return NextResponse.json(
      { error: 'Nu am putut sterge credentialele.' },
      { status: 500 }
    );
  }
}
