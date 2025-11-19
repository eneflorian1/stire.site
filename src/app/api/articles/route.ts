import { NextRequest, NextResponse } from 'next/server';
import { createArticle, deleteArticlesByIds, getArticles } from '@/lib/articles';
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
    const trimmedContent = typeof payload?.content === 'string' ? payload.content.trim() : '';
    const trimmedCategory = typeof payload?.category === 'string' ? payload.category.trim() : '';
    const imageUrl =
      typeof payload?.imageUrl === 'string' && payload.imageUrl.trim().length > 0
        ? payload.imageUrl.trim()
        : undefined;
    const rawHashtags = Array.isArray(payload?.hashtags)
      ? payload.hashtags.join(', ')
      : typeof payload?.hashtags === 'string'
      ? payload.hashtags
      : '';

    if (!trimmedTitle || !trimmedContent || !trimmedCategory) {
      return NextResponse.json(
        { error: 'Titlul, continutul si categoria sunt obligatorii.' },
        { status: 400 }
      );
    }

    const article = await createArticle(
      {
        title: trimmedTitle,
        content: trimmedContent,
        category: trimmedCategory,
        imageUrl,
        status: payload.status === 'draft' ? 'draft' : 'published',
        publishedAt: payload.publishedAt,
        hashtags: rawHashtags?.trim(),
      },
      { matchExistingCategory: Boolean(payload?.autoCategorize) }
    );

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

export async function DELETE(request: NextRequest) {
  try {
    const payload = await request.json().catch(() => null);
    const ids: string[] = Array.isArray(payload?.ids) ? payload.ids : [];
    if (!ids.length) {
      return NextResponse.json({ error: 'Nu s-au furnizat articole de sters.' }, { status: 400 });
    }
    const { deleted, articles } = await deleteArticlesByIds(ids);
    return NextResponse.json({ deleted, articles });
  } catch (error) {
    console.error('DELETE /api/articles failed', error);
    return NextResponse.json(
      { error: 'Nu am putut sterge articolele.' },
      { status: 500 }
    );
  }
}
