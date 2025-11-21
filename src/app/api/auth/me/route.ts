import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/sessions';
import { getUserById, getSafeUser } from '@/lib/users';

export async function GET(request: NextRequest) {
    try {
        const token = request.cookies.get('auth_token')?.value;

        if (!token) {
            return NextResponse.json(
                { error: 'Nu ești autentificat' },
                { status: 401 }
            );
        }

        const userId = verifySession(token);
        if (!userId) {
            return NextResponse.json(
                { error: 'Sesiune invalidă sau expirată' },
                { status: 401 }
            );
        }

        const user = getUserById(userId);
        if (!user) {
            return NextResponse.json(
                { error: 'Utilizator negăsit' },
                { status: 404 }
            );
        }

        return NextResponse.json({ user: getSafeUser(user) });
    } catch (error) {
        console.error('Me error:', error);
        return NextResponse.json(
            { error: 'Eroare la verificare' },
            { status: 500 }
        );
    }
}
