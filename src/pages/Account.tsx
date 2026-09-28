import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { getUserProfile, upsertUserProfile, type UserProfile } from "@/lib/firestore";
import { updateProfile } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { mapFirebaseError } from "@/lib/firebase-errors";
import {
  Loader2,
  Save,
  User as UserIcon,
  AtSign,
  Mail,
  FileText,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Camera,
  Upload,
  Trash2,
} from "lucide-react";

export default function Account() {
  const { user, changePassword, resetPassword, refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [changingPw, setChangingPw] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [resetSentEmail, setResetSentEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    getUserProfile(user.uid)
      .then((p: UserProfile | null) => {
        setFullName(p?.fullName || user.displayName || "");
        setUsername(p?.username || "");
        setBio(p?.bio || "");
        setPhotoURL(p?.photoURL || user.photoURL || "");
      })
      .catch(() => toast.error("Could not load profile"))
      .finally(() => setLoading(false));
  }, [user]);

  const initials = (fullName || user?.email || "?").slice(0, 2).toUpperCase();

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image file size must be less than 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_SIZE = 128;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const resizedDataUrl = canvas.toDataURL("image/jpeg", 0.8);
          setPhotoURL(resizedDataUrl);
          setProfileSuccess(false);
          toast.info("Photo updated in preview. Click 'Save changes' to save.");
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setPhotoURL("");
    setProfileSuccess(false);
    toast.info("Photo removed from preview. Click 'Save changes' to save.");
  };

  const save = async () => {
    if (!user) return;
    if (!fullName.trim()) { toast.error("Please enter your name"); return; }
    if (username && !/^[a-zA-Z0-9_.]{3,24}$/.test(username.trim())) {
      toast.error("Username must be 3–24 chars (letters, numbers, _ or .)");
      return;
    }
    setSaving(true);
    setProfileSuccess(false);
    try {
      await upsertUserProfile(user.uid, {
        email: user.email || "",
        fullName: fullName.trim(),
        username: username.trim(),
        bio: bio.trim(),
        photoURL: photoURL || "",
      });
      if (auth.currentUser) {
        try {
          await updateProfile(auth.currentUser, {
            displayName: fullName.trim(),
            photoURL: photoURL || "",
          });
        } catch { /* ignore */ }
      }
      await refreshUser();
      setProfileSuccess(true);
      toast.success("Profile saved successfully!");
    } catch (e: any) {
      toast.error(e?.message || "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(false);
    setResetSentEmail(null);

    if (!currentPassword) {
      const msg = "Please enter your current password.";
      setPwError(msg);
      toast.error(msg);
      return;
    }
    if (!newPassword) {
      const msg = "Please enter a new password.";
      setPwError(msg);
      toast.error(msg);
      return;
    }
    if (newPassword.length < 6) {
      const msg = "New password must be at least 6 characters.";
      setPwError(msg);
      toast.error(msg);
      return;
    }
    if (newPassword !== confirmPassword) {
      const msg = "New passwords do not match.";
      setPwError(msg);
      toast.error(msg);
      return;
    }
    if (currentPassword === newPassword) {
      const msg = "New password must be different from current password.";
      setPwError(msg);
      toast.error(msg);
      return;
    }

    setChangingPw(true);
    try {
      await changePassword(currentPassword, newPassword);
      setPwSuccess(true);
      toast.success("Password changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      const msg = mapFirebaseError(err);
      setPwError(msg);
      toast.error(msg);
    } finally {
      setChangingPw(false);
    }
  };

  const handleSendForgotEmail = async () => {
    if (!user?.email) {
      toast.error("No email associated with this account.");
      return;
    }
    setPwError(null);
    setPwSuccess(false);
    setSendingReset(true);
    try {
      await resetPassword(user.email);
      setResetSentEmail(user.email);
      toast.success(`Password reset link sent to ${user.email}. Check your inbox!`);
    } catch (err: any) {
      toast.error(mapFirebaseError(err));
    } finally {
      setSendingReset(false);
    }
  };

  const isGoogleOnly = user?.providerData?.length
    ? user.providerData.every((p) => p.providerId === "google.com")
    : false;

  const passwordsMatch = confirmPassword.length > 0 && newPassword === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const isLengthValid = newPassword.length >= 6;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your personal identity, avatar, and profile</p>
      </div>

      <Card className="p-5 sm:p-6">
        {/* Profile Save Success Acknowledgement Banner */}
        {profileSuccess && (
          <div className="flex items-start gap-2.5 p-3.5 mb-6 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-sm animate-in fade-in duration-200">
            <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-emerald-500" />
            <div className="flex-1">
              <p className="font-semibold">Profile Saved Successfully!</p>
              <p className="text-xs opacity-90 mt-0.5">
                Your profile information and updated picture have been saved.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setProfileSuccess(false)}
              className="text-xs font-semibold opacity-70 hover:opacity-100 p-0.5"
              aria-label="Close message"
            >
              ✕
            </button>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 mb-6 pb-6 border-b border-border/60">
          <div className="relative group shrink-0">
            <Avatar className="h-20 w-20 border-2 border-border shadow-md">
              {photoURL && <AvatarImage src={photoURL} alt={fullName || "User Avatar"} className="object-cover" />}
              <AvatarFallback className="text-xl bg-accent text-accent-foreground font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <button
              type="button"
              onClick={() => document.getElementById("photo-upload")?.click()}
              className="absolute inset-0 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-[10px] font-semibold gap-0.5 cursor-pointer"
              title="Change profile photo"
            >
              <Camera className="h-4 w-4" />
              <span>Change</span>
            </button>
            <input
              id="photo-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoSelect}
            />
          </div>

          <div className="space-y-1 flex-1 min-w-0">
            <div className="font-bold text-lg truncate">{fullName || "Unnamed user"}</div>
            <div className="text-sm text-muted-foreground truncate">{user?.email}</div>
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs font-medium cursor-pointer"
                type="button"
                onClick={() => document.getElementById("photo-upload")?.click()}
              >
                <Upload className="h-3.5 w-3.5" /> Upload photo
              </Button>
              {photoURL && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                  type="button"
                  onClick={handleRemovePhoto}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Remove photo
                </Button>
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="email" value={user?.email || ""} disabled className="pl-10 h-11" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fullName">Full name</Label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="fullName" value={fullName} onChange={(e) => { setFullName(e.target.value); setProfileSuccess(false); }} placeholder="Your name" className="pl-10 h-11" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <div className="relative">
                <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="username" value={username} onChange={(e) => { setUsername(e.target.value); setProfileSuccess(false); }} placeholder="janedoe" className="pl-10 h-11" />
              </div>
              <p className="text-xs text-muted-foreground">3–24 chars. Letters, numbers, underscore, period.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bio">Personal identity / bio</Label>
              <div className="relative">
                <FileText className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Textarea id="bio" value={bio} onChange={(e) => { setBio(e.target.value); setProfileSuccess(false); }} placeholder="Tell us about yourself (role, interests, location)…" className="pl-10 min-h-[120px]" maxLength={500} />
              </div>
              <p className="text-xs text-muted-foreground text-right">{bio.length}/500</p>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={save} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save changes
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Card className="p-5 sm:p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Change Password</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {isGoogleOnly
              ? "Your account is signed in using Google. Password changes should be managed through your Google account."
              : "Update your account password directly below."}
          </p>
        </div>

        {!isGoogleOnly && (
          <>
            {/* Password Reset Email Sent Acknowledgement */}
            {resetSentEmail && (
              <div className="flex items-start gap-2.5 p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-sm">
                <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-emerald-500" />
                <div className="flex-1">
                  <p className="font-semibold">Reset Link Sent Successfully!</p>
                  <p className="text-xs opacity-90 mt-0.5">
                    A password reset email has been sent to <span className="font-medium underline">{resetSentEmail}</span>. Please check your inbox and spam folder to complete the reset.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setResetSentEmail(null)}
                  className="text-xs font-semibold opacity-70 hover:opacity-100 p-0.5"
                  aria-label="Close message"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Password Changed Acknowledgement */}
            {pwSuccess && (
              <div className="flex items-start gap-2.5 p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-sm">
                <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-emerald-500" />
                <div className="flex-1">
                  <p className="font-semibold">Password Updated Successfully!</p>
                  <p className="text-xs opacity-90 mt-0.5">
                    Your password has been changed in real time. Use your new password the next time you sign in.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPwSuccess(false)}
                  className="text-xs font-semibold opacity-70 hover:opacity-100 p-0.5"
                  aria-label="Close message"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Error Message */}
            {pwError && (
              <div className="flex items-start gap-2.5 p-3 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-sm">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{pwError}</span>
              </div>
            )}

            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <button
                    type="button"
                    onClick={handleSendForgotEmail}
                    disabled={sendingReset}
                    className="text-xs text-accent hover:underline font-medium focus:outline-none flex items-center gap-1 disabled:opacity-50"
                  >
                    {sendingReset && <Loader2 className="h-3 w-3 animate-spin" />}
                    Forgot current password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="currentPassword"
                    type={showCurrentPw ? "text" : "password"}
                    placeholder="Enter current password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="pl-10 pr-11 h-11"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPw((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 grid place-items-center rounded-md hover:bg-muted text-muted-foreground"
                    aria-label={showCurrentPw ? "Hide password" : "Show password"}
                  >
                    {showCurrentPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="newPassword">New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="newPassword"
                      type={showNewPw ? "text" : "password"}
                      placeholder="At least 6 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="pl-10 pr-11 h-11"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPw((s) => !s)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 grid place-items-center rounded-md hover:bg-muted text-muted-foreground"
                      aria-label={showNewPw ? "Hide password" : "Show password"}
                    >
                      {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {newPassword.length > 0 && (
                    <div className="flex items-center gap-1.5 text-xs mt-1">
                      {isLengthValid ? (
                        <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                          <CheckCircle2 className="h-3 w-3" /> Minimum 6 characters met
                        </span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1 font-medium">
                          <XCircle className="h-3 w-3" /> Need at least 6 characters ({newPassword.length}/6)
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type={showNewPw ? "text" : "password"}
                      placeholder="Re-enter new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-10 h-11"
                      autoComplete="new-password"
                    />
                  </div>
                  {confirmPassword.length > 0 && (
                    <div className="flex items-center gap-1.5 text-xs mt-1">
                      {passwordsMatch && (
                        <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold animate-in fade-in duration-150">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Passwords match
                        </span>
                      )}
                      {passwordsMismatch && (
                        <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1 font-semibold animate-in fade-in duration-150">
                          <XCircle className="h-3.5 w-3.5 text-amber-500" /> Passwords do not match
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-border/50">
                <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-accent shrink-0" />
                  <span>Don't remember your current password?</span>
                  <button
                    type="button"
                    onClick={handleSendForgotEmail}
                    disabled={sendingReset}
                    className="text-accent underline underline-offset-2 hover:opacity-80 font-medium disabled:opacity-50"
                  >
                    Send reset email
                  </button>
                </div>

                <Button
                  type="submit"
                  disabled={changingPw || (confirmPassword.length > 0 && passwordsMismatch)}
                  className="gap-2 h-11 shrink-0 self-start sm:self-auto"
                >
                  {changingPw ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                  Update password
                </Button>
              </div>
            </form>
          </>
        )}
      </Card>
    </div>
  );
}