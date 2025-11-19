import { promises as fs } from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { getBannerSettings, updateBannerSettings } from '@/lib/banner';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'banner');

export async function GET() {
  try {
    const banner = await getBannerSettings();
    return NextResponse.json({ banner });
  } catch (error) {
    console.error('/api/banner GET error', error);
    return NextResponse.json({ error: 'Nu am putut incarca anunturile.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') ?? '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const title = String(formData.get('title') ?? '').trim();
      const notes = String(formData.get('notes') ?? '').trim();
      const animated = formData.get('animated') === 'on' || formData.get('animated') === 'true';
      const file = formData.get('file');

      if (!title || !(file instanceof File)) {
        return NextResponse.json(
          { error: 'Completeaza titlul si incarca un fisier imagine/GIF.' },
          { status: 400 }
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      const bytes = Buffer.from(arrayBuffer);
      if (!bytes.length || bytes.length > 10 * 1024 * 1024) {
        return NextResponse.json(
          { error: 'Fisierul este gol sau prea mare (max 10MB).' },
          { status: 400 }
        );
      }

      await fs.mkdir(UPLOAD_DIR, { recursive: true });
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
      const filename = `${timestamp}-${safeName}`;
      const filePath = path.join(UPLOAD_DIR, filename);
      await fs.writeFile(filePath, bytes);

      const imageUrl = `/uploads/banner/${filename}`;

      const banner = await updateBannerSettings({
        title,
        imageUrl,
        animated,
        notes,
      });
      return NextResponse.json({ banner });
    }

    const payload = await request.json();
    const title = typeof payload?.title === 'string' ? payload.title.trim() : '';
    const imageUrl = typeof payload?.imageUrl === 'string' ? payload.imageUrl.trim() : '';
    const animated = Boolean(payload?.animated);
    const notes = typeof payload?.notes === 'string' ? payload.notes.trim() : '';

    if (!title || !imageUrl) {
      return NextResponse.json(
        { error: 'Completeaza titlul si URL-ul imaginii/GIF-ului.' },
        { status: 400 }
      );
    }

    const banner = await updateBannerSettings({
      title,
      imageUrl,
      animated,
      notes,
    });
    return NextResponse.json({ banner });
  } catch (error) {
    console.error('/api/banner POST error', error);
    return NextResponse.json({ error: 'Nu am putut salva bannerul.' }, { status: 500 });
  }
}
