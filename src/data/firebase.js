import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Double check if environment variables are provided via Vite's .env file.
// Alternatively, paste your config directly into the fallback values below.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAxl4imxZQB7bbt4z_cyAubiwGm7_CI5UE",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "smart-financial-management.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "smart-financial-management",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "smart-financial-management.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "748858256335",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:748858256335:web:91c7aff8b0524b7c3a00ba",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-Y1Z9C5EHLM"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
