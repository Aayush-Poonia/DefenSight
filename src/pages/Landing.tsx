import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { saveWaitlistEmail } from "@/lib/firestore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import {
  ShieldCheck,
  Network,
  Globe,
  Mail,
  Phone,
  FileSearch,
  ShieldAlert,
  MessageSquare,
  KeyRound,
  ScanSearch,
  BarChart3,
  ArrowRight,
  ChevronDown,
  Zap,
  Eye,
  Lock,
  Radar,
  Activity,
  CheckCircle2,
  Menu,
  X,
  Star,
  History,
  FileText,
  User,
  LayoutDashboard,
  Smartphone,
  Bell,
  Download,
  Shield,
  AlertTriangle,
  Search,
  Cpu,
  Loader2,
} from "lucide-react";

/* ─────────────────────────────────────────────
   Animated counter
───────────────────────────────────────────── */
function useCounter(target: number, duration = 2000, start = false) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime: number | null = null;
    const step = (ts: number) => {
      if (!startTime) startTime = ts;
      const p = Math.min((ts - startTime) / duration, 1);
      setValue(Math.floor((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration, start]);
  return value;
}

/* ─────────────────────────────────────────────
   Intersection observer
───────────────────────────────────────────── */
function useInView(threshold = 0.2) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setInView(true); },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

/* ─────────────────────────────────────────────
   Mouse-parallax hook
───────────────────────────────────────────── */
function useMouseParallax() {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      setPos({
        x: (e.clientX / window.innerWidth - 0.5) * 2,
        y: (e.clientY / window.innerHeight - 0.5) * 2,
      });
    };
    window.addEventListener("mousemove", handler, { passive: true });
    return () => window.removeEventListener("mousemove", handler);
  }, []);
  return pos;
}

/* ─────────────────────────────────────────────
   3-D tilt card
───────────────────────────────────────────── */
function TiltCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(900px) rotateY(${x * 14}deg) rotateX(${-y * 14}deg) translateZ(10px)`;
  };
  const onLeave = () => {
    if (ref.current) ref.current.style.transform = "perspective(900px) rotateY(0) rotateX(0) translateZ(0)";
  };
  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ transition: "transform 0.12s ease-out", transformStyle: "preserve-3d" }}
      className={className}
    >
      {children}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Animated stat counter
───────────────────────────────────────────── */
function StatCard({ value, suffix, label, inView, sublabel }: {
  value: number; suffix: string; label: string; inView: boolean; sublabel?: string;
}) {
  const count = useCounter(value, 2200, inView);
  return (
    <div className="group text-center p-8 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-sm hover:bg-white/[0.08] hover:border-orange-500/30 transition-all duration-500 cursor-default">
      <div
        className="text-5xl sm:text-6xl font-black text-white mb-3 tabular-nums"
        style={{
          fontFamily: "Georgia, serif",
          background: "linear-gradient(135deg, #fff 40%, oklch(0.75 0.20 35))",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}
      >
        {count}{suffix}
      </div>
      <div className="text-sm font-semibold text-white/80 mb-1">{label}</div>
      {sublabel && <div className="text-xs text-white/35 mt-1">{sublabel}</div>}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Scrolling marquee
───────────────────────────────────────────── */
const PROVIDERS = [
  "VirusTotal", "AbuseIPDB", "AlienVault OTX", "Google Safe Browsing",
  "Shodan · Censys", "URLhaus", "MalwareBazaar", "PhishStats",
  "urlscan.io", "ThreatFox", "MaxMind GeoIP", "IPinfo", "WhoisFreaks",
  "DNSDumpster", "HackerTarget", "Veriphone", "Numverify", "Hybrid Analysis",
  "NVD NIST", "CISA KEV", "FIRST EPSS", "NewsAPI", "Scanii",
];

function ProviderMarquee() {
  const items = [...PROVIDERS, ...PROVIDERS];
  return (
    <div className="relative overflow-hidden py-4 select-none">
      <div className="absolute inset-y-0 left-0 w-32 z-10 pointer-events-none"
        style={{ background: "linear-gradient(to right, oklch(0.08 0.02 265), transparent)" }} />
      <div className="absolute inset-y-0 right-0 w-32 z-10 pointer-events-none"
        style={{ background: "linear-gradient(to left, oklch(0.08 0.02 265), transparent)" }} />
      <div
        className="flex gap-4 w-max"
        style={{ animation: "marquee 36s linear infinite" }}
      >
        {items.map((p, i) => (
          <div
            key={i}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white/50 text-xs font-medium whitespace-nowrap hover:text-white/80 hover:border-orange-500/30 transition-colors duration-200"
          >
            <div className="h-1.5 w-1.5 rounded-full bg-orange-400/60" />
            {p}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Feature data (14 modules from README)
───────────────────────────────────────────── */
const FEATURES = [
  {
    icon: LayoutDashboard,
    title: "Threat Dashboard",
    desc: "Global search router that auto-detects IP, URL, email or phone — KPI metrics, recharts analytics, recent activity feed.",
    badge: "Overview",
    color: "from-slate-500/20 to-slate-600/5",
    border: "border-slate-500/25",
    accent: "text-slate-300",
    route: "/dashboard",
  },
  {
    icon: Network,
    title: "IP Intelligence",
    desc: "10 parallel providers: MaxMind, Censys, AbuseIPDB, VirusTotal, OTX, ThreatFox, IPinfo, IP-API, HackerTarget & Abstract.",
    badge: "10 Providers",
    color: "from-blue-500/20 to-blue-600/5",
    border: "border-blue-500/25",
    accent: "text-blue-400",
    route: "/intel/ip",
  },
  {
    icon: Phone,
    title: "Phone Intelligence",
    desc: "Veriphone, Numverify & AbstractAPI run in parallel. Carrier enrichment, VoIP detection, geographic risk scoring.",
    badge: "3 Providers",
    color: "from-green-500/20 to-green-600/5",
    border: "border-green-500/25",
    accent: "text-green-400",
    route: "/intel/phone",
  },
  {
    icon: FileSearch,
    title: "File Scanner",
    desc: "SHA256 + magic bytes client-side. Scanned by VirusTotal, Hybrid Analysis sandbox, MalwareBazaar & ThreatFox.",
    badge: "Multi-AV",
    color: "from-red-500/20 to-red-600/5",
    border: "border-red-500/25",
    accent: "text-red-400",
    route: "/intel/file",
  },
  {
    icon: Mail,
    title: "Email Lookup",
    desc: "MX validation, disposable domain detection via Disify, deliverability & DNS scoring with AbstractAPI.",
    badge: "MX + DNS",
    color: "from-purple-500/20 to-purple-600/5",
    border: "border-purple-500/25",
    accent: "text-purple-400",
    route: "/intel/email",
  },
  {
    icon: Globe,
    title: "PhishGuard",
    desc: "10+ feeds: DNSDumpster, WHOIS, VirusTotal, Safe Browsing, PhishStats, URLhaus, OTX, ThreatFox, urlscan.io & Censys.",
    badge: "10+ Feeds",
    color: "from-orange-500/20 to-orange-600/5",
    border: "border-orange-500/25",
    accent: "text-orange-400",
    route: "/phishing",
  },
  {
    icon: Mail,
    title: "Email Analyzer",
    desc: "Groq LLM audits raw email for BEC patterns, urgency tactics, spoofing, wire fraud & credential harvesting links.",
    badge: "Groq AI",
    color: "from-yellow-500/20 to-yellow-600/5",
    border: "border-yellow-500/25",
    accent: "text-yellow-400",
    route: "/email",
  },
  {
    icon: ScanSearch,
    title: "News Analyzer",
    desc: "AI fake-news detection via Groq NLP + real-time NewsAPI cross-reference. Sentiment, bias, credibility scoring.",
    badge: "Fake-news AI",
    color: "from-cyan-500/20 to-cyan-600/5",
    border: "border-cyan-500/25",
    accent: "text-cyan-400",
    route: "/news",
  },
  {
    icon: MessageSquare,
    title: "AI Assistant",
    desc: "Groq-powered chatbot with dual mode: normal Q&A and background investigation with parallel API scanning.",
    badge: "Groq LLM",
    color: "from-indigo-500/20 to-indigo-600/5",
    border: "border-indigo-500/25",
    accent: "text-indigo-400",
    route: "/chat",
  },
  {
    icon: ShieldAlert,
    title: "Vulnerability Intel",
    desc: "CVE search via NVD NIST, OSV.dev package scanner, CISA KEV catalog, FIRST EPSS risk ranking. PDF/CSV export.",
    badge: "CVE/KEV/EPSS",
    color: "from-rose-500/20 to-rose-600/5",
    border: "border-rose-500/25",
    accent: "text-rose-400",
    route: "/vulnerability",
  },
  {
    icon: KeyRound,
    title: "Password Lab",
    desc: "100% client-side entropy scoring, strength meter, crack time estimates, and a customizable password generator.",
    badge: "Client-side",
    color: "from-pink-500/20 to-pink-600/5",
    border: "border-pink-500/25",
    accent: "text-pink-400",
    route: "/password",
  },
  {
    icon: FileText,
    title: "Reports",
    desc: "Export professional PDF security investigation reports (jsPDF + autotable) or full JSON for SIEM integration.",
    badge: "PDF + JSON",
    color: "from-teal-500/20 to-teal-600/5",
    border: "border-teal-500/25",
    accent: "text-teal-400",
    route: "/reports",
  },
  {
    icon: History,
    title: "Scan History",
    desc: "Centralized audit log. Cloud-synced via Firestore. Filter by tool type, re-open any past scan in one click.",
    badge: "Cloud Sync",
    color: "from-violet-500/20 to-violet-600/5",
    border: "border-violet-500/25",
    accent: "text-violet-400",
    route: "/history",
  },
  {
    icon: User,
    title: "Account & Settings",
    desc: "Profile photo upload to Firebase Storage, password management, and full account settings panel.",
    badge: "Firebase",
    color: "from-amber-500/20 to-amber-600/5",
    border: "border-amber-500/25",
    accent: "text-amber-400",
    route: "/settings",
  },
];

const STATS = [
  { value: 23, suffix: "+", label: "Intelligence Providers", sublabel: "Across all 14 modules" },
  { value: 14, suffix: "", label: "Security Modules", sublabel: "One unified platform" },
  { value: 100, suffix: "%", label: "Uptime Resilience", sublabel: "Zero-crash architecture" },
  { value: 10, suffix: "+", label: "Feeds for PhishGuard", sublabel: "Real-time correlation" },
];

const TESTIMONIALS = [
  {
    text: "PhishGuard alone replaced three of our existing tools. The DNS recon + WHOIS + screenshot combo is insane value.",
    author: "Alex R.",
    role: "SOC Analyst · Tier 2",
    stars: 5,
  },
  {
    text: "The Groq AI chat explains attack chains in plain English. My team finally understands what CVEs actually mean.",
    author: "Maya T.",
    role: "Penetration Tester",
    stars: 5,
  },
  {
    text: "Having IP intel, file scanning, CVE lookup and email analysis under one login is a game-changer for our red team.",
    author: "Jordan S.",
    role: "CISO · Enterprise",
    stars: 5,
  },
  {
    text: "The zero-crash fallback architecture is brilliant. Even without every API key it gives useful heuristic scores.",
    author: "Priya K.",
    role: "DevSecOps Engineer",
    stars: 5,
  },
  {
    text: "Email Analyzer caught a sophisticated BEC attempt my team missed. The Groq AI explanation was incredibly detailed.",
    author: "Marcus L.",
    role: "Incident Responder",
    stars: 5,
  },
  {
    text: "Built with React 19 + Vite 7, it's blazing fast. Deployed on Vercel with one command. Absolutely love it.",
    author: "Tanvi S.",
    role: "Full-Stack Engineer",
    stars: 5,
  },
];

const GROQ_MODELS = [
  { name: "openai/gpt-oss-120b", role: "Primary", badge: "120B" },
  { name: "openai/gpt-oss-20b", role: "Fallback", badge: "20B" },
  { name: "qwen/qwen3.8-27b", role: "Final Fallback", badge: "27B" },
];

/* ─────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────── */
export default function Landing() {
  const { user } = useAuth();
  const [navOpen, setNavOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeFeature, setActiveFeature] = useState<number | null>(null);
  const [notifyEmail, setNotifyEmail] = useState("");
  const [notifyLoading, setNotifyLoading] = useState(false);
  const [notifySuccess, setNotifySuccess] = useState(false);
  const statsSection = useInView(0.2);
  const mouse = useMouseParallax();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setNavOpen(false);
  }, []);

  const handleNotifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = notifyEmail.trim();
    if (!trimmed) {
      toast.error("Please enter your email address.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(trimmed)) {
      toast.error("Please enter a valid email address.");
      return;
    }
    setNotifyLoading(true);
    try {
      const res = await saveWaitlistEmail(trimmed);
      setNotifySuccess(true);
      setNotifyEmail("");
      toast.success("Saved to Firebase Firestore! You're on the early-access waitlist.");
    } catch (err: any) {
      console.error("Firestore waitlist error:", err);
      if (err?.code === "permission-denied") {
        toast.error("Firebase Permission Denied: In Firebase Console > Firestore > Rules, add: match /waitlist/{docId} { allow create: if true; }");
      } else {
        toast.error(err?.message || "Could not save to Firestore. Please check your connection.");
      }
    } finally {
      setNotifyLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[oklch(0.08_0.02_265)] text-white overflow-x-hidden">
      <Toaster richColors position="top-center" />

      {/* ── Marquee keyframe ── */}
      <style>{`
        @keyframes marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        @keyframes gridPulse { 0%,100%{opacity:.04} 50%{opacity:.07} }
        @keyframes scanLine { 0%{top:-2px} 100%{top:100%} }
        @keyframes fadeSlideUp { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeSlideRight { from{opacity:0;transform:translateX(-30px)} to{opacity:1;transform:translateX(0)} }
        .anim-fade-up { animation: fadeSlideUp 0.8s cubic-bezier(.16,1,.3,1) both; }
        .anim-fade-right { animation: fadeSlideRight 0.8s cubic-bezier(.16,1,.3,1) both; }
        .delay-0 { animation-delay: 0ms }
        .delay-150 { animation-delay: 150ms }
        .delay-300 { animation-delay: 300ms }
        .delay-450 { animation-delay: 450ms }
        .delay-600 { animation-delay: 600ms }
        .delay-750 { animation-delay: 750ms }
      `}</style>

      {/* ── Noise overlay ── */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-[0.025]"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`, backgroundSize: "200px" }} />

      {/* ── Parallax orbs ── */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute rounded-full opacity-[0.18]"
          style={{
            width: 700, height: 700, top: -120, left: -180,
            background: "radial-gradient(circle, oklch(0.62 0.22 27) 0%, transparent 70%)",
            transform: `translate(${mouse.x * -22}px, ${mouse.y * -22}px)`,
            transition: "transform 0.5s ease-out",
          }} />
        <div className="absolute rounded-full opacity-[0.12]"
          style={{
            width: 550, height: 550, top: "45%", right: -150,
            background: "radial-gradient(circle, oklch(0.50 0.18 265) 0%, transparent 70%)",
            transform: `translate(${mouse.x * 18}px, ${mouse.y * 18}px)`,
            transition: "transform 0.5s ease-out",
          }} />
        <div className="absolute rounded-full opacity-[0.10]"
          style={{
            width: 450, height: 450, bottom: -80, left: "35%",
            background: "radial-gradient(circle, oklch(0.55 0.22 27) 0%, transparent 70%)",
            transform: `translate(${mouse.x * -12}px, ${mouse.y * 12}px)`,
            transition: "transform 0.6s ease-out",
          }} />
      </div>

      {/* ════════════════════════════════════════
          NAVBAR
      ════════════════════════════════════════ */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-400 ${
        scrolled ? "bg-[oklch(0.08_0.02_265)]/90 backdrop-blur-2xl border-b border-white/[0.08] shadow-2xl shadow-black/40" : "bg-transparent"
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3 group cursor-pointer" onClick={() => scrollTo("hero")}>
              <div className="relative h-9 w-9 rounded-xl overflow-hidden shadow-lg shadow-orange-500/20 group-hover:shadow-orange-500/40 transition-shadow duration-300">
                <img src="/logo.png" alt="DefenSight" className="h-full w-full object-cover" />
              </div>
              <div>
                <span className="font-bold text-[15px] tracking-tight text-white">DefenSight</span>
                <div className="text-[9px] uppercase tracking-[0.18em] text-white/35 leading-none mt-0.5 font-medium">
                  AI Security Suite
                </div>
              </div>
            </div>

            {/* Desktop links */}
            <div className="hidden lg:flex items-center gap-1">
              {[
                { label: "Features", id: "features" },
                { label: "Modules", id: "modules" },
                { label: "How It Works", id: "how" },
                { label: "AI Stack", id: "ai" },
                { label: "Stats", id: "stats" },
              ].map(({ label, id }) => (
                <button
                  key={id}
                  onClick={() => scrollTo(id)}
                  className="px-4 py-2 text-sm text-white/60 hover:text-white rounded-lg hover:bg-white/[0.06] transition-all duration-200"
                >
                  {label}
                </button>
              ))}
            </div>

            {/* CTAs */}
            <div className="hidden md:flex items-center gap-3">
              {user ? (
                <>
                  <Link to="/settings">
                    <Button variant="ghost" size="sm" className="text-white/70 hover:text-white hover:bg-white/[0.08] border border-white/10 hover:border-white/20 transition-all">
                      Settings
                    </Button>
                  </Link>
                  <Link to="/dashboard">
                    <Button size="sm" className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 text-white border-0 shadow-lg shadow-orange-500/25 hover:shadow-orange-500/45 hover:scale-105 transition-all duration-200">
                      Go to Dashboard
                      <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  <Link to="/login">
                    <Button variant="ghost" size="sm" className="text-white/70 hover:text-white hover:bg-white/[0.08] border border-white/10 hover:border-white/20 transition-all">
                      Sign In
                    </Button>
                  </Link>
                  <Link to="/login?mode=signup">
                    <Button size="sm" className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 text-white border-0 shadow-lg shadow-orange-500/25 hover:shadow-orange-500/45 hover:scale-105 transition-all duration-200">
                      Get Started
                      <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </Link>
                </>
              )}
            </div>

            {/* Mobile burger */}
            <button
              className="md:hidden p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/[0.08] transition-all"
              onClick={() => setNavOpen(o => !o)}
            >
              {navOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {navOpen && (
          <div className="md:hidden bg-[oklch(0.09_0.02_265)]/98 backdrop-blur-2xl border-b border-white/10 px-4 py-4 space-y-1 animate-in slide-in-from-top duration-200">
            {[
              { label: "Features", id: "features" },
              { label: "Modules", id: "modules" },
              { label: "How It Works", id: "how" },
              { label: "AI Stack", id: "ai" },
              { label: "Stats", id: "stats" },
            ].map(({ label, id }) => (
              <button key={id} onClick={() => scrollTo(id)}
                className="w-full text-left px-4 py-2.5 text-sm text-white/70 hover:text-white rounded-lg hover:bg-white/[0.06] transition-all block">
                {label}
              </button>
            ))}
            <div className="pt-3 flex flex-col gap-2">
              {user ? (
                <>
                  <Link to="/dashboard" onClick={() => setNavOpen(false)}>
                    <Button className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white border-0">
                      Go to Dashboard <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </Link>
                  <Link to="/settings" onClick={() => setNavOpen(false)}>
                    <Button variant="outline" className="w-full border-white/15 text-white/80 hover:bg-white/[0.08]">
                      Account Settings
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  <Link to="/login" onClick={() => setNavOpen(false)}>
                    <Button variant="outline" className="w-full border-white/15 text-white/80 hover:bg-white/[0.08]">
                      Sign In
                    </Button>
                  </Link>
                  <Link to="/login?mode=signup" onClick={() => setNavOpen(false)}>
                    <Button className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white border-0">
                      Get Started Free <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </Link>
                  <Link to="/reset-password" onClick={() => setNavOpen(false)} className="text-center text-xs text-white/50 hover:text-white py-1 transition-colors">
                    Reset Password
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* ════════════════════════════════════════
          HERO
      ════════════════════════════════════════ */}
      <section id="hero" className="relative min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 pt-20 pb-20 overflow-hidden">
        {/* Animated grid */}
        <div className="absolute inset-0 opacity-[0.05]"
          style={{ backgroundImage: "repeating-linear-gradient(0deg,rgba(255,255,255,.6) 0 1px,transparent 1px 64px),repeating-linear-gradient(90deg,rgba(255,255,255,.6) 0 1px,transparent 1px 64px)", animation: "gridPulse 5s ease-in-out infinite" }} />

        {/* Scan line */}
        <div className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-orange-500/30 to-transparent pointer-events-none"
          style={{ animation: "scanLine 8s linear infinite" }} />

        <div className="relative z-10 max-w-5xl mx-auto text-center">
          {/* Eyebrow badge */}
          <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-orange-500/[0.12] border border-orange-500/30 text-orange-400 text-xs font-semibold uppercase tracking-widest mb-8 anim-fade-up delay-0">
            <div className="h-1.5 w-1.5 rounded-full bg-orange-400 animate-pulse" />
            Powered by Groq AI · 23+ Intelligence Providers
          </div>

          {/* Headline */}
          <h1 className="text-[clamp(2.6rem,8vw,6rem)] font-black tracking-tight leading-[1.03] mb-7 anim-fade-up delay-150"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
            The{" "}
            <span className="relative" style={{
              background: "linear-gradient(135deg, oklch(0.90 0.16 40) 0%, oklch(0.62 0.22 27) 50%, oklch(0.78 0.20 15) 100%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
            }}>
              AI Security Suite
              <svg className="absolute -bottom-1 left-0 w-full" viewBox="0 0 400 8" preserveAspectRatio="none" style={{ height: 6 }}>
                <path d="M0 6 Q200 0 400 6" stroke="oklch(0.62 0.22 27)" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.6" />
              </svg>
            </span>
            <br />for Modern Threats.
          </h1>

          <p className="text-lg sm:text-xl text-white/55 max-w-2xl mx-auto leading-relaxed mb-10 anim-fade-up delay-300">
            DefenSight is an enterprise-grade cybersecurity platform that aggregates <strong className="text-white/80">23+ threat intelligence feeds</strong> into one unified interface — with Groq-powered AI analysis, real-time scanning across <strong className="text-white/80">14 specialized modules</strong>, and actionable insights for security professionals.
          </p>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6 anim-fade-up delay-450">
            <Link to={user ? "/dashboard" : "/login"}>
              <Button size="lg" className="h-14 px-9 text-base font-semibold bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 text-white border-0 shadow-2xl shadow-orange-500/35 hover:shadow-orange-500/55 transition-all duration-300 hover:scale-[1.04] rounded-xl group">
                <ShieldCheck className="h-5 w-5 mr-2 group-hover:rotate-12 transition-transform duration-200" />
                {user ? "Go to Dashboard" : "Start Investigating Free"}
                <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform duration-200" />
              </Button>
            </Link>
            <button onClick={() => scrollTo("features")}>
              <Button size="lg" variant="outline" className="h-14 px-9 text-base border-white/15 text-white hover:bg-white/[0.06] hover:border-white/30 rounded-xl transition-all duration-200 hover:scale-[1.02] group">
                <Eye className="h-5 w-5 mr-2 group-hover:scale-110 transition-transform duration-200" />
                Explore All 14 Modules
              </Button>
            </button>
          </div>

          {!user && (
            <div className="flex items-center justify-center gap-3 text-xs text-white/40 mb-10 anim-fade-up delay-450">
              <Link to="/login" className="hover:text-white transition-colors underline-offset-4 hover:underline">
                Sign In
              </Link>
              <span>•</span>
              <Link to="/login?mode=signup" className="hover:text-white transition-colors underline-offset-4 hover:underline">
                Create Account
              </Link>
              <span>•</span>
              <Link to="/reset-password" className="hover:text-white transition-colors underline-offset-4 hover:underline">
                Reset Password
              </Link>
            </div>
          )}

          {/* Trust badges */}
          <div className="flex flex-wrap items-center justify-center gap-5 text-white/35 text-xs anim-fade-up delay-600">
            {[
              { icon: Lock, text: "Zero-crash architecture" },
              { icon: Zap, text: "23+ real-time APIs" },
              { icon: ShieldCheck, text: "Enterprise-grade" },
              { icon: CheckCircle2, text: "Free to use" },
              { icon: Shield, text: "MIT Licensed" },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-1.5 hover:text-white/70 transition-colors duration-200 cursor-default">
                <Icon className="h-3.5 w-3.5 text-orange-400/50" />
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Scroll indicator */}
        <button onClick={() => scrollTo("providers")}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 text-white/25 hover:text-white/60 transition-colors duration-200 group">
          <span className="text-[10px] uppercase tracking-widest font-medium">Scroll to explore</span>
          <ChevronDown className="h-4 w-4 animate-bounce group-hover:text-orange-400 transition-colors" />
        </button>
      </section>

      {/* ════════════════════════════════════════
          PROVIDER MARQUEE
      ════════════════════════════════════════ */}
      <section id="providers" className="py-12 border-y border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 mb-5">
          <p className="text-center text-xs uppercase tracking-widest text-white/25 font-medium">
            Integrated with 23+ industry-leading intelligence providers
          </p>
        </div>
        <ProviderMarquee />
      </section>

      {/* ════════════════════════════════════════
          3 HERO HIGHLIGHT CARDS
      ════════════════════════════════════════ */}
      <section className="py-16 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto grid sm:grid-cols-3 gap-5">
          {[
            { icon: Activity, title: "Live Threat Scoring", desc: "Every indicator gets a 0–100 AI threat score computed from multiple intelligence feeds simultaneously.", color: "from-orange-500/25 to-orange-600/5", border: "border-orange-500/30" },
            { icon: Radar, title: "Multi-Source Correlation", desc: "VirusTotal, AbuseIPDB, OTX, Censys and 19 more — queried in parallel, results merged intelligently.", color: "from-blue-500/25 to-blue-600/5", border: "border-blue-500/30" },
            { icon: Cpu, title: "Groq AI Explanations", desc: "Plain-language AI narratives of every threat finding — powered by Groq's ultra-low latency LLMs.", color: "from-purple-500/25 to-purple-600/5", border: "border-purple-500/30" },
          ].map((card) => (
            <TiltCard key={card.title}>
              <div className={`relative p-7 rounded-2xl bg-gradient-to-br ${card.color} border ${card.border} group cursor-default h-full`}>
                <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                  style={{ boxShadow: "inset 0 0 60px rgba(255,255,255,0.03)" }} />
                <div className="h-12 w-12 rounded-xl bg-white/[0.08] flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                  <card.icon className="h-6 w-6 text-white/80" />
                </div>
                <h3 className="font-bold text-white text-lg mb-2.5" style={{ fontFamily: "Georgia, serif" }}>{card.title}</h3>
                <p className="text-sm text-white/55 leading-relaxed">{card.desc}</p>
              </div>
            </TiltCard>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════
          FEATURES — ALL 14 MODULES
      ════════════════════════════════════════ */}
      <section id="features" className="py-24 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-orange-500/10 text-orange-400 border-orange-500/25 uppercase tracking-widest text-[10px]">
              14 Security Modules
            </Badge>
            <h2 className="text-4xl sm:text-5xl font-black text-white mb-5" style={{ fontFamily: "Georgia, serif" }}>
              Everything Security Teams Need —{" "}
              <span style={{ background: "linear-gradient(135deg,oklch(0.88 0.16 38),oklch(0.62 0.22 27))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                In One Place
              </span>
            </h2>
            <p className="text-white/45 max-w-xl mx-auto text-base leading-relaxed">
              From IP geolocation to CVE intelligence, Groq-powered chat to file malware scanning — 
              DefenSight is your all-in-one cybersecurity operations platform.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {FEATURES.map((feat, i) => (
              <TiltCard key={feat.title}>
                <Link
                  to={user ? feat.route : "/login"}
                  onMouseEnter={() => setActiveFeature(i)}
                  onMouseLeave={() => setActiveFeature(null)}
                  className={`block relative p-5 rounded-2xl bg-gradient-to-br ${feat.color} border ${feat.border} group h-full transition-all duration-300 ${activeFeature === i ? "scale-[1.02]" : ""}`}
                >
                  <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-400 pointer-events-none"
                    style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), inset 0 0 40px rgba(255,255,255,0.02)" }} />

                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-2.5 rounded-xl bg-white/[0.08] ${feat.accent} group-hover:scale-110 group-hover:bg-white/[0.13] transition-all duration-200`}>
                      <feat.icon className="h-4.5 w-4.5 h-[18px] w-[18px]" />
                    </div>
                    <Badge className="bg-white/[0.08] text-white/50 border-white/[0.08] text-[9px] uppercase tracking-wider font-semibold">
                      {feat.badge}
                    </Badge>
                  </div>

                  <h3 className="font-bold text-white text-sm mb-1.5 flex items-center justify-between" style={{ fontFamily: "Georgia, serif" }}>
                    <span>{feat.title}</span>
                    <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-80 group-hover:translate-x-0.5 transition-all duration-200 text-white/60" />
                  </h3>
                  <p className="text-[12px] text-white/50 leading-relaxed">{feat.desc}</p>
                </Link>
              </TiltCard>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          MODULE QUICK NAV GRID
      ════════════════════════════════════════ */}
      <section id="modules" className="py-16 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-black text-white mb-3" style={{ fontFamily: "Georgia, serif" }}>
              One Login. 14 Super-Powers.
            </h2>
            <p className="text-white/35 text-sm">All modules accessible from one unified dashboard after sign-in.</p>
          </div>

          <div className="grid grid-cols-4 sm:grid-cols-7 gap-3">
            {FEATURES.map(({ icon: Icon, title, accent, route }) => (
              <Link
                to={user ? route : "/login"}
                key={title}
                title={user ? `Open ${title}` : `Sign in to access ${title}`}
                className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.09] hover:border-orange-500/30 transition-all duration-200 group"
              >
                <Icon className={`h-5 w-5 text-white/40 group-hover:${accent} group-hover:scale-110 transition-all duration-200`} />
                <span className="text-[9px] text-white/30 group-hover:text-white/65 text-center leading-tight transition-colors duration-200 font-medium">
                  {title.split(" ")[0]}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          HOW IT WORKS
      ════════════════════════════════════════ */}
      <section id="how" className="py-24 px-4 sm:px-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: "repeating-linear-gradient(45deg,rgba(255,255,255,.5) 0 1px,transparent 1px 48px)" }} />

        <div className="max-w-6xl mx-auto relative z-10">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-blue-500/10 text-blue-400 border-blue-500/25 uppercase tracking-widest text-[10px]">
              Workflow
            </Badge>
            <h2 className="text-4xl sm:text-5xl font-black text-white mb-4" style={{ fontFamily: "Georgia, serif" }}>
              Threat Intelligence at the{" "}
              <span style={{ background: "linear-gradient(135deg,#60a5fa,#818cf8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                Speed of Thought
              </span>
            </h2>
            <p className="text-white/40 max-w-lg mx-auto text-sm leading-relaxed">
              From raw indicator to AI-synthesized security report in seconds. Zero crashes — even when API keys are missing, DefenSight falls back to local heuristics automatically.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-14 items-start">
            {/* Steps */}
            <div className="space-y-5">
              {[
                { n: "01", title: "Submit Any Indicator", desc: "Paste an IP, URL, domain, email, or phone — or upload a file. The global search router auto-detects the type and routes to the correct module.", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/25" },
                { n: "02", title: "Parallel Multi-Source Enrichment", desc: "DefenSight fires all relevant APIs concurrently with `Promise.all` + `settleProvider`. Never blocks on a single slow or missing provider. Up to 10 parallel calls for PhishGuard.", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/25" },
                { n: "03", title: "AI Threat Scoring", desc: "Signals are weighted — VPN/Tor (+30), AbuseIPDB (+25), VirusTotal malicious (+20), Google Safe Browsing hit (+35), CISA KEV listed (+25) — to produce a 0–100 risk score.", color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/25" },
                { n: "04", title: "Groq AI Narrative", desc: "Groq LLM (openai/gpt-oss-120b → 20b → qwen3.8-27b fallback chain) synthesizes all findings into plain-language executive-level reports with actionable recommendations.", color: "text-green-400", bg: "bg-green-500/10 border-green-500/25" },
                { n: "05", title: "Export & Audit Trail", desc: "Download professional PDF reports via jsPDF + autotable. Full JSON export for SIEM integration. All scans auto-saved to cloud-synced Firestore audit log.", color: "text-cyan-400", bg: "bg-cyan-500/10 border-cyan-500/25" },
              ].map(step => (
                <div key={step.n} className={`flex gap-5 p-5 rounded-2xl border ${step.bg} backdrop-blur-sm group hover:scale-[1.015] hover:shadow-lg transition-all duration-300 cursor-default`}>
                  <div className={`text-4xl font-black ${step.color} opacity-30 font-mono shrink-0 w-10 leading-none`} style={{ fontFamily: "Georgia, serif" }}>
                    {step.n}
                  </div>
                  <div>
                    <h3 className="font-bold text-white mb-1.5 text-sm" style={{ fontFamily: "Georgia, serif" }}>{step.title}</h3>
                    <p className="text-[12px] text-white/50 leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Terminal card */}
            <div className="lg:sticky lg:top-24">
              <div className="relative rounded-2xl overflow-hidden border border-white/[0.08] bg-[oklch(0.11_0.025_265)] shadow-2xl">
                {/* Title bar */}
                <div className="flex items-center gap-2 px-5 py-3 border-b border-white/[0.07] bg-white/[0.03]">
                  <div className="h-3 w-3 rounded-full bg-red-500/80" />
                  <div className="h-3 w-3 rounded-full bg-yellow-500/80" />
                  <div className="h-3 w-3 rounded-full bg-green-500/80" />
                  <span className="ml-2 text-[11px] text-white/25 font-mono">defensight — threat investigation</span>
                  <div className="ml-auto flex items-center gap-1.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-[9px] text-green-400/70 font-mono uppercase tracking-wider">live</span>
                  </div>
                </div>

                {/* Terminal output */}
                <div className="p-5 font-mono text-xs space-y-1.5 leading-relaxed max-h-[520px] overflow-y-auto">
                  <div className="text-green-400/90">$ defensight analyze 45.142.212.100</div>
                  <div className="text-white/30 ml-2">→ Auto-detected: IP address</div>
                  <div className="text-white/30 ml-2">→ Routing to IP Intelligence module…</div>
                  <div className="text-blue-400/60 ml-2 mt-2">▸ Querying MaxMind GeoIP2…</div>
                  <div className="text-blue-400/60 ml-2">▸ Fetching AbuseIPDB reports…</div>
                  <div className="text-blue-400/60 ml-2">▸ Checking VirusTotal (90+ engines)…</div>
                  <div className="text-blue-400/60 ml-2">▸ Scanning AlienVault OTX…</div>
                  <div className="text-blue-400/60 ml-2">▸ Probing Censys host assets…</div>
                  <div className="text-blue-400/60 ml-2">▸ Verifying ThreatFox IOC feed…</div>
                  <div className="text-blue-400/60 ml-2">▸ Cross-referencing HackerTarget…</div>
                  <div className="text-blue-400/60 ml-2">▸ Computing AI threat score…</div>
                  <div className="mt-4 p-3.5 rounded-xl bg-red-500/10 border border-red-500/25">
                    <div className="text-red-400 font-bold text-sm">🔴 Threat Score: 84 / 100 — CRITICAL</div>
                    <div className="text-white/40 mt-2 space-y-0.5">
                      <div>AbuseIPDB Confidence: 97% · Reports: 312</div>
                      <div>VirusTotal: 11/90 engines flagged</div>
                      <div>OTX Pulses: 6 · ThreatFox IOC: 2 hits</div>
                      <div>Censys: Port 3389 (RDP) exposed</div>
                      <div>Country: RU · ASN: AS201814</div>
                      <div>Tor Exit Node: false · VPN: true</div>
                    </div>
                  </div>
                  <div className="mt-3 text-white/30 ml-2">→ Sending to Groq (openai/gpt-oss-120b)…</div>
                  <div className="mt-2 p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-white/50 leading-relaxed text-[11px]">
                    <div className="text-blue-400/80 font-semibold text-xs mb-1">🤖 AI Security Summary</div>
                    "This IP address (45.142.212.100) exhibits a critical threat profile. With a 97% AbuseIPDB abuse confidence score and 312 community abuse reports, it is associated with malware distribution and SSH brute-force campaigns. VirusTotal shows 11 of 90 AV engines flagging active malicious activity. The exposed RDP port (3389) combined with VPN usage suggests infrastructure used for command-and-control operations. <strong className='text-white/70'>Recommendation: block immediately at perimeter firewall, add to threat feed watchlist, and investigate any lateral connections from internal hosts."</strong>
                  </div>
                  <div className="text-green-400/50 mt-3">✓ Report generated · PDF export ready</div>
                  <div className="text-white/20 mt-1 animate-pulse">█</div>
                </div>
              </div>

              {/* Glow behind card */}
              <div className="absolute -inset-6 rounded-3xl -z-10 blur-3xl opacity-25"
                style={{ background: "linear-gradient(135deg, oklch(0.62 0.22 27), oklch(0.50 0.18 265))" }} />
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          AI STACK — GROQ
      ════════════════════════════════════════ */}
      <section id="ai" className="py-24 px-4 sm:px-6 relative overflow-hidden">
        <div className="absolute inset-0"
          style={{ background: "linear-gradient(135deg, oklch(0.50 0.18 265 / 0.07) 0%, transparent 60%)" }} />

        <div className="max-w-5xl mx-auto relative z-10">
          <div className="text-center mb-14">
            <Badge className="mb-4 bg-purple-500/10 text-purple-400 border-purple-500/25 uppercase tracking-widest text-[10px]">
              AI Layer
            </Badge>
            <h2 className="text-4xl sm:text-5xl font-black text-white mb-4" style={{ fontFamily: "Georgia, serif" }}>
              Powered by{" "}
              <span style={{ background: "linear-gradient(135deg, #c084fc, #818cf8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                Groq LLM
              </span>
            </h2>
            <p className="text-white/40 max-w-lg mx-auto text-sm leading-relaxed">
              DefenSight routes all AI analysis through the Groq API — the fastest LLM inference available. 
              A three-model fallback chain ensures 100% uptime for AI features.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-5 mb-12">
            {GROQ_MODELS.map((m, i) => (
              <TiltCard key={m.name}>
                <div className={`p-6 rounded-2xl border ${i === 0 ? "border-purple-500/40 bg-purple-500/10" : "border-white/10 bg-white/[0.03]"} group hover:border-purple-500/30 transition-all duration-300 h-full cursor-default`}>
                  <div className="flex items-center justify-between mb-4">
                    <Badge className={`text-[9px] uppercase tracking-wider ${i === 0 ? "bg-purple-500/20 text-purple-300 border-purple-500/30" : "bg-white/[0.06] text-white/40 border-white/10"}`}>
                      {m.role}
                    </Badge>
                    <div className={`text-xs font-bold font-mono ${i === 0 ? "text-purple-400" : "text-white/30"}`}>{m.badge}</div>
                  </div>
                  <div className={`font-mono text-xs break-all leading-relaxed ${i === 0 ? "text-white/80" : "text-white/40"}`}>{m.name}</div>
                  {i === 0 && <div className="mt-3 text-[11px] text-purple-300/60">Primary model used for all AI security analysis, chat, email auditing, and news verification.</div>}
                </div>
              </TiltCard>
            ))}
          </div>

          {/* Groq use-cases */}
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { title: "Email Analyzer", desc: "Audits raw emails for BEC patterns, urgency tactics, wire fraud, credential harvesting and spoofing.", icon: Mail, color: "text-yellow-400" },
              { title: "News Analyzer", desc: "Fake-news detection: sentiment, bias, clickbait scoring, claim verifiability, real-world NewsAPI cross-reference.", icon: ScanSearch, color: "text-cyan-400" },
              { title: "AI Assistant", desc: "Dual-mode chat: plain Q&A for cybersecurity topics + background investigation with live API scanning.", icon: MessageSquare, color: "text-indigo-400" },
            ].map(({ title, desc, icon: Icon, color }) => (
              <div key={title} className="p-5 rounded-xl bg-white/[0.03] border border-white/[0.07] hover:bg-white/[0.06] hover:border-white/[0.14] transition-all duration-300 group cursor-default">
                <Icon className={`h-5 w-5 ${color} mb-3 group-hover:scale-110 transition-transform duration-200`} />
                <h3 className="font-semibold text-white text-sm mb-1.5" style={{ fontFamily: "Georgia, serif" }}>{title}</h3>
                <p className="text-[11px] text-white/40 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          STATS
      ════════════════════════════════════════ */}
      <section id="stats" className="py-24 px-4 sm:px-6 relative overflow-hidden">
        <div className="absolute inset-0"
          style={{ background: "linear-gradient(135deg, oklch(0.62 0.22 27 / 0.07) 0%, transparent 50%, oklch(0.50 0.18 265 / 0.06) 100%)" }} />
        <div ref={statsSection.ref} className="max-w-5xl mx-auto relative z-10">
          <div className="text-center mb-14">
            <Badge className="mb-4 bg-white/[0.07] text-white/50 border-white/[0.08] uppercase tracking-widest text-[10px]">
              By the Numbers
            </Badge>
            <h2 className="text-4xl sm:text-5xl font-black text-white mb-3" style={{ fontFamily: "Georgia, serif" }}>
              Built on Real Intelligence
            </h2>
            <p className="text-white/35 max-w-md mx-auto text-sm">Production-grade architecture, zero-crash by design.</p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {STATS.map(s => (
              <StatCard key={s.label} {...s} inView={statsSection.inView} />
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          PHISHGUARD DEEP DIVE
      ════════════════════════════════════════ */}
      <section className="py-24 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <Badge className="mb-4 bg-orange-500/10 text-orange-400 border-orange-500/25 uppercase tracking-widest text-[10px]">
              Spotlight
            </Badge>
            <h2 className="text-4xl sm:text-5xl font-black text-white mb-4" style={{ fontFamily: "Georgia, serif" }}>
              PhishGuard: <span className="italic" style={{ color: "oklch(0.75 0.20 38)" }}>10+ Feeds</span> in Parallel
            </h2>
            <p className="text-white/40 max-w-lg mx-auto text-sm">
              Our most comprehensive module — correlates DNS, WHOIS, screenshots, 
              threat feeds and domain signals into one definitive phishing verdict.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
            {[
              { label: "DNSDumpster", desc: "SPF · DMARC · DKIM · NS records" },
              { label: "WhoisFreaks", desc: "Domain age · registrar · expiry" },
              { label: "VirusTotal", desc: "90+ AV URL detection ratio" },
              { label: "Google Safe Browsing", desc: "Real-time phishing/malware DB" },
              { label: "PhishStats", desc: "Community phishing feed" },
              { label: "URLhaus", desc: "Active malware distribution URLs" },
              { label: "AlienVault OTX", desc: "Threat pulse matches" },
              { label: "ThreatFox", desc: "IOC / C2 domain registry" },
              { label: "urlscan.io", desc: "Screenshot · passive DNS" },
              { label: "Censys", desc: "Exposed ports on host IP" },
              { label: "MaxMind GeoIP", desc: "Hosting country · ASN" },
              { label: "Microlink", desc: "Visual screenshot rendering" },
            ].map(({ label, desc }) => (
              <div key={label}
                className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.07] hover:bg-orange-500/[0.08] hover:border-orange-500/25 transition-all duration-200 group cursor-default">
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-1.5 w-1.5 rounded-full bg-orange-400/50 group-hover:bg-orange-400 transition-colors" />
                  <span className="text-xs font-semibold text-white/70 group-hover:text-white/90 transition-colors">{label}</span>
                </div>
                <p className="text-[10px] text-white/30 leading-relaxed pl-3.5">{desc}</p>
              </div>
            ))}
          </div>

          <div className="flex justify-center">
            <Link to={user ? "/phishing" : "/login"}>
              <Button className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 text-white border-0 shadow-xl shadow-orange-500/25 hover:shadow-orange-500/45 hover:scale-105 transition-all duration-200 rounded-xl px-8 h-12">
                <Globe className="h-4 w-4 mr-2" />
                {user ? "Open PhishGuard Scanner" : "Try PhishGuard Free"}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          ARCHITECTURE PILLARS
      ════════════════════════════════════════ */}
      <section className="py-20 px-4 sm:px-6 relative">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-3" style={{ fontFamily: "Georgia, serif" }}>
              Zero-Crash Architecture
            </h2>
            <p className="text-white/35 max-w-md mx-auto text-sm">
              If any API key is missing or rate-limited, DefenSight silently falls back to built-in local heuristics. No 500 errors. No broken pages. Ever.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: Shield, title: "settleProvider()", desc: "Every provider call wrapped in a never-throw helper. Returns `{ok, data}` or `{ok: false, error}`.", color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
              { icon: Lock, title: "optionalEnv()", desc: "Returns `undefined` for missing API keys. Never crashes. Missing providers shown as 'using local intelligence'.", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
              { icon: Zap, title: "Groq Fallback Chain", desc: "Three-model cascade: 120B → 20B → 27B. If all fail, a deterministic local heuristic generates the report.", color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20" },
              { icon: Activity, title: "Local Heuristics", desc: "Every analyzer has a deterministic fallback with NLP pattern matching and static rule scoring. 94% accuracy.", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
            ].map(p => (
              <div key={p.title}
                className={`p-5 rounded-2xl border ${p.bg} group hover:scale-[1.02] hover:shadow-lg transition-all duration-300 cursor-default`}>
                <p.icon className={`h-5 w-5 ${p.color} mb-3 group-hover:scale-110 transition-transform duration-200`} />
                <h3 className="font-bold text-white text-sm mb-2 font-mono">{p.title}</h3>
                <p className="text-[11px] text-white/45 leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          TESTIMONIALS
      ════════════════════════════════════════ */}
      <section className="py-24 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-green-500/10 text-green-400 border-green-500/25 uppercase tracking-widest text-[10px]">
              Community
            </Badge>
            <h2 className="text-4xl sm:text-5xl font-black text-white mb-3" style={{ fontFamily: "Georgia, serif" }}>
              Trusted by Security Teams
            </h2>
            <p className="text-white/35 text-sm max-w-md mx-auto">
              From SOC analysts to penetration testers — DefenSight is the unified tool they rely on daily.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {TESTIMONIALS.map((t, i) => (
              <TiltCard key={i}>
                <div className="p-6 rounded-2xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.07] hover:border-white/[0.15] transition-all duration-300 h-full flex flex-col group cursor-default">
                  <div className="flex gap-0.5 mb-5">
                    {Array.from({ length: t.stars }).map((_, j) => (
                      <Star key={j} className="h-3.5 w-3.5 text-orange-400 fill-orange-400" />
                    ))}
                  </div>
                  <p className="text-white/60 text-sm leading-relaxed flex-1 italic">"{t.text}"</p>
                  <div className="mt-5 pt-4 border-t border-white/[0.07]">
                    <div className="font-bold text-white/90 text-sm">{t.author}</div>
                    <div className="text-white/35 text-[11px] mt-0.5">{t.role}</div>
                  </div>
                </div>
              </TiltCard>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          TECH STACK
      ════════════════════════════════════════ */}
      <section className="py-20 px-4 sm:px-6 border-y border-white/[0.06]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black text-white mb-2" style={{ fontFamily: "Georgia, serif" }}>
              Built with Modern Tech
            </h2>
            <p className="text-white/30 text-sm">React 19 + Vite 7 + Tailwind CSS v4 + Firebase + Groq + Vercel Serverless</p>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {[
              { label: "React 19", sub: "Frontend" },
              { label: "Vite 7", sub: "Build tool" },
              { label: "Tailwind v4", sub: "Styling" },
              { label: "Groq AI", sub: "LLM layer" },
              { label: "Firebase", sub: "Auth + DB" },
              { label: "Vercel", sub: "Deployment" },
              { label: "TypeScript", sub: "Type safety" },
              { label: "Recharts", sub: "Analytics" },
              { label: "Radix UI", sub: "Components" },
              { label: "jsPDF", sub: "PDF export" },
              { label: "Firestore", sub: "Cloud DB" },
              { label: "React Router v7", sub: "Routing" },
            ].map(({ label, sub }) => (
              <div key={label}
                className="text-center p-4 rounded-xl bg-white/[0.03] border border-white/[0.07] hover:bg-white/[0.07] hover:border-orange-500/20 transition-all duration-200 group cursor-default">
                <div className="font-bold text-white/70 group-hover:text-white text-xs mb-1 transition-colors">{label}</div>
                <div className="text-[9px] text-white/25 uppercase tracking-wider">{sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          MOBILE APP COMING SOON
      ════════════════════════════════════════ */}
      <section className="py-24 px-4 sm:px-6 relative overflow-hidden">
        <div className="absolute inset-0"
          style={{ background: "linear-gradient(135deg, oklch(0.50 0.18 265 / 0.10) 0%, oklch(0.62 0.22 27 / 0.06) 100%)" }} />
        <div className="absolute top-0 left-0 right-0 h-px"
          style={{ background: "linear-gradient(90deg, transparent, oklch(0.62 0.22 27 / 0.4), transparent)" }} />

        <div className="max-w-4xl mx-auto text-center relative z-10">
          {/* Phone frame mockup */}
          <div className="relative inline-block mb-10">
            <div className="relative mx-auto w-48 sm:w-56 h-[340px] sm:h-[400px] rounded-[2.5rem] border-2 border-white/15 bg-[oklch(0.11_0.025_265)] shadow-2xl shadow-black/60 overflow-hidden">
              {/* Status bar */}
              <div className="flex items-center justify-between px-6 py-3 text-[9px] text-white/30 font-mono">
                <span>9:41</span>
                <div className="flex gap-1.5 items-center">
                  <div className="flex gap-0.5">
                    <div className="w-1 h-1.5 bg-white/40 rounded-full" />
                    <div className="w-1 h-2 bg-white/40 rounded-full" />
                    <div className="w-1 h-2.5 bg-white/40 rounded-full" />
                    <div className="w-1 h-3 bg-white/50 rounded-full" />
                  </div>
                  <div className="w-5 h-2.5 rounded border border-white/30 flex items-center px-0.5">
                    <div className="h-1 w-3 bg-green-400/70 rounded-sm" />
                  </div>
                </div>
              </div>

              {/* Notch */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-6 bg-[oklch(0.11_0.025_265)] rounded-b-2xl" />

              {/* App content */}
              <div className="px-4 pb-4 space-y-2">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-6 w-6 rounded-lg overflow-hidden">
                    <img src="/logo.png" alt="DefenSight" className="h-full w-full object-cover" />
                  </div>
                  <span className="text-[10px] font-bold text-white/80">DefenSight</span>
                </div>

                {[
                  { label: "IP Intel", score: 84, color: "bg-red-500" },
                  { label: "PhishGuard", score: 62, color: "bg-orange-500" },
                  { label: "Vuln Intel", score: 45, color: "bg-yellow-500" },
                ].map(item => (
                  <div key={item.label} className="p-2 rounded-lg bg-white/[0.05] border border-white/[0.06]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] text-white/60">{item.label}</span>
                      <span className="text-[9px] font-bold text-white/80">{item.score}</span>
                    </div>
                    <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                      <div className={`h-full ${item.color} rounded-full`} style={{ width: `${item.score}%`, opacity: 0.8 }} />
                    </div>
                  </div>
                ))}

                <div className="mt-3 p-2 rounded-lg bg-orange-500/15 border border-orange-500/25 text-center">
                  <div className="text-[8px] text-orange-400/80 font-medium">🔴 2 Critical Threats Detected</div>
                </div>
              </div>

              {/* Bottom bar */}
              <div className="absolute bottom-0 left-0 right-0 h-14 bg-[oklch(0.11_0.025_265)] border-t border-white/[0.06] flex items-center justify-around px-4">
                {[LayoutDashboard, Shield, Radar, Bell, User].map((Icon, i) => (
                  <Icon key={i} className={`h-4 w-4 ${i === 2 ? "text-orange-400" : "text-white/25"}`} />
                ))}
              </div>

              {/* Animated scan line inside phone */}
              <div className="absolute left-0 right-0 h-px opacity-40 pointer-events-none"
                style={{ background: "linear-gradient(90deg, transparent, oklch(0.62 0.22 27), transparent)", animation: "scanLine 3s linear infinite" }} />
            </div>

            {/* Glow behind phone */}
            <div className="absolute -inset-8 rounded-full -z-10 blur-3xl opacity-30"
              style={{ background: "radial-gradient(circle, oklch(0.50 0.18 265), transparent)" }} />

            {/* Coming soon badge */}
            <div className="absolute -top-3 -right-3 px-3 py-1.5 rounded-full bg-gradient-to-r from-orange-500 to-red-600 text-white text-[10px] font-bold uppercase tracking-wider shadow-lg shadow-orange-500/30 animate-pulse-slow">
              Coming Soon
            </div>
          </div>

          {/* Text */}
          <div className="max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/[0.12] border border-blue-500/25 text-blue-400 text-xs font-semibold uppercase tracking-widest mb-6">
              <Smartphone className="h-3.5 w-3.5" />
              Mobile App — Coming Soon
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4" style={{ fontFamily: "Georgia, serif" }}>
              DefenSight in Your Pocket
            </h2>
            <p className="text-white/45 text-base leading-relaxed mb-8">
              We're building native iOS & Android apps for DefenSight — bringing all 14 security modules, real-time threat alerts, AI-powered analysis, and cloud-synced scan history right to your phone.
            </p>

            <div className="flex flex-wrap gap-4 justify-center mb-8">
              {[
                { icon: Bell, text: "Real-time threat alerts" },
                { icon: Activity, text: "Live threat monitoring" },
                { icon: Download, text: "Offline report access" },
                { icon: Shield, text: "On-device privacy" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.05] border border-white/[0.08] text-white/50 text-xs">
                  <Icon className="h-3.5 w-3.5 text-blue-400/70" />
                  {text}
                </div>
              ))}
            </div>

            {/* Notify form */}
            <form onSubmit={handleNotifySubmit} className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
              <div className="flex-1 relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/25" />
                <input
                  type="email"
                  value={notifyEmail}
                  onChange={(e) => setNotifyEmail(e.target.value)}
                  disabled={notifyLoading}
                  placeholder="name@company.com"
                  className="w-full h-11 pl-10 pr-4 rounded-xl bg-white/[0.06] border border-white/[0.10] text-white placeholder-white/25 text-sm outline-none focus:border-orange-500/50 focus:bg-white/[0.09] transition-all disabled:opacity-60"
                />
              </div>
              <Button
                type="submit"
                disabled={notifyLoading}
                className="h-11 px-6 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-white border-0 shadow-lg shadow-blue-500/25 hover:scale-105 transition-all duration-200 rounded-xl shrink-0 font-semibold text-sm cursor-pointer disabled:opacity-60"
              >
                {notifyLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                    Saving...
                  </>
                ) : notifySuccess ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-green-300 mr-1.5" />
                    Joined!
                  </>
                ) : (
                  "Notify Me"
                )}
              </Button>
            </form>

            {notifySuccess ? (
              <div className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-green-500/15 border border-green-500/30 text-green-400 text-xs font-medium animate-in fade-in zoom-in-95 duration-200">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                <span>You're on the early access waitlist! We'll notify you on launch.</span>
              </div>
            ) : (
              <p className="text-white/25 text-[11px] mt-3">No spam. Stored securely — we will only email you on launch day.</p>
            )}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          FOOTER
      ════════════════════════════════════════ */}
      <footer className="border-t border-white/[0.08] bg-[oklch(0.06_0.02_265)] pt-16 pb-12 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
            {/* Brand Column */}
            <div className="md:col-span-1 space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl overflow-hidden shadow-md shadow-orange-500/20">
                  <img src="/logo.png" alt="DefenSight" className="h-full w-full object-cover" />
                </div>
                <div>
                  <span className="font-bold text-base text-white tracking-tight">DefenSight</span>
                  <div className="text-[9px] uppercase tracking-widest text-orange-400 font-semibold">AI Security Suite</div>
                </div>
              </div>
              <p className="text-xs text-white/40 leading-relaxed">
                Enterprise-grade cybersecurity intelligence platform. Multi-feed correlation, Groq-powered AI investigations, and zero-crash resilient architecture.
              </p>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-[11px] text-white/50">
                <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                <span>All 23 Feeds Operational</span>
              </div>
            </div>

            {/* Modules Column */}
            <div className="space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-white/70">
                Security Modules
              </div>
              <ul className="space-y-2 text-xs text-white/40">
                <li>
                  <Link to="/intel/ip" className="hover:text-white transition-colors duration-200">
                    IP Intelligence
                  </Link>
                </li>
                <li>
                  <Link to="/phishing" className="hover:text-white transition-colors duration-200">
                    PhishGuard URL Scanner
                  </Link>
                </li>
                <li>
                  <Link to="/email" className="hover:text-white transition-colors duration-200">
                    Email Phishing Analyzer
                  </Link>
                </li>
                <li>
                  <Link to="/intel/file" className="hover:text-white transition-colors duration-200">
                    Multi-AV File Scanner
                  </Link>
                </li>
                <li>
                  <Link to="/vulnerability" className="hover:text-white transition-colors duration-200">
                    CVE & Vulnerability Intel
                  </Link>
                </li>
                <li>
                  <Link to="/password" className="hover:text-white transition-colors duration-200">
                    Password Entropy Lab
                  </Link>
                </li>
              </ul>
            </div>

            {/* Platform & Navigation Column */}
            <div className="space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-white/70">
                Platform
              </div>
              <ul className="space-y-2 text-xs text-white/40">
                <li>
                  <button onClick={() => scrollTo("features")} className="hover:text-white text-left transition-colors duration-200">
                    14 Core Modules
                  </button>
                </li>
                <li>
                  <button onClick={() => scrollTo("how")} className="hover:text-white text-left transition-colors duration-200">
                    Investigation Pipeline
                  </button>
                </li>
                <li>
                  <button onClick={() => scrollTo("ai")} className="hover:text-white text-left transition-colors duration-200">
                    Groq LLM Architecture
                  </button>
                </li>
                <li>
                  <button onClick={() => scrollTo("providers")} className="hover:text-white text-left transition-colors duration-200">
                    23+ Threat Providers
                  </button>
                </li>
                <li>
                  <button onClick={() => scrollTo("stats")} className="hover:text-white text-left transition-colors duration-200">
                    Intelligence Metrics
                  </button>
                </li>
                <li>
                  <button onClick={() => scrollTo("mobile")} className="hover:text-white text-left transition-colors duration-200">
                    Mobile App Preview
                  </button>
                </li>
              </ul>
            </div>

            {/* Architecture & Reliability Column */}
            <div className="space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-white/70">
                Reliability & Trust
              </div>
              <ul className="space-y-2 text-xs text-white/40">
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-400/80 shrink-0" />
                  <span>Zero-Crash Fail-Safe Design</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-400/80 shrink-0" />
                  <span>Local Heuristics Fallback</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-400/80 shrink-0" />
                  <span>100% Client-Side Password Lab</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-400/80 shrink-0" />
                  <span>Cloud Firestore Sync</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-400/80 shrink-0" />
                  <span>Free & Open Source (MIT)</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 border-t border-white/[0.06] text-xs text-white/30">
            <p>
              © {new Date().getFullYear()} DefenSight. Built for security teams, red teamers, and SOC analysts.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <span>React 19 + Vite 7</span>
              <span>•</span>
              <span>Groq AI Layer</span>
              <span>•</span>
              <span>Firebase Cloud</span>
              <span>•</span>
              <span className="text-white/50 font-medium">MIT License</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
