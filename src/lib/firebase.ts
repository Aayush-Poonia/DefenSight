import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDhMsRMKgJJAFZ4p-EARBsKVhDzWr_AN_U",
  authDomain: "cybersecurity-saas.firebaseapp.com",
  projectId: "cybersecurity-saas",
  storageBucket: "cybersecurity-saas.firebasestorage.app",
  messagingSenderId: "996413119500",
  appId: "1:996413119500:web:c7bcbb24936b6c0632a229",
  measurementId: "G-TJ31KED2K9",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
