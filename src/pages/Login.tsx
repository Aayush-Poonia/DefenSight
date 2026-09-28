import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { mapFirebaseError } from "@/lib/firebase-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { ShieldCheck, Mail, Lock, Loader2, User as UserIcon, AtSign, Eye, EyeOff, AlertCircle } from "lucide-react";

export default function Login() {
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = (): string | null => {
    if (!email.trim()) return "Please enter your email.";
    if (!/^\S+@\S+\.\S+$/.test(email)) return "Please enter a valid email address.";
    if (!password) return "Please enter a password.";
    if (password.length < 6) return "Password must be at least 6 characters.";
    if (isSignUp) {
      if (!fullName.trim()) return "Please enter your full name.";
      if (!username.trim()) return "Please choose a username.";
      if (!/^[a-zA-Z0-9_.]{3,24}$/.test(username.trim())) return "Username must be 3–24 chars (letters, numbers, _ or .).";
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const v = validate();
    if (v) { setError(v); toast.error(v); return; }
    setLoading(true);
    try {
      if (isSignUp) {
        await signUp(email.trim(), password, { fullName: fullName.trim(), username: username.trim() });
        toast.success("Account created — welcome!");
      } else {
        await signIn(email.trim(), password);
        toast.success("Welcome back!");
      }
    } catch (err: any) {
      const msg = mapFirebaseError(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true); setError(null);
    try {
      await signInWithGoogle();
      toast.success("Signed in with Google!");
    } catch (err: any) {
      const msg = mapFirebaseError(err);
      setError(msg);
      toast.error(msg);
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5 flex items-center justify-center p-4 relative overflow-hidden">
      <Toaster richColors position="top-center" />
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "repeating-linear-gradient(0deg, currentColor 0 1px, transparent 1px 32px), repeating-linear-gradient(90deg, currentColor 0 1px, transparent 1px 32px)" }} />
      <Card className="w-full max-w-md p-6 sm:p-8 space-y-6 relative z-10 shadow-[var(--shadow-elegant)] border-border/60 backdrop-blur-sm transition-all duration-300">
        <div className="text-center space-y-3">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-accent to-accent/70 text-accent-foreground grid place-items-center shadow-lg animate-glow-pulse">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ fontFamily: "Georgia, serif" }}>
              {isSignUp ? "Create your account" : "Welcome back"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isSignUp ? "Join DefenSight — AI Cybersecurity Suite" : "Sign in to continue to DefenSight"}
            </p>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-sm">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {isSignUp && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="fullName" className="text-xs">Full name</Label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="fullName" placeholder="Jane Doe" value={fullName} onChange={(e) => setFullName(e.target.value)} className="pl-10 h-11" autoComplete="name" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="username" className="text-xs">Username</Label>
                <div className="relative">
                  <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="username" placeholder="janedoe" value={username} onChange={(e) => setUsername(e.target.value)} className="pl-10 h-11" autoComplete="username" />
                </div>
              </div>
            </>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 h-11" autoComplete="email" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="password" type={showPw ? "text" : "password"} placeholder="At least 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 pr-11 h-11" autoComplete={isSignUp ? "new-password" : "current-password"} />
              <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 grid place-items-center rounded-md hover:bg-muted text-muted-foreground" aria-label={showPw ? "Hide password" : "Show password"}>
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {!isSignUp && (
              <div className="flex justify-end">
                <Link
                  to={email.trim() ? `/reset-password?email=${encodeURIComponent(email.trim())}` : "/reset-password"}
                  className="text-xs text-accent underline-offset-4 hover:underline font-medium"
                >
                  Forgot password?
                </Link>
              </div>
            )}
          </div>

          <Button type="submit" className="w-full h-11 mt-2" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {isSignUp ? "Create account" : "Sign in"}
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
          <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">or</span></div>
        </div>

        <Button variant="outline" className="w-full h-11 gap-2" onClick={handleGoogle} disabled={loading}>
          <svg className="h-4 w-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          Continue with Google
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
          <button type="button" onClick={() => { setIsSignUp(!isSignUp); setError(null); }} className="text-accent underline-offset-4 hover:underline font-medium">
            {isSignUp ? "Sign in" : "Sign up"}
          </button>
        </p>
      </Card>
    </div>
  );
}