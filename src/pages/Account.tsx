import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { getUserProfile, upsertUserProfile, type UserProfile } from "@/lib/firestore";
import { updateProfile } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Loader2, Save, User as UserIcon, AtSign, Mail, FileText } from "lucide-react";

export default function Account() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    getUserProfile(user.uid)
      .then((p: UserProfile | null) => {
        setFullName(p?.fullName || user.displayName || "");
        setUsername(p?.username || "");
        setBio(p?.bio || "");
      })
      .catch(() => toast.error("Could not load profile"))
      .finally(() => setLoading(false));
  }, [user]);

  const initials = (fullName || user?.email || "?").slice(0, 2).toUpperCase();

  const save = async () => {
    if (!user) return;
    if (!fullName.trim()) { toast.error("Please enter your name"); return; }
    if (username && !/^[a-zA-Z0-9_.]{3,24}$/.test(username.trim())) {
      toast.error("Username must be 3–24 chars (letters, numbers, _ or .)");
      return;
    }
    setSaving(true);
    try {
      await upsertUserProfile(user.uid, {
        email: user.email || "",
        fullName: fullName.trim(),
        username: username.trim(),
        bio: bio.trim(),
      });
      if (auth.currentUser) {
        try { await updateProfile(auth.currentUser, { displayName: fullName.trim() }); } catch {}
      }
      toast.success("Profile updated");
    } catch (e: any) {
      toast.error(e?.message || "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your personal identity and profile</p>
      </div>

      <Card className="p-5 sm:p-6">
        <div className="flex items-center gap-4 mb-6">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="text-lg bg-accent text-accent-foreground">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="font-semibold truncate">{fullName || "Unnamed user"}</div>
            <div className="text-sm text-muted-foreground truncate">{user?.email}</div>
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
                <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" className="pl-10 h-11" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <div className="relative">
                <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="janedoe" className="pl-10 h-11" />
              </div>
              <p className="text-xs text-muted-foreground">3–24 chars. Letters, numbers, underscore, period.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bio">Personal identity / bio</Label>
              <div className="relative">
                <FileText className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell us about yourself (role, interests, location)…" className="pl-10 min-h-[120px]" maxLength={500} />
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
    </div>
  );
}