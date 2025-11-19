import { NextRequest, NextResponse } from 'next/server';
import { createArticle, getArticles } from '@/lib/articles';
import { submitUrlToGoogle } from '@/lib/google-indexing';
import { logSMGoogleSubmission } from '@/lib/smgoogle';

export async function GET() {
  try {
    const articles = await getArticles();
    return NextResponse.json({ articles });
  } catch (error) {
    console.error('GET /api/articles failed', error);
    return NextResponse.json(
      { error: 'Nu am reusit sa incarc articolele.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const trimmedTitle = typeof payload?.title === 'string' ? payload.title.trim() : '';
    const trimmedSummary = typeof payload?.summary === 'string' ? payload.summary.trim() : '';
    const trimmedContent = typeof payload?.content === 'string' ? payload.content.trim() : '';
    const trimmedCategory = typeof payload?.category === 'string' ? payload.category.trim() : '';
    const imageUrl =
      typeof payload?.imageUrl === 'string' && payload.imageUrl.trim().length > 0
        ? payload.imageUrl.trim()
        : undefined;

    if (!trimmedTitle || !trimmedSummary || !trimmedContent || !trimmedCategory) {
      return NextResponse.json(
        { error: 'Titlul, descrierea, continutul si categoria sunt obligatorii.' },
        { status: 400 }
      );
    }

    const article = await createArticle({
      title: trimmedTitle,
      summary: trimmedSummary,
      content: trimmedContent,
      category: trimmedCategory,
      imageUrl,
      status: payload.status === 'draft' ? 'draft' : 'published',
      publishedAt: payload.publishedAt,
    });

    const submission = await submitUrlToGoogle(article.url);
    await logSMGoogleSubmission(article.url, submission, 'auto');

    return NextResponse.json(
      {
        article,
        submission,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/articles failed', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Eroare neasteptata.' },
      { status: 500 }
    );
  }
}
