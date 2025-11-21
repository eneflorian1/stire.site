import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface User {
    id: string;
    email: string;
    phone?: string;
    password: string; // hashed
    name: string;
    createdAt: string;
    savedArticles: string[]; // article IDs
    aiInteractions: {
        query: string;
        timestamp: string;
        results?: any;
    }[];
    interests: string[]; // categories or topics
    preferences: {
        notifications: boolean;
        newsletter: boolean;
        theme: 'light' | 'dark' | 'auto';
    };
}

const DATA_DIR = path.join(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize users file if it doesn't exist
if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2));
}

// Hash password using SHA-256
export function hashPassword(password: string): string {
    return crypto.createHash('sha256').update(password).digest('hex');
}

// Verify password
export function verifyPassword(password: string, hash: string): boolean {
    return hashPassword(password) === hash;
}

// Read all users
export function getUsers(): User[] {
    try {
        const data = fs.readFileSync(USERS_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading users:', error);
        return [];
    }
}

// Write users
function saveUsers(users: User[]): void {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// Get user by ID
export function getUserById(id: string): User | null {
    const users = getUsers();
    return users.find(u => u.id === id) || null;
}

// Get user by email
export function getUserByEmail(email: string): User | null {
    const users = getUsers();
    return users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
}

// Get user by phone
export function getUserByPhone(phone: string): User | null {
    const users = getUsers();
    return users.find(u => u.phone === phone) || null;
}

// Create new user
export function createUser(data: {
    email: string;
    phone?: string;
    password: string;
    name: string;
}): User {
    const users = getUsers();

    // Check if user already exists
    if (getUserByEmail(data.email)) {
        throw new Error('Email already registered');
    }

    if (data.phone && getUserByPhone(data.phone)) {
        throw new Error('Phone number already registered');
    }

    const user: User = {
        id: crypto.randomUUID(),
        email: data.email,
        phone: data.phone,
        password: hashPassword(data.password),
        name: data.name,
        createdAt: new Date().toISOString(),
        savedArticles: [],
        aiInteractions: [],
        interests: [],
        preferences: {
            notifications: true,
            newsletter: true,
            theme: 'auto',
        },
    };

    users.push(user);
    saveUsers(users);

    return user;
}

// Update user
export function updateUser(id: string, updates: Partial<Omit<User, 'id' | 'createdAt'>>): User | null {
    const users = getUsers();
    const index = users.findIndex(u => u.id === id);

    if (index === -1) {
        return null;
    }

    users[index] = { ...users[index], ...updates };
    saveUsers(users);

    return users[index];
}

// Delete user
export function deleteUser(id: string): boolean {
    const users = getUsers();
    const filtered = users.filter(u => u.id !== id);

    if (filtered.length === users.length) {
        return false;
    }

    saveUsers(filtered);
    return true;
}

// Add saved article
export function addSavedArticle(userId: string, articleId: string): User | null {
    const user = getUserById(userId);
    if (!user) return null;

    if (!user.savedArticles.includes(articleId)) {
        user.savedArticles.push(articleId);
        return updateUser(userId, { savedArticles: user.savedArticles });
    }

    return user;
}

// Remove saved article
export function removeSavedArticle(userId: string, articleId: string): User | null {
    const user = getUserById(userId);
    if (!user) return null;

    user.savedArticles = user.savedArticles.filter(id => id !== articleId);
    return updateUser(userId, { savedArticles: user.savedArticles });
}

// Add AI interaction
export function addAIInteraction(userId: string, query: string, results?: any): User | null {
    const user = getUserById(userId);
    if (!user) return null;

    user.aiInteractions.push({
        query,
        timestamp: new Date().toISOString(),
        results,
    });

    return updateUser(userId, { aiInteractions: user.aiInteractions });
}

// Update interests
export function updateInterests(userId: string, interests: string[]): User | null {
    return updateUser(userId, { interests });
}

// Get user without sensitive data
export function getSafeUser(user: User): Omit<User, 'password'> {
    const { password, ...safeUser } = user;
    return safeUser;
}
