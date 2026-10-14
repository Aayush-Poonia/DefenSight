import { useAuth } from "@/contexts/AuthContext";
import { Link, useLocation } from "react-router-dom";
import { useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ChevronDown,
  FileSearch,
  FileText,
  Globe,
  History,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  MessageSquare,
  Network,
  Phone,
  Radar,
  ScanSearch,
  Settings,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

type NavLeaf = { to: string; label: string; icon: typeof LayoutDashboard };
type NavGroup = {
  label: string;
  icon: typeof LayoutDashboard;
  children: NavLeaf[];
};
type NavItem = NavLeaf | NavGroup;

function isGroup(item: NavItem): item is NavGroup {
  return "children" in item;
}

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  {
    label: "Intel Hub",
    icon: Radar,
    children: [
      { to: "/intel/ip", label: "IP Intelligence", icon: Network },
      { to: "/intel/phone", label: "Phone Intelligence", icon: Phone },
      { to: "/intel/file", label: "File Scanner", icon: FileSearch },
      { to: "/intel/email", label: "Email Lookup", icon: Mail },
    ],
  },
  { to: "/phishing", label: "PhishGuard", icon: Globe },
  { to: "/email", label: "Email Analyzer", icon: Mail },
  { to: "/password", label: "Password Lab", icon: KeyRound },
  { to: "/news", label: "News Analyzer", icon: ScanSearch },
  { to: "/chat", label: "AI Assistant", icon: MessageSquare },
  { to: "/vulnerability", label: "Vulnerability Intel", icon: ShieldAlert },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/history", label: "History", icon: History },
  { to: "/settings", label: "Settings", icon: Settings },
];

export default function AppShell({ children }: { children: ReactNode }) {
  const { user, profile, signOut } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [intelOpen, setIntelOpen] = useState(() => location.pathname.startsWith("/intel"));

  const avatarUrl = profile?.photoURL || user?.photoURL || "";
  const displayName = profile?.fullName || user?.displayName || user?.email || "";

  const initials = useMemo(() => {
    return (displayName || "?").slice(0, 2).toUpperCase();
  }, [displayName]);

  return (
    <div className="min-h-screen flex bg-background">
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border transform transition-transform lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center gap-2.5 p-5 border-b border-sidebar-border">
          <div className="h-9 w-9 rounded-lg overflow-hidden shrink-0 shadow-sm transition-transform duration-300 hover:scale-105">
            <img src="/logo.png" alt="DefenSight Logo" className="h-full w-full object-cover" />
          </div>
          <div>
            <div className="font-bold text-sm tracking-tight text-foreground flex items-center gap-1">
              DefenSight
            </div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
              AI Security Suite
            </div>
          </div>
        </div>

        <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-8rem)]">
          {NAV.map((item) => {
            if (isGroup(item)) {
              const childActive = item.children.some((c) => location.pathname === c.to);
              return (
                <div key={item.label} className="space-y-1">
                  <button
                    type="button"
                    onClick={() => setIntelOpen((o) => !o)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${
                      childActive
                        ? "bg-sidebar-accent/70 text-sidebar-accent-foreground font-medium shadow-xs"
                        : "hover:bg-sidebar-accent/50 text-sidebar-foreground/70 hover:text-sidebar-foreground"
                    }`}
                  >
                    <item.icon className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
                    <span className="flex-1 text-left">{item.label}</span>
                    <ChevronDown
                      className={`h-4 w-4 transition-transform duration-200 ${intelOpen || childActive ? "rotate-180" : ""}`}
                    />
                  </button>
                  {(intelOpen || childActive) && (
                    <div className="ml-3 pl-3 border-l border-sidebar-border space-y-0.5 animate-in fade-in duration-200">
                      {item.children.map((child) => {
                        const active = location.pathname === child.to;
                        return (
                          <Link
                            key={child.to}
                            to={child.to}
                            onClick={() => setSidebarOpen(false)}
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                              active
                                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-xs"
                                : "hover:bg-sidebar-accent/50 text-sidebar-foreground/70 hover:text-sidebar-foreground"
                            }`}
                          >
                            <child.icon className="h-3.5 w-3.5" />
                            {child.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-xs"
                    : "hover:bg-sidebar-accent/50 text-sidebar-foreground/70 hover:text-sidebar-foreground"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-sidebar-border bg-sidebar">
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8 transition-transform duration-200 hover:scale-105">
              {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} className="object-cover" />}
              <AvatarFallback className="text-xs bg-sidebar-primary text-sidebar-primary-foreground font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium truncate">
                {displayName}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
              onClick={signOut}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-30 lg:hidden transition-opacity" onClick={() => setSidebarOpen(false)} />
      )}

      <div className="flex-1 lg:ml-64 min-w-0">
        <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border/60 px-4 py-3 flex items-center gap-3 lg:hidden">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <img src="/logo.png" alt="DefenSight" className="h-7 w-7 rounded-md object-cover" />
          <span className="font-bold text-sm tracking-tight">DefenSight</span>
        </header>
        <main className="p-4 sm:p-6 lg:p-8 max-w-full overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
