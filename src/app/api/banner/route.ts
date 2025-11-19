import { NextRequest, NextResponse } from 'next/server';
import { getBannerSettings, updateBannerSettings } from '@/lib/banner';

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
