import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import firebaseConfig from "../firebase-applet-config.json";

// Initialize Firebase App singleton
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore with custom databaseId if specified in config
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || undefined);

// Initialize Firebase Authentication
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export default app;
