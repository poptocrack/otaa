import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, type User } from 'firebase/auth';
import { getFirestore, collection, getDocs, query, orderBy, limit, where, Timestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth };

export async function signInAdmin(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function onAuthChange(cb: (user: User | null) => void) {
  return onAuthStateChanged(auth, cb);
}

export interface UserProfile {
  uid: string;
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
  lastSeen: Timestamp;
}

export interface RunData {
  uid: string;
  mode: string;
  score: number;
  wave: number;
  kills: number;
  level: number;
  duration: number;
  scrapEarned: number;
  coresEarned: number;
  equippedWeapons: string[];
  hexDifficulty?: number;
  hexBiome?: string;
  chainCount?: number;
  survived: boolean;
  questsCompleted: number;
  deathWave?: number;
  timestamp: Timestamp;
}

export interface EventData {
  uid: string;
  event: string;
  totalRuns?: number;
  totalKills?: number;
  weaponId?: string;
  timestamp: Timestamp;
}

export async function fetchUsers(): Promise<UserProfile[]> {
  const q = query(collection(db, 'users'), orderBy('lastSeen', 'desc'), limit(200));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() } as UserProfile));
}

export async function fetchAllRuns(max = 500): Promise<RunData[]> {
  const q = query(collection(db, 'runs'), orderBy('timestamp', 'desc'), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as RunData);
}

export async function fetchUserRuns(uid: string, max = 50): Promise<RunData[]> {
  const q = query(collection(db, 'runs'), where('uid', '==', uid), orderBy('timestamp', 'desc'), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as RunData);
}

export async function fetchEvents(max = 200): Promise<EventData[]> {
  const q = query(collection(db, 'events'), orderBy('timestamp', 'desc'), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as EventData);
}
