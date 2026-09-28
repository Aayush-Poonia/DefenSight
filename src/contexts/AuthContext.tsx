import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  confirmPasswordReset,
  verifyPasswordResetCode,
  updateProfile,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  type User,
} from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, googleProvider, db } from "@/lib/firebase";
import { upsertUserProfile, type UserProfile } from "@/lib/firestore";

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, profile?: { fullName?: string; username?: string }) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  verifyResetCode: (oobCode: string) => Promise<string>;
  confirmReset: (oobCode: string, newPassword: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user?.uid) {
      setProfile(null);
      return;
    }
    const unsubProfile = onSnapshot(
      doc(db, "profiles", user.uid),
      (snap) => {
        if (snap.exists()) {
          setProfile(snap.data() as UserProfile);
        } else {
          setProfile(null);
        }
      },
      () => {
        setProfile(null);
      }
    );
    return unsubProfile;
  }, [user?.uid]);

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signUp = async (email: string, password: string, profile?: { fullName?: string; username?: string }) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (profile?.fullName) {
      try { await updateProfile(cred.user, { displayName: profile.fullName }); } catch { /* ignore */ }
    }
    try {
      await upsertUserProfile(cred.user.uid, {
        email,
        fullName: profile?.fullName || "",
        username: profile?.username || "",
      });
    } catch { /* non-fatal */ }
  };

  const signInWithGoogle = async () => {
    const cred = await signInWithPopup(auth, googleProvider);
    try {
      await upsertUserProfile(cred.user.uid, {
        email: cred.user.email || "",
        fullName: cred.user.displayName || "",
      });
    } catch { /* non-fatal */ }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  const resetPassword = async (email: string) => {
    const continueUrl = `${window.location.origin}/reset-password`;
    await sendPasswordResetEmail(auth, email, {
      url: continueUrl,
      handleCodeInApp: false,
    });
  };

  const verifyResetCode = async (oobCode: string) => {
    return verifyPasswordResetCode(auth, oobCode);
  };

  const confirmReset = async (oobCode: string, newPassword: string) => {
    await confirmPasswordReset(auth, oobCode, newPassword);
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    const u = auth.currentUser;
    if (!u || !u.email) {
      throw new Error("No authenticated user found.");
    }
    const credential = EmailAuthProvider.credential(u.email, currentPassword);
    await reauthenticateWithCredential(u, credential);
    await updatePassword(u, newPassword);
  };

  const refreshUser = async () => {
    if (auth.currentUser) {
      try {
        await auth.currentUser.reload();
      } catch { /* ignore */ }
      setUser({ ...auth.currentUser } as User);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signIn,
        signUp,
        signInWithGoogle,
        signOut,
        resetPassword,
        verifyResetCode,
        confirmReset,
        changePassword,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
