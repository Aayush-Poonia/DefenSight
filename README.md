# 🛡️ DefenSight — AI-Powered Cybersecurity Suite

**DefenSight** is an enterprise-grade, AI-powered cybersecurity SaaS application built with **React 19**, **Vite 7**, **Tailwind CSS v4**, **Groq AI (Llama-3.3-70B)**, and **Firebase Authentication & Firestore**.

It combines real-time threat intelligence, AI fake news detection, phishing email auditing, URL investigation, password security, an AI assistant chat interface, PDF report generation, and cloud-synced scan history into a unified platform.

---

## 🌟 Key Features & Tools

### 1. 📊 Threat Dashboard (`/dashboard`)
- **Global Search Router**: Enter any indicator (IP address, URL, domain, email, or phone number) to automatically detect its type and route directly to the appropriate scanner.
- **KPI Metrics**: Total investigations, Phishing URLs detected, High risk scans, and Most active security module.
- **Visual Analytics**: Interactive Recharts breakdown of threat distribution (High / Medium / Low) and tool activity metrics.
- **Recent Activity Feed**: Instant view of recent security scans with threat badges.

### 2. 📡 Intel Hub (`/intel`)
A centralized threat intelligence repository featuring specialized OSINT tools:
- **IP Intelligence** (`/intel/ip`): Geolocation, ISP, ASN lookup, VPN/Proxy/Tor/Hosting provider classification, and multi-feed abuse scoring.
- **Phone Intelligence** (`/intel/phone`): International phone number validation, carrier identification, and line-type detection (VOIP vs Mobile vs Landline).
- **File Scanner** (`/intel/file`): Instant SHA256 checksum generation, static file magic-byte inspection, file size profiling, and entropy analysis.
- **Email Lookup** (`/intel/email`): Email deliverability verification, MX record checks, and disposable email domain detection.

### 3. 🌐 PhishGuard URL Scanner (`/phishing`)
- **Visual Website Screenshot**: Displays visual website snapshots via Microlink with automated fallback rendering (`s-shot.ru`).
- **Domain & WHOIS Intelligence**: Domain age calculation, registrar identification, registration/expiration dates, and nameserver lookup.
- **Threat Correlation**: Correlates threat indicators across VirusTotal, Safe Browsing, PhishStats, URLhaus, AlienVault OTX, and ThreatFox.
- **Risk Factor Breakdown**: Transparent scoring model highlighting punycode URLs, IP hostnames, brand impersonation, and redirect chains.

### 4. 📧 Email Analyzer (`/email`)
- **AI Phishing Email Audit**: Powered by **Groq Llama-3.3-70B** to detect Business Email Compromise (BEC), gift card fraud, direct deposit scams, and credential harvesting emails.
- **Header & Link Extraction**: Audits sender display-name mismatch vs domain, recipient targeting, and extracts embedded links.
- **Multi-Tabbed Interface**:
  - `Analyze`: Content inputs (From, To, Subject, Body), text metric chips (word count, suspicious link count, caps ratio), and pre-loaded attack samples (CEO Gift Card scam, Netflix suspend billing, HR Payroll scam, Safe GitHub notification).
  - `History`: Cloud and local scan log with quick re-review.
  - `About`: Explanations of BEC detection, header profiling, and risk calibration.

### 5. 📰 News Analyzer (`/news`)
- **Misinformation & Fake News Auditing**: Paste headlines, news articles, or social media posts to detect clickbait, sensationalism, and unverified claims.
- **LLM Reasoning**: Evaluates sentiment (alarmist, opinionated, neutral), bias (sensationalist, subjective, unbiased), red flags, credibility signals, and atomic claim verifiability.
- **Multi-Tabbed Layout**: `Analyze`, `History`, and `About` sections with sample news datasets.

### 6. 🤖 Groq AI Assistant (`/chat`)
- **Cybersecurity Chat Interface**: Placed directly below News Analyzer in the navigation sidebar.
- **Powered by Groq**: Communicates with Groq's `llama-3.3-70b-versatile` model to answer cyber defense questions, explain attack vectors (SQL Injection, XSS, Ransomware, 2FA, API keys), or audit code.
- **Inline Tool Execution**: Enter queries like `"Analyze news: [text]"` or `"Check URL: [https://...]"` to invoke security tools directly inside the chat.
- **Preset Quick Prompts**: One-click prompt cards for instant answers.

### 7. 🔑 Password Lab (`/password`)
- **100% Client-Side Entropy Scoring**: Calculates password strength, character class coverage, and pattern repetition without sending passwords across the wire.
- **Attack Crack Estimates**: Estimated time to crack against offline fast-hashing, online unthrottled, and online rate-limited scenarios.
- **Password Generator**: Customizable length and character set generator.

### 8. 📄 PDF & JSON Reports (`/reports`)
- **One-Click PDF Export**: Generates professional PDF security investigation reports using `jsPDF` and `jspdf-autotable`.
- **JSON Data Export**: Full structured JSON export of all scan data.

### 9. 📜 Scan History (`/history`)
- **Centralized Security Audit Log**: Filter past scans by tool type, inspect risk scores, and manage history records.

---

## 🛡️ Fail-Safe Architecture & Offline Fallbacks

DefenSight is designed with **zero-crash reliability**:
- **API Key Independence**: If any third-party API key (Groq, VirusTotal, Scanii, Abstract, AbuseIPDB, WhoisFreaks) is missing or rate-limited, DefenSight **never crashes or returns 502/500 errors**.
- **Local Heuristics Engine**: Seamlessly falls back to built-in local heuristics for IP subnets, carrier prefixes, email MX formats, static file entropy, URL pattern scoring, and NLP news/email analysis.

---

## 🏗️ Technology Stack

| Layer | Technology |
|---|---|
| **Frontend Framework** | React 19 + Vite 7 |
| **Routing** | React Router v7 |
| **Styling** | Vanilla CSS + Tailwind CSS v4 + Radix UI + Lucide Icons |
| **Charts & Visualizations** | Recharts |
| **PDF & Export** | jsPDF + jspdf-autotable |
| **Authentication & Cloud DB** | Firebase Authentication + Cloud Firestore |
| **Backend API Server** | Node.js / Connect API Dev Middleware + Vercel Serverless Functions (`api/`) |
| **AI LLM Engine** | Groq API (`llama-3.3-70b-versatile`) |
| **Visual Screenshot Engine** | Microlink API + `urlscan.io` + `s-shot.ru` fallback |

---

## 📁 Project Structure

```
.
├── api/                           # Vercel Serverless API Functions
│   ├── _lib/                      # Shared HTTP helpers, cors, threat scoring & providers
│   ├── analyze-email.ts           # Groq AI Phishing Email Audit API
│   ├── analyze-news.ts            # Groq AI News Analyzer & Chat Assistant API
│   ├── analyze-phishing.ts        # Phishing heuristic evaluation API
│   ├── email.ts                   # Email Lookup & MX validation API
│   ├── file.ts                    # File SHA256 & magic-byte scanner API
│   ├── ip.ts                      # IP Intelligence & Geolocation API
│   ├── phishing-intel.ts          # PhishGuard URL correlation API
│   ├── phone.ts                   # Phone Intelligence API
│   └── url.ts                     # URL threat provider API
├── server/
│   └── dev-middleware.ts          # Vite API middleware for local node server execution
├── src/
│   ├── components/
│   │   ├── AppShell.tsx           # DefenSight sidebar navigation & app shell
│   │   ├── layout/                # PageHeader & PremiumCard containers
│   │   ├── threat/                # ThreatScorePanel, AdvancedDetailsPanel & ResultActions
│   │   └── ui/                    # shadcn UI components (Card, Button, Input, Badge, etc.)
│   ├── contexts/
│   │   └── AuthContext.tsx        # Firebase Authentication context provider
│   ├── lib/
│   │   ├── api.ts                 # API invoker helper functions
│   │   ├── firebase.ts            # Firebase app initialization
│   │   ├── firestore.ts           # Cloud Firestore CRUD utilities
│   │   ├── intel-api.ts           # OSINT threat intelligence wrapper
│   │   └── scan-history.ts        # Local & cloud scan history state
│   ├── pages/
│   │   ├── Account.tsx            # User profile & settings
│   │   ├── Chat.tsx               # Groq AI Security Assistant page
│   │   ├── Dashboard.tsx          # DefenSight Threat Overview Dashboard
│   │   ├── EmailAnalyzer.tsx      # AI Phishing Email Analyzer
│   │   ├── EmailIntelligence.tsx  # Email Lookup in Intel Hub
│   │   ├── FileScanner.tsx        # File Scanner in Intel Hub
│   │   ├── HistoryPage.tsx        # Scan History Viewer
│   │   ├── Home.tsx               # News Misinformation Analyzer
│   │   ├── IpIntelligence.tsx     # IP Intelligence in Intel Hub
│   │   ├── Login.tsx              # DefenSight Auth Page (Email/Password & Google OAuth)
│   │   ├── Password.tsx           # Password Strength & Generator Lab
│   │   ├── Phishing.tsx           # PhishGuard URL Scanner
│   │   ├── PhoneIntelligence.tsx  # Phone Intelligence in Intel Hub
│   │   └── Reports.tsx            # PDF & JSON Report Export Manager
│   ├── styles.css                 # DefenSight Design System & lightweight keyframe animations
│   ├── App.tsx                    # Router & Protected Route manager
│   └── main.tsx                   # React app entrypoint
├── index.html                     # HTML root entry point with DefenSight metadata
├── package.json                   # Project dependencies & build scripts
├── tsconfig.json                  # TypeScript compiler settings
└── vite.config.ts                 # Vite bundler configuration & API dev middleware plugin
```

---

## 🛠️ Local Setup & Running Locally

### Prerequisites
- Node.js 18+ or Bun
- npm / yarn / pnpm / bun

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration (Optional)
Create a `.env` file in the project root if you wish to provide third-party API keys:

```env
GROQ_API_KEY=your_groq_api_key_here
WHOISXML_API_KEY=your_whoisxml_key
VIRUSTOTAL_API_KEY=your_virustotal_key
ABUSEIPDB_API_KEY=your_abuseipdb_key
IPINFO_TOKEN=your_ipinfo_token
```
*(Note: If no API keys are provided, DefenSight automatically uses its built-in local fallback engines.)*

### 3. Start Development Server
```bash
npm run dev
```
Open your browser and navigate to `http://localhost:5173`.

### 4. Build for Production
```bash
npm run build
```
The optimized production bundle will be generated in the `dist/` directory.

---

## 📝 License

MIT License
