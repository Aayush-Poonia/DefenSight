import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  deleteDoc,
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
  type DocumentData,
} from "firebase/firestore";
import { db } from "./firebase";

/** Sort key for Firestore Timestamp | serialized | missing (avoids composite index on userId + createdAt). */
function createdAtMs(data: DocumentData): number {
  const ts = data.createdAt as { toMillis?: () => number; seconds?: number } | undefined;
  if (ts && typeof ts.toMillis === "function") return ts.toMillis();
  if (ts && typeof ts.seconds === "number") return ts.seconds * 1000;
  return 0;
}

// Save a scan (news, phishing, password, email, email_content) to Firestore
export async function saveScan(userId: string, scanData: {
  type: "news" | "phishing" | "password" | "email" | "email_content";
  input: string;
  source?: string;
  result: any;
}) {
  return addDoc(collection(db, "scans"), {
    userId,
    ...scanData,
    createdAt: serverTimestamp(),
  });
}

// Get all scans for a user (single-field query + client sort — no composite index required)
export async function getUserScans(userId: string, scanType?: string) {
  const q = query(collection(db, "scans"), where("userId", "==", userId));
  const snap = await getDocs(q);
  let rows = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as (DocumentData & { id: string })[];
  if (scanType) rows = rows.filter((r) => r.type === scanType);
  rows.sort((a, b) => createdAtMs(b) - createdAtMs(a));
  return rows;
}

// Delete a scan
export async function deleteScan(scanId: string) {
  return deleteDoc(doc(db, "scans", scanId));
}

// Save a chat message
export async function saveChatMessage(userId: string, role: "user" | "assistant", content: string) {
  return addDoc(collection(db, "chats"), {
    userId,
    role,
    content,
    createdAt: serverTimestamp(),
  });
}

// Get chat history (single-field query + client sort — no composite index required)
export async function getChatHistory(userId: string) {
  const q = query(collection(db, "chats"), where("userId", "==", userId));
  const snap = await getDocs(q);
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as (DocumentData & { id: string })[];
  rows.sort((a, b) => createdAtMs(a) - createdAtMs(b));
  return rows;
}

// Delete all chats for a user
export async function clearChatHistory(userId: string) {
  const q = query(collection(db, "chats"), where("userId", "==", userId));
  const snap = await getDocs(q);
  const deletes = snap.docs.map((d) => deleteDoc(d.ref));
  await Promise.all(deletes);
}

// ---------- User profiles ----------
export type UserProfile = {
  fullName?: string;
  username?: string;
  bio?: string;
  email?: string;
  photoURL?: string;
  updatedAt?: any;
  createdAt?: any;
};

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const ref = doc(db, "profiles", userId);
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

export async function upsertUserProfile(userId: string, data: UserProfile) {
  const ref = doc(db, "profiles", userId);
  const existing = await getDoc(ref);
  const payload: any = {
    ...data,
    updatedAt: serverTimestamp(),
  };
  if (!existing.exists()) payload.createdAt = serverTimestamp();
  await setDoc(ref, payload, { merge: true });
}
