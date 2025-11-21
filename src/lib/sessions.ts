import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface Session {
    id: string;
    userId: string;
    token: string;
    createdAt: string;
    expiresAt: string;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize sessions file if it doesn't exist
if (!fs.existsSync(SESSIONS_FILE)) {
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify([], null, 2));
}

// Read all sessions
function getSessions(): Session[] {
    try {
        const data = fs.readFileSync(SESSIONS_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading sessions:', error);
        return [];
    }
}

// Write sessions
function saveSessions(sessions: Session[]): void {
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
}

// Generate random token
function generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
}

// Create session
export function createSession(userId: string): Session {
    const sessions = getSessions();

    // Remove expired sessions
    cleanExpiredSessions();

    const session: Session = {
        id: crypto.randomUUID(),
        userId,
        token: generateToken(),
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
    };

    sessions.push(session);
    saveSessions(sessions);

    return session;
}

// Get session by token
export function getSessionByToken(token: string): Session | null {
    const sessions = getSessions();
    const session = sessions.find(s => s.token === token);

    if (!session) {
        return null;
    }

    // Check if expired
    if (new Date(session.expiresAt) < new Date()) {
        deleteSession(session.id);
        return null;
    }

    return session;
}

// Delete session
export function deleteSession(sessionId: string): boolean {
    const sessions = getSessions();
    const filtered = sessions.filter(s => s.id !== sessionId);

    if (filtered.length === sessions.length) {
        return false;
    }

    saveSessions(filtered);
    return true;
}

// Delete all sessions for a user
export function deleteUserSessions(userId: string): void {
    const sessions = getSessions();
    const filtered = sessions.filter(s => s.userId !== userId);
    saveSessions(filtered);
}

// Clean expired sessions
export function cleanExpiredSessions(): void {
    const sessions = getSessions();
    const now = new Date();
    const valid = sessions.filter(s => new Date(s.expiresAt) > now);
    saveSessions(valid);
}

// Verify session and get user ID
export function verifySession(token: string): string | null {
    const session = getSessionByToken(token);
    return session ? session.userId : null;
}
