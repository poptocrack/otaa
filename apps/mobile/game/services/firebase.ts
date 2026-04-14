import { Platform } from 'react-native';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  signInAnonymously,
  onAuthStateChanged,
  // @ts-expect-error getReactNativePersistence exists in firebase/auth
  getReactNativePersistence,
  type User,
  type Auth,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyAfNsXm5e9GVJ5fK8Mnmhye-4VmSus46Yo",
  authDomain: "otaa-2b14c.firebaseapp.com",
  projectId: "otaa-2b14c",
  storageBucket: "otaa-2b14c.firebasestorage.app",
  messagingSenderId: "1002407809443",
  appId: "1:1002407809443:web:15862070250a54a6d44a16",
  measurementId: "G-CHDJ63X26E",
};

const app = initializeApp(firebaseConfig);

let auth: Auth;
if (Platform.OS === 'web') {
  auth = getAuth(app);
} else {
  // React Native: use AsyncStorage for auth persistence
  const AsyncStorage = require('@react-native-async-storage/async-storage').default;
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
}

export { app, auth };

export async function signInAnon(): Promise<User> {
  const credential = await signInAnonymously(auth);
  return credential.user;
}

export function getCurrentUser(): User | null {
  return auth.currentUser;
}

export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

// --- Firestore ---
import { getFirestore, doc, setDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';

const db = getFirestore(app);
export { db };

/** Save run data to Firestore (non-blocking, fire and forget) */
export function saveRunData(uid: string, data: {
  mode: string;
  score: number;
  wave: number;
  kills: number;
  level: number;
  duration: number; // seconds
  scrapEarned: number;
  coresEarned: number;
  equippedWeapons: string[];
  hexDifficulty?: number;
  hexBiome?: string;
  chainCount?: number;
  survived: boolean;
  questsCompleted: number;
  deathWave?: number; // wave at death (for funnel analysis)
}) {
  addDoc(collection(db, 'runs'), {
    uid,
    ...data,
    timestamp: serverTimestamp(),
  }).catch(() => {});
}

/** Save/update user profile (non-blocking) */
export function saveUserProfile(uid: string, data: {
  totalRuns: number;
  totalKills: number;
  bestWave: number;
  bestScore: number;
  scrap: number;
  cores: number;
  unlockedWeapons: string[];
  equippedWeapons: string[];
  conqueredHexes: number;
  tankUpgrades: Record<string, number>;
}) {
  setDoc(doc(db, 'users', uid), {
    ...data,
    lastSeen: serverTimestamp(),
  }, { merge: true }).catch(() => {});
}

/** Track a one-time event (first weapon unlock, etc.) */
export function trackEvent(uid: string, event: string, data?: Record<string, unknown>) {
  addDoc(collection(db, 'events'), {
    uid,
    event,
    ...data,
    timestamp: serverTimestamp(),
  }).catch(() => {});
}
