import { NextRequest, NextResponse } from 'next/server';
import { createUser, getUserByEmail, verifyPassword, getSafeUser } from '@/lib/users';
import { createSession } from '@/lib/sessions';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { email, password } = body;

        if (!email || !password) {
            return NextResponse.json(
                { error: 'Email și parola sunt obligatorii' },
                { status: 400 }
            );
        }

        // Find user
        const user = getUserByEmail(email);
        if (!user) {
            return NextResponse.json(
                { error: 'Email sau parolă incorectă' },
                { status: 401 }
            );
        }

        // Verify password
        if (!verifyPassword(password, user.password)) {
            return NextResponse.json(
                { error: 'Email sau parolă incorectă' },
                { status: 401 }
            );
        }

        // Create session
        const session = createSession(user.id);

        // Return user data and token
        return NextResponse.json({
            user: getSafeUser(user),
            token: session.token,
        });
    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json(
            { error: 'Eroare la autentificare' },
            { status: 500 }
        );
    }
}
