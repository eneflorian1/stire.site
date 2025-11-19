import { NextRequest, NextResponse } from 'next/server';
import { createCategory, getCategories } from '@/lib/categories';

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
    const description =
      typeof payload?.description === 'string' ? payload.description.trim() : undefined;

    if (!name) {
      return NextResponse.json(
        { error: 'Numele categoriei este obligatoriu.' },
        { status: 400 }
      );
    }

    const category = await createCategory({ name, description });
    return NextResponse.json({ category });
  } catch (error) {
    console.error('/api/categories POST error', error);
    return NextResponse.json({ error: 'Nu am putut salva categoria.' }, { status: 500 });
  }
}
