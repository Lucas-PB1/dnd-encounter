import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firestore with Database ID from configuration
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Initialize Auth
export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

// Custom error handling function conforming to Firestore rules auditing standards
export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Recursive helper to sanitize any data payload going to Firestore (eradicates 'undefined' values)
export function sanitizeData(val: any): any {
  if (val === undefined) {
    return null;
  }
  if (val === null) {
    return null;
  }
  if (Array.isArray(val)) {
    return val.map(v => sanitizeData(v));
  }
  if (typeof val === 'object') {
    // Check if it's a plain object (not a special instance, though ours should all be plain tables/JSON)
    const cleanObj: any = {};
    for (const key in val) {
      if (Object.prototype.hasOwnProperty.call(val, key)) {
        const item = val[key];
        if (item !== undefined) {
          cleanObj[key] = sanitizeData(item);
        }
      }
    }
    return cleanObj;
  }
  return val;
}

// Test Connection at Startup
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'combatSessions', 'TEST_CONN'));
    console.log("Firestore connection test: OK");
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. The Firestore client appears to be offline.");
    }
  }
}
