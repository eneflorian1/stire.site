import { NextRequest, NextResponse } from 'next/server';
import { createUser, getSafeUser } from '@/lib/users';
import { createSession } from '@/lib/sessions';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { email, phone, password, name } = body;

        if (!email || !password) {
            return NextResponse.json(
                { error: 'Email și parola sunt obligatorii' },
                { status: 400 }
            );
        }

        // Set default name if not provided
        const finalName = name || 'Utilizator';

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return NextResponse.json(
                { error: 'Format email invalid' },
                { status: 400 }
            );
        }

        // Validate password length
        if (password.length < 6) {
            return NextResponse.json(
                { error: 'Parola trebuie să aibă cel puțin 6 caractere' },
                { status: 400 }
            );
        }

        // Create user
        const user = createUser({ email, phone, password, name: finalName });

        // Create session
        const session = createSession(user.id);

        // Return user data and token
        return NextResponse.json({
            user: getSafeUser(user),
            token: session.token,
        });
    } catch (error: any) {
        console.error('Register error:', error);

        if (error.message === 'Email already registered') {
            return NextResponse.json(
                { error: 'Acest email este deja înregistrat' },
                { status: 409 }
            );
        }

        if (error.message === 'Phone number already registered') {
            return NextResponse.json(
                { error: 'Acest număr de telefon este deja înregistrat' },
                { status: 409 }
            );
        }

        return NextResponse.json(
            { error: 'Eroare la înregistrare' },
            { status: 500 }
        );
    }
}
