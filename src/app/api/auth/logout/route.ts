import { NextRequest, NextResponse } from 'next/server';
import { deleteSession } from '@/lib/sessions';

export async function POST(request: NextRequest) {
    try {
        const token = request.cookies.get('auth_token')?.value;

        if (token) {
            // Find and delete session by token
            const sessions = require('@/lib/sessions').getSessions();
            const session = sessions.find((s: any) => s.token === token);
            if (session) {
                deleteSession(session.id);
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Logout error:', error);
        return NextResponse.json(
            { error: 'Eroare la deconectare' },
            { status: 500 }
        );
    }
}
