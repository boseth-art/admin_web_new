import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

// All values are loaded from environment variables (.env file).
// Never hardcode credentials here — the .env file is excluded from Git.
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId:     import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Guard: fail loudly in development if env vars are missing
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  throw new Error(
    '[FinGuard] Firebase configuration is missing. ' +
    'Make sure your .env file contains all VITE_FIREBASE_* variables.'
  );
}

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);
export const functionsInstance = getFunctions(app);
export default app;
