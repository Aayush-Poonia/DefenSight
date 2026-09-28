import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { mapFirebaseError } from "@/lib/firebase-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { ShieldCheck, Mail, Lock, Loader2, AlertCircle, Eye, EyeOff, CheckCircle2 } from "lucide-react";

export default function ResetPassword() {
  const { resetPassword, verifyResetCode, confirmReset } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const oobCode = searchParams.get("oobCode");

  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(Boolean(oobCode));
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!oobCode) {
      setVerifying(false);
      return;
    }
    let cancelled = false;
    setVerifying(true);
    verifyResetCode(oobCode)
      .then((addr) => {
        if (!cancelled) setAccountEmail(addr);
      })
      .catch((err) => {
        if (!cancelled) {
          const msg = mapFirebaseError(err);
          setError(msg);
          toast.error(msg);
        }
      })
      .finally(() => {
        if (!cancelled) setVerifying(false);
      });
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when the email link code changes
  }, [oobCode]);

  const handleSendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      const msg = "Please enter your email.";
      setError(msg);
      toast.error(msg);
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      const msg = "Please enter a valid email address.";
      setError(msg);
      toast.error(msg);
      return;
    }
    setLoading(true);
    try {
      await resetPassword(email.trim());
      setSent(true);
      toast.success("Reset link sent — check your inbox.");
    } catch (err) {
      const msg = mapFirebaseError(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!oobCode) return;
    if (password.length < 6) {
      const msg = "Password must be at least 6 characters.";
      setError(msg);
      toast.error(msg);
      return;
    }
    if (password !== confirm) {
      const msg = "Passwords do not match.";
      setError(msg);
      toast.error(msg);
      return;
    }
    setLoading(true);
    try {
      await confirmReset(oobCode, password);
      setDone(true);
      toast.success("Password updated. You can sign in now.");
    } catch (err) {
      const msg = mapFirebaseError(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5 flex items-center justify-center p-4 relative overflow-hidden">
      <Toaster richColors position="top-center" />
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, currentColor 0 1px, transparent 1px 32px), repeating-linear-gradient(90deg, currentColor 0 1px, transparent 1px 32px)",
        }}
      />
      <Card className="w-full max-w-md p-6 sm:p-8 space-y-6 relative z-10 shadow-[var(--shadow-elegant)] border-border/60 backdrop-blur-sm">
        <div className="text-center space-y-3">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-accent to-accent/70 text-accent-foreground grid place-items-center shadow-lg">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ fontFamily: "Georgia, serif" }}>
              {oobCode ? "Set a new password" : "Reset your password"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {oobCode
                ? accountEmail
                  ? `Choose a new password for ${accountEmail}`
                  : "Enter a new password for your account"
                : "We’ll email you a link to choose a new password"}
            </p>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-sm">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {verifying ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : done ? (
          <div className="space-y-4 text-center">
            <div className="mx-auto h-10 w-10 rounded-full bg-accent/15 text-accent grid place-items-center">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <p className="text-sm text-muted-foreground">Your password has been reset. Sign in with your new password.</p>
            <Button className="w-full h-11" onClick={() => navigate("/login")}>
              Back to sign in
            </Button>
          </div>
        ) : sent ? (
          <div className="space-y-4 text-center">
            <div className="mx-auto h-10 w-10 rounded-full bg-accent/15 text-accent grid place-items-center">
              <Mail className="h-5 w-5" />
            </div>
            <p className="text-sm text-muted-foreground">
              If an account exists for <span className="font-medium text-foreground">{email.trim()}</span>, a reset link is on its way. Check your inbox and spam folder.
            </p>
            <div className="space-y-2">
              <Button variant="outline" className="w-full h-11" onClick={() => navigate("/login")}>
                Back to sign in
              </Button>
              <button
                type="button"
                onClick={() => { setSent(false); setError(null); }}
                className="text-xs text-accent underline-offset-4 hover:underline font-medium block mx-auto"
              >
                Didn't receive the email? Try again
              </button>
            </div>
          </div>
        ) : oobCode && !error ? (
          <form onSubmit={handleConfirm} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="new-password" className="text-xs">
                New password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="new-password"
                  type={showPw ? "text" : "password"}
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-11 h-11"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 grid place-items-center rounded-md hover:bg-muted text-muted-foreground"
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password" className="text-xs">
                Confirm password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirm-password"
                  type={showPw ? "text" : "password"}
                  placeholder="Re-enter new password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="pl-10 h-11"
                  autoComplete="new-password"
                />
              </div>
            </div>
            <Button type="submit" className="w-full h-11 mt-2" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Update password
            </Button>
          </form>
        ) : !oobCode ? (
          <form onSubmit={handleSendLink} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-11"
                  autoComplete="email"
                />
              </div>
            </div>
            <Button type="submit" className="w-full h-11 mt-2" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Send reset link
            </Button>
          </form>
        ) : null}

        <p className="text-center text-sm text-muted-foreground">
          Remembered your password?{" "}
          <Link to="/login" className="text-accent underline-offset-4 hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </Card>
    </div>
  );
}
