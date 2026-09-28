export function mapFirebaseError(err: unknown): string {
  const code = (err as { code?: string })?.code || "";
  const message = (err as { message?: string })?.message;
  const map: Record<string, string> = {
    "auth/invalid-email": "That email address looks invalid.",
    "auth/user-disabled": "This account has been disabled.",
    "auth/user-not-found": "No account found with that email.",
    "auth/wrong-password": "Wrong password. Please try again.",
    "auth/invalid-credential": "Wrong email or password. Please try again.",
    "auth/invalid-login-credentials": "Wrong email or password. Please try again.",
    "auth/email-already-in-use": "An account with this email already exists. Try signing in.",
    "auth/weak-password": "Password is too weak. Use at least 6 characters.",
    "auth/popup-closed-by-user": "Google sign-in was cancelled.",
    "auth/popup-blocked": "Your browser blocked the Google popup. Allow popups and try again.",
    "auth/network-request-failed": "Network error. Check your internet connection.",
    "auth/too-many-requests": "Too many attempts. Please wait a minute and try again.",
    "auth/missing-email": "Please enter your email.",
    "auth/expired-action-code": "This reset link has expired. Request a new one.",
    "auth/invalid-action-code": "This reset link is invalid or has already been used.",
    "auth/missing-continue-uri": "Password reset could not be completed. Try again.",
    "auth/unauthorized-continue-uri": "This app domain is not authorized for password reset.",
    "auth/requires-recent-login": "For security reasons, please sign out and sign in again before changing your password.",
  };
  return map[code] || message || "Something went wrong. Please try again.";
}
