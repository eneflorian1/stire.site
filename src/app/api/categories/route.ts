import { NextRequest, NextResponse } from 'next/server';
import { createCategory, deleteCategoriesByIds, getCategories } from '@/lib/categories';

export async function GET() {
  try {
    const categories = await getCategories();
    return NextResponse.json({ categories });
  } catch (error) {
    console.error('/api/categories GET error', error);
    return NextResponse.json({ error: 'Nu am putut incarca categoriile.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const name = typeof payload?.name === 'string' ? payload.name.trim() : '';

    if (!name) {
      return NextResponse.json(
        { error: 'Numele categoriei este obligatoriu.' },
        { status: 400 }
      );
    }

    const category = await createCategory({ name });
    return NextResponse.json({ category });
  } catch (error) {
    console.error('/api/categories POST error', error);
    return NextResponse.json({ error: 'Nu am putut salva categoria.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const payload = await request.json().catch(() => null);
    const ids: string[] = Array.isArray(payload?.ids) ? payload.ids : [];
    if (!ids.length) {
      return NextResponse.json({ error: 'Nu s-au furnizat categorii de sters.' }, { status: 400 });
    }
    const result = await deleteCategoriesByIds(ids);
    return NextResponse.json(result);
  } catch (error) {
    console.error('/api/categories DELETE error', error);
    return NextResponse.json({ error: 'Nu am putut sterge categoriile.' }, { status: 500 });
  }
}
