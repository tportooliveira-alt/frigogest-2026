import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const getEnv = (key: string): string | undefined => {
    // Vite replaces import.meta.env at build time
    if (typeof process !== 'undefined' && (process.env as any)[key]) {
        return (process.env as any)[key];
    }
    if (typeof import.meta !== 'undefined' && (import.meta as any)?.env?.[key]) {
        return (import.meta as any).env[key];
    }
    return undefined;
};

const firebaseConfig = {
    apiKey: getEnv('VITE_FIREBASE_API_KEY'),
    authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN'),
    projectId: getEnv('VITE_FIREBASE_PROJECT_ID'),
    storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
    appId: getEnv('VITE_FIREBASE_APP_ID')
};

// Verifica se as configurações estão presentes
const hasConfig = firebaseConfig.apiKey && firebaseConfig.projectId;

if (!hasConfig) {
    console.warn('⚠️ Firebase configuration not found. Please set environment variables.');
}

// Initialize Firebase
const app = hasConfig ? initializeApp(firebaseConfig) : null;

// Initialize services
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
export const storage = app ? getStorage(app) : null;

export default { auth, db, storage };
