# 🛡️ DefenSight — AI-Powered Cybersecurity Suite

**DefenSight** is an enterprise-grade, AI-powered cybersecurity SaaS platform built with **React 19**, **Vite 7**, **Tailwind CSS v4**, **Groq AI**, and **Firebase**. It combines real-time multi-source threat intelligence, AI-powered phishing & fake-news detection, DNS reconnaissance, phone validation, file malware scanning, and a conversational AI security assistant — all in one unified platform.

> 🔒 **Zero-crash design**: If any API key is missing or rate-limited, DefenSight silently falls back to built-in local heuristics. No 500 errors, no broken pages.

---

## 🌟 Feature Overview

| # | Tool | Route | Description |
|---|------|-------|-------------|
| 1 | Threat Dashboard | `/dashboard` | Global search router, KPI metrics, visual analytics |
| 2 | IP Intelligence | `/intel/ip` | Multi-feed IP geolocation, ASN, threat scoring |
| 3 | Phone Intelligence | `/intel/phone` | 3-source phone validation & carrier enrichment |
| 4 | File Scanner | `/intel/file` | SHA256, magic bytes, VirusTotal, Hybrid Analysis |
| 5 | Email Lookup | `/intel/email` | MX validation, disposable domain detection |
| 6 | PhishGuard | `/phishing` | 10+ feed URL phishing scanner with DNS recon |
| 7 | Email Analyzer | `/email` | Groq AI phishing email & BEC audit |
| 8 | News Analyzer | `/news` | AI fake-news detection + NewsAPI cross-reference |
| 9 | AI Assistant | `/chat` | Groq-powered security chatbot + live news queries |
| 10 | Password Lab | `/password` | Client-side entropy scoring & password generator |
| 11 | Reports | `/reports` | PDF & JSON export of all scan results |
| 12 | Scan History | `/history` | Centralized audit log with filtering |
| 13 | Account | `/settings` | Profile, avatar, and password management |

---

## 🔬 How Each Feature Works

### 1. 📊 Threat Dashboard (`/dashboard`)

The landing page after login. It provides:

- **Global Search Router**: Detects the input type automatically — IP address, URL/domain, email address, or phone number — and routes the query to the correct scanner without manual selection.
- **KPI Metrics**: Live aggregated counters for total investigations run, phishing URLs detected, high-risk scans, and the most-active security module.
- **Visual Analytics**: Interactive Recharts pie/bar charts showing threat distribution breakdown (High / Medium / Low) and per-tool scan counts.
- **Recent Activity Feed**: Scrollable list of recent scans showing tool type, input, threat score badge, and timestamp.

---

### 2. 📡 IP Intelligence (`/intel/ip`)

Runs **4 parallel provider calls** and merges results into a single enriched response:

#### How it works:
1. User enters any IPv4 address.
2. `api/ip.ts` fires all providers concurrently via `Promise.all` + `settleProvider` (never throws on failure).
3. Results are merged with priority ordering and passed to `scoreIp()` for final threat scoring.
4. The UI renders a detailed card with geolocation map, risk gauge, and per-provider source breakdown.

#### Providers:

| Provider | What it contributes |
|----------|-------------------|
| **MaxMind GeoIP2 / GeoLite2** | Country, state, city, continent, coordinates, timezone, ISP/org, ASN number, anonymity traits (`is_anonymous_vpn`, `is_anonymous_proxy`, `is_tor_exit_node`, `is_hosting_provider`, `is_public_proxy`, `is_residential_proxy`) |
| **Censys Host Asset Intelligence** | Open ports list, exposed services (HTTP/HTTPS/SSH/RDP/FTP/Telnet/databases), service count, reverse DNS, infrastructure risk score |
| **AbuseIPDB** | Abuse confidence score (0–100), total reports, last reported date, ISP, usage type |
| **IPinfo** | Country, org, hostname, ASN, carrier enrichment |
| **VirusTotal** | Malicious/total detection ratio across 90+ AV engines |
| **AlienVault OTX** | Pulse count (threat intelligence matches in OTX community feeds) |
| **ThreatFox (Abuse.ch)** | IOC matches for known malware C2 infrastructure |
| **AbstractAPI** | IP type, connection type, VPN/proxy/Tor detection |

#### Threat Scoring (`scoreIp`):
Signals that add to the risk score:
- VPN / anonymous proxy / Tor exit node detected → **+30 pts**
- Hosting provider IP → **+15 pts**
- AbuseIPDB confidence > 50% → **+25 pts** (scaled)
- VirusTotal malicious detections → **+20 pts** (scaled)
- OTX pulses > 0 → **+15 pts**
- ThreatFox IOC hits → **+20 pts**
- Censys high-risk management ports exposed (RDP, Telnet, raw DBs) → **+10–15 pts**

---

### 3. 📞 Phone Intelligence (`/intel/phone`)

Runs **3 parallel providers** for maximum accuracy.

#### How it works:
1. User enters a phone number in any format (international, local, with/without `+`).
2. `api/phone.ts` normalizes the number and queries all three providers simultaneously.
3. Results are merged with Veriphone taking the highest priority for country/carrier/type.
4. `scorePhone()` uses cross-source agreement for a confident verdict.

#### Providers:

| Provider | What it contributes |
|----------|-------------------|
| **Veriphone** *(primary)* | `phone_valid`, `phone_type` (mobile/fixed_line/voip/unknown), `geographical` flag (false = VoIP/virtual), `phone_region` (city+state), carrier name, E.164 format, timezone array |
| **Numverify / APILayer** | Validity, country code, country name, carrier, line type, international & local format |
| **AbstractAPI** | Risk score, VoIP flag, deliverability, timezone, country |

#### Merged output fields:
- `valid` — cross-source boolean agreement
- `carrier` — Veriphone → Numverify → Abstract (priority cascade)
- `line_type` — Veriphone `phone_type` → Numverify → Abstract
- `region` — Veriphone human-readable city+state → Numverify location
- `timezone` — Veriphone timezone array (first entry used)
- `e164` — standardized E.164 format from Veriphone
- `is_geographical` — Veriphone geographic flag (false = virtual/VoIP)

#### Threat Scoring (`scorePhone`):
- Any provider says invalid → **+40 pts** "Number failed validation (multi-source)"
- VoIP / non-geographical / `phone_type: voip` → **+20 pts**
- Unknown non-geographic line type (Veriphone) → **+10 pts**
- Premium / toll lines → **+25 pts**
- Provider risk score (Abstract) → **up to +35 pts** scaled
- All sources agree valid, no flags → baseline **5 pts** ✅

---

### 4. 🗂️ File Scanner (`/intel/file`)

#### How it works:
1. User uploads a file or pastes a file hash.
2. File is read client-side: SHA256 hash computed, magic bytes extracted, MIME type detected.
3. `api/file.ts` queries VirusTotal, Hybrid Analysis, MalwareBazaar, ThreatFox, and Scanii in parallel.
4. Results are merged and scored with `scoreFile()`.

#### Providers:
| Provider | What it contributes |
|----------|-------------------|
| **VirusTotal** | 90+ AV engine scan results, malicious/total ratio |
| **Hybrid Analysis** | Dynamic sandbox behavioral verdict (malicious/suspicious/clean) |
| **MalwareBazaar (Abuse.ch)** | Known malware hash database lookup |
| **ThreatFox (Abuse.ch)** | IOC/C2 matches for the file hash |
| **Scanii** | Anti-malware content scanning engine with finding codes |

---

### 5. 📧 Email Lookup (`/intel/email`)

Validates an email address across multiple signals:
- **Disify**: Disposable/temporary email domain detection
- **AbstractAPI Email Validation**: Deliverability status, MX record health, DNS validation, free provider flag
- **SMTP format check**: Format validation before any external call
- **Threat scoring** (`scoreEmail`): Disposable → +45 pts, no MX/DNS → +30 pts, invalid format → +40 pts, free provider → +8 pts

---

### 6. 🌐 PhishGuard URL Scanner (`/phishing`)

The most comprehensive tool — runs **10+ providers** in parallel and renders a detailed phishing verdict.

#### How it works:
1. User enters any URL or domain.
2. `api/phishing-intel.ts` extracts the domain and fires all providers concurrently.
3. DNS signals, WHOIS data, threat feeds, and visual screenshot are combined.
4. `scorePhish()` computes a 0–100 risk score with transparent breakdown.
5. The UI displays the screenshot, threat score gauge, DNS records, WHOIS, and per-provider status.

#### Providers:

| Provider | What it contributes |
|----------|-------------------|
| **DNSDumpster** | A, MX, NS, TXT, CNAME records; SPF/DMARC/DKIM presence; hosting provider identification; suspicious/bulletproof nameserver detection |
| **WhoisFreaks** | Domain registration date, expiry date, registrar, registrant info, nameservers |
| **VirusTotal** | Malicious/total URL detection ratio |
| **Google Safe Browsing** | Google's real-time phishing & malware URL database |
| **PhishStats** | PhishStats community phishing URL database match |
| **URLhaus (Abuse.ch)** | Active malware distribution URL database |
| **AlienVault OTX** | OTX threat pulse matches for the domain |
| **ThreatFox (Abuse.ch)** | IOC/malware C2 domain matches |
| **URLscan.io** | Passive DNS, screenshot, page title, IP, country, malicious verdict |
| **Censys** | Exposed ports and services on the domain's host IP |
| **MaxMind GeoIP** | Hosting country, ASN, anonymity traits of the host server |
| **Microlink / s-shot.ru** | Visual website screenshot rendering |

#### Threat Scoring (`scorePhish`):
DNS signals from DNSDumpster:
- No SPF record → **+10 pts**
- No DMARC record → **+12 pts**
- Suspicious / bulletproof nameservers → **+15 pts**

Domain signals:
- Domain age < 30 days → **+25 pts**
- Domain age < 1 year → **+8 pts**
- Punycode / IDN hostname → **+20 pts**
- IP-address hostname (no domain) → **+15 pts**
- Brand impersonation keywords → **+20 pts**
- Redirect chain > 2 hops → **+10 pts**

Threat feed hits:
- VirusTotal malicious > 2 engines → **+20–35 pts**
- Google Safe Browsing hit → **+35 pts**
- PhishStats match → **+30 pts**
- URLhaus listed → **+30 pts**
- OTX pulses > 0 → **+15 pts**
- ThreatFox hits → **+20 pts**

Infrastructure signals:
- Censys: High-risk management ports exposed → **+10–15 pts**

---

### 7. 📧 Email Analyzer (`/email`)

AI-powered phishing email audit using **Groq** with multi-provider fallback.

#### How it works:
1. User pastes the raw email: From, To, Subject, Body.
2. `api/analyze-email.ts` sends structured email content to Groq.
3. Groq (LLM) performs NLP analysis: BEC patterns, urgency tactics, display-name spoofing, gift card / wire transfer / direct deposit scams, credential harvesting links.
4. A structured verdict is returned: risk score, attack type, red flags, key indicators, recommendations.
5. Pre-loaded sample emails (CEO Gift Card, Netflix Billing, HR Payroll, Safe GitHub) allow instant testing.

#### Tabbed Interface:
- **Analyze**: Input form with chips showing word count, link count, CAPS ratio
- **History**: Cloud-synced past email scans with quick re-review
- **About**: Explanations of BEC attack types and detection methodology

---

### 8. 📰 News Analyzer (`/news`)

Detects fake news and misinformation using AI + real-time NewsAPI cross-reference.

#### How it works:
1. User pastes a headline, article, or social media post.
2. `api/analyze-news.ts` builds a search query from the content and calls **NewsAPI** to fetch matching real-world articles.
3. NewsAPI context (total results, publisher list, headlines) is injected into the Groq prompt.
4. **Groq** performs NLP analysis: sentiment, bias, clickbait score, red flags, credibility signals, claim verifiability.
5. A `report_verdict` structured tool call returns the full verdict JSON.
6. If Groq is unavailable, `fallbackNewsAnalysis()` uses heuristic analysis (CAPS ratio, exclamation count, clickbait wordlist) with NewsAPI coverage boosting confidence to 94% if mainstream outlets reported it.

#### Output includes:
- `verdict`: `likely_real` / `uncertain` / `likely_fake`
- `confidence`: 0–100%
- `summary`: AI narrative explanation
- `red_flags`: List of detected manipulation signals
- `credibility_signals`: Positive trust indicators
- `sentiment`: alarmist / opinionated / neutral
- `bias`: sensationalist / subjective / unbiased
- `key_claims`: Array of extracted claims with verifiability rating
- **NewsAPI Live Cross-Reference Card**: Matching articles from global publishers with clickable source links

---

### 9. 🤖 AI Security Assistant (`/chat`)

A conversational AI assistant combining security expertise, live news fetching, and background threat scanning.

#### How it works:

**Two routing modes based on the query:**

**Mode A — Normal Chat** (greetings, questions, news requests, identity questions):
- Routes to `runNormalChat()` → calls Groq directly with the full conversation history
- Supports: cybersecurity Q&A, explaining attack vectors (SQLi, XSS, CSRF, RCE, phishing), news queries, general conversation

**Mode B — Background Investigation** (URLs, IP addresses, emails, files, explicit scan keywords like "scan", "audit", "check"):
- Routes to `runBackgroundInvestigation()` → runs parallel threat scans first, then calls Groq with the telemetry results appended
- Shows a real-time step-by-step scanning UI while investigations run
- Groq then synthesizes the telemetry into an executive-level AI security report

#### Live News in Chat:
- When you ask `"tell me blockchain news"` or `"latest cybersecurity headlines"`, the assistant fetches real-time articles from **NewsAPI** and analyzes each one in its own words — no scanning UX, just a clean AI response.

#### Background Investigation Steps:
1. **Entity Detection** — extracts URLs, IPs, emails, phone numbers, file attachments from your message
2. **Parallel Scans** — fires all relevant APIs simultaneously (PhishGuard, VirusTotal, IP Intel, Email Analysis, News Credibility)
3. **Telemetry Aggregation** — collects all results into a structured JSON context (capped at 2,500 chars to stay within model limits)
4. **Groq AI Synthesis** — sends system prompt + last 4 conversation turns + telemetry to Groq for executive-level reporting
5. **Fallback Report** — if Groq is unavailable, `generateFallbackReport()` produces a formatted markdown security summary

#### Payload Size Protection (anti-413):
- Telemetry JSON truncated to **2,500 chars** max before sending to Groq
- Only last **4 messages** (2 turns) of history sent
- Each message capped at **3,000 chars**
- `max_tokens` set to **1,500** output tokens

#### Groq Models (in priority order):
1. `openai/gpt-oss-120b` *(primary — largest)*
2. `openai/gpt-oss-20b` *(fallback)*
3. `qwen/qwen3.8-27b` *(final fallback)*

#### Intelligent Fallback (`fallbackAssistantReply`):
When all Groq models fail, a deterministic fallback handles:
- Greetings → DefenSight intro
- Identity questions (`"tell me about urself"`, `"who are you"`, `"what is defensight"`) → full capability intro
- News queries → helpful guidance with retry suggestion
- Security topics (SQLi, XSS, phishing, passwords) → curated expert responses
- Generic → friendly retry message (never the old generic boilerplate)

---

### 10. 🔑 Password Lab (`/password`)

100% client-side — no data ever leaves the browser.

- **Entropy Scoring**: Calculates true password entropy based on character class coverage (lowercase, uppercase, digits, symbols), length, and pattern repetition
- **Strength Meter**: Visual gauge (Weak / Fair / Good / Strong / Very Strong)
- **Crack Time Estimates**: Estimated time to crack against:
  - Offline fast hash (bcrypt, MD5)
  - Online unthrottled attack
  - Online rate-limited attack (100/hour)
- **Password Generator**: Customizable length (8–128 chars) and character set toggles

---

### 11. 📄 Reports (`/reports`)

- **PDF Export**: Professional PDF security investigation report using `jsPDF` + `jspdf-autotable`. Includes scan metadata, threat scores, provider verdicts, and recommendations.
- **JSON Export**: Full structured JSON dump of all scan telemetry for integration with SIEMs or custom tooling.

---

### 12. 📜 Scan History (`/history`)

- **Centralized Audit Log**: All scans from all tools are automatically saved (cloud-synced via Firestore when logged in, local otherwise).
- **Filtering**: Filter by tool type (IP, URL, Phone, Email, File, News, Email AI).
- **Re-inspection**: Click any past scan to instantly re-open it in the appropriate tool.
- **Risk Badges**: Color-coded threat level badges (Low / Medium / High) on every history entry.

---

### 13. 👤 Account & Settings (`/settings`)

- **Profile Photo**: Upload, preview, crop, and remove a custom profile avatar. Stored in Firebase Storage and synced across the sidebar, Firestore, and Firebase Auth.
- **Password Change**: Update account password directly in-app with real-time character count and match validation.
- **Forgot Password**: Email reset workflow from the login page or settings. Supports custom redirect URLs for hosted deployments.

---

## 🏗️ Technology Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19 + Vite 7 |
| **Routing** | React Router v7 |
| **Styling** | Tailwind CSS v4 + Radix UI + Lucide Icons |
| **Charts** | Recharts |
| **PDF Export** | jsPDF + jspdf-autotable |
| **Auth & Cloud DB** | Firebase Authentication + Cloud Firestore |
| **API Server** | Node.js Connect middleware (dev) + Vercel Serverless Functions (prod) |
| **AI LLM** | Groq API (`openai/gpt-oss-120b`, `openai/gpt-oss-20b`, `qwen/qwen3.8-27b`) |
| **Real-Time News** | NewsAPI (`newsapi.org`) |
| **Phone Validation** | Veriphone v2 + Numverify + AbstractAPI |
| **IP Geolocation** | MaxMind GeoIP2 / GeoLite2 |
| **DNS Recon** | DNSDumpster |
| **Host Scanning** | Censys Platform API v3 |
| **Threat Feeds** | VirusTotal · AbuseIPDB · AlienVault OTX · ThreatFox · URLhaus · MalwareBazaar · PhishStats · Google Safe Browsing · urlscan.io |
| **Screenshot** | Microlink API + s-shot.ru fallback |
| **File AV** | Scanii + Hybrid Analysis |
| **WHOIS** | WhoisFreaks + WhoisXML |

---

## 📁 Project Structure

```
.
├── api/                              # Vercel Serverless API Functions
│   ├── _lib/                         # Shared utilities
│   │   ├── cors.ts                   # CORS headers & error helpers
│   │   ├── http.ts                   # safeFetch, settleProvider, requireEnv, optionalEnv, ApiError
│   │   ├── threat-score.ts           # Server-side threat score re-exports (shared with src/)
│   │   ├── validators.ts             # Input validation (IP, phone, email, URL)
│   │   └── providers/                # One file per third-party provider
│   │       ├── abstract.ts           # AbstractAPI (IP, Phone, Email)
│   │       ├── abusech.ts            # ThreatFox, MalwareBazaar, URLhaus (Abuse.ch)
│   │       ├── abuseipdb.ts          # AbuseIPDB IP reputation
│   │       ├── censys.ts             # Censys Platform API v3 host asset scanner
│   │       ├── disify.ts             # Disify disposable email detection
│   │       ├── dnsdumpster.ts        # DNSDumpster DNS recon & SPF/DMARC/DKIM analysis
│   │       ├── hybridanalysis.ts     # Hybrid Analysis sandbox scanning
│   │       ├── ipinfo.ts             # IPinfo geolocation & ASN
│   │       ├── maxmind.ts            # MaxMind GeoIP2 / GeoLite2 Web Service
│   │       ├── newsapi.ts            # NewsAPI real-time global news cross-reference
│   │       ├── numverify.ts          # Numverify / APILayer phone validation
│   │       ├── otx.ts                # AlienVault OTX threat pulses
│   │       ├── phishstats.ts         # PhishStats community phishing feed
│   │       ├── safebrowsing.ts       # Google Safe Browsing API
│   │       ├── scanii.ts             # Scanii anti-malware file scanning
│   │       ├── urlscan.ts            # urlscan.io passive DNS & screenshot
│   │       ├── veriphone.ts          # Veriphone v2 phone validation & carrier enrichment
│   │       ├── virustotal.ts         # VirusTotal URL / file / domain scanning
│   │       └── whoisfreaks.ts        # WhoisFreaks WHOIS domain lookup
│   ├── analyze-email.ts              # Groq AI phishing email audit endpoint
│   ├── analyze-news.ts               # Groq AI news analysis + chat assistant endpoint
│   ├── analyze-phishing.ts           # Phishing heuristic evaluation endpoint
│   ├── domain.ts                     # Domain lookup endpoint
│   ├── email.ts                      # Email validation & MX check endpoint
│   ├── file.ts                       # File SHA256, magic bytes & multi-AV endpoint
│   ├── ip.ts                         # IP intelligence & threat scoring endpoint
│   ├── phishing-intel.ts             # PhishGuard full URL correlation endpoint
│   ├── phone.ts                      # Phone intelligence (Veriphone + Numverify + Abstract)
│   └── url.ts                        # URL threat provider endpoint
├── server/
│   └── dev-middleware.ts             # Vite plugin: routes /api/* to api/ handlers in dev
├── src/
│   ├── components/
│   │   ├── AppShell.tsx              # Sidebar navigation, user avatar, route links
│   │   ├── layout/                   # PageHeader, PremiumCard layout containers
│   │   ├── threat/                   # ThreatScorePanel, AdvancedDetailsPanel, ResultActions
│   │   └── ui/                       # shadcn/ui components (Card, Button, Badge, Input, etc.)
│   ├── contexts/
│   │   └── AuthContext.tsx           # Firebase Auth context & protected route guard
│   ├── lib/
│   │   ├── api.ts                    # Frontend API call helpers (typed fetch wrappers)
│   │   ├── firebase.ts               # Firebase app initialization
│   │   ├── firestore.ts              # Firestore CRUD: chat history, scan history, profile
│   │   ├── intel-api.ts              # OSINT tool client wrapper (phishing, ip, phone, file)
│   │   ├── scan-history.ts           # Local + cloud scan history state management
│   │   └── threat-score.ts           # Shared scoring functions: scoreIp, scorePhone, scoreEmail,
│   │                                 # scoreFile, scorePhish, buildThreat, riskFromScore
│   └── pages/
│       ├── Account.tsx               # User profile, avatar upload, password change
│       ├── Chat.tsx                  # AI Security Assistant (normal chat + background investigation)
│       ├── Dashboard.tsx             # Threat Overview Dashboard with global search router
│       ├── EmailAnalyzer.tsx         # AI Phishing Email Analyzer (BEC, wire fraud, credential theft)
│       ├── EmailIntelligence.tsx     # Email validation & disposable domain lookup
│       ├── FileScanner.tsx           # Multi-AV file scanner with SHA256 & magic bytes
│       ├── HistoryPage.tsx           # Scan history viewer with type filters
│       ├── Home.tsx                  # News Misinformation Analyzer + NewsAPI cards
│       ├── IpIntelligence.tsx        # IP geolocation, ASN, threat scoring, source breakdown
│       ├── Login.tsx                 # Firebase Email/Password + Google OAuth sign-in
│       ├── Password.tsx              # Password strength, entropy scoring, generator
│       ├── Phishing.tsx              # PhishGuard URL scanner (DNS, WHOIS, screenshot, feeds)
│       ├── PhoneIntelligence.tsx     # Phone validation + Veriphone/Numverify/Abstract UI
│       ├── Reports.tsx               # PDF & JSON report export manager
│       └── ResetPassword.tsx         # Password reset email flow
├── .env.example                      # All supported environment variable names
├── index.html                        # HTML root with DefenSight metadata & favicon
├── package.json                      # Dependencies & npm scripts
├── tsconfig.json                     # TypeScript compiler configuration
└── vite.config.ts                    # Vite config: SERVER_ENV_KEYS injection + API middleware
```

---

## 🛠️ Local Setup

### Prerequisites
- **Node.js 18+** (or Bun)
- npm / yarn / pnpm

### 1. Clone & Install
```bash
git clone https://github.com/your-repo/defensight.git
cd defensight
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and fill in your API keys:

```bash
cp .env.example .env
```

```env
# ── AI ────────────────────────────────────────────────
GROQ_API_KEY=your_groq_api_key

# ── Threat Intelligence ───────────────────────────────
VIRUSTOTAL_API_KEY=your_virustotal_key
ABUSEIPDB_API_KEY=your_abuseipdb_key
ALIENVAULT_OTX_API_KEY=your_otx_key
GOOGLE_SAFE_BROWSING_API_KEY=your_safe_browsing_key
ABUSE_CH_API_KEY=your_abusech_key
HYBRID_ANALYSIS_API_KEY=your_hybrid_analysis_key

# ── Geolocation & Host Intel ──────────────────────────
MAXMIND_ACCOUNT_ID=your_maxmind_account_id
MAXMIND_LICENSE_KEY=your_maxmind_license_key
CENSYS_API_KEY=your_censys_pat
IPINFO_TOKEN=your_ipinfo_token

# ── DNS & WHOIS ───────────────────────────────────────
DNSDUMPSTER_API_KEY=your_dnsdumpster_key
WHOISFREAKS_API_KEY=your_whoisfreaks_key
WHOISXML_API_KEY=your_whoisxml_key

# ── URL Scanning ──────────────────────────────────────
URLSCAN_API_KEY=your_urlscan_key
PHISHSTATS_API_KEY=your_phishstats_key

# ── Phone Intelligence ────────────────────────────────
VERIPHONE_API_KEY=your_veriphone_key
NUMVERIFY_API_KEY=your_numverify_key
ABSTRACT_PHONE_API_KEY=your_abstract_key
ABSTRACT_IP_API_KEY=your_abstract_key
ABSTRACT_EMAIL_API_KEY=your_abstract_key

# ── Email Validation ──────────────────────────────────
DISIFY_API_KEY=your_disify_key

# ── File Scanning ─────────────────────────────────────
SCANII_API_KEY=your_scanii_key
SCANII_API_SECRET=your_scanii_secret

# ── News ──────────────────────────────────────────────
NEWSAPI_API_KEY=your_newsapi_key

# ── Misc ──────────────────────────────────────────────
RAPIDAPI_KEY=your_rapidapi_key
```

> **Note**: All API keys are optional. DefenSight never crashes when keys are missing — it transparently falls back to local heuristic engines. Missing provider errors show as `"Provider unconfigured (using local intelligence)"`.

### 3. Start Development Server
```bash
npm run dev
```
Open `http://localhost:5173` in your browser.

### 4. Build for Production
```bash
npm run build
```
Output in `dist/`. Deploy to Vercel, Netlify, or any static+serverless host.

---

## 🔌 API Endpoints Reference

All endpoints are located in `api/` and run as Vercel Serverless Functions or via the local Vite dev middleware.

| Endpoint | Method | Body | Description |
|----------|--------|------|-------------|
| `POST /api/ip` | POST | `{ ip }` | IP intelligence — geolocation, ASN, threat feeds |
| `POST /api/phone` | POST | `{ phone, country? }` | Phone validation — Veriphone + Numverify + Abstract |
| `POST /api/email` | POST | `{ email }` | Email validation — MX, disposable, deliverability |
| `POST /api/file` | POST | `{ filename, contentBase64, contentType }` | File AV scan — SHA256, VirusTotal, Hybrid Analysis, Scanii |
| `POST /api/phishing-intel` | POST | `{ url }` | PhishGuard — DNS recon, 10+ threat feeds, WHOIS |
| `POST /api/analyze-email` | POST | `{ from, to, subject, body }` | Groq AI phishing email audit |
| `POST /api/analyze-news` | POST | `{ content, source? }` | Fake-news detection — Groq + NewsAPI |
| `POST /api/analyze-news` | POST | `{ messages: [...] }` | AI Assistant chat — Groq conversational mode |
| `POST /api/analyze-phishing` | POST | `{ url }` | Lightweight URL heuristic scan |
| `POST /api/domain` | POST | `{ domain }` | Domain lookup |
| `POST /api/url` | POST | `{ url }` | URL threat scan |

---

## 🛡️ Fail-Safe Architecture

DefenSight is built on a **zero-crash reliability** principle:

- **`settleProvider(name, fn)`** — wraps every provider call. Never throws. Returns `{ ok: true, data }` or `{ ok: false, error: "..." }`.
- **`optionalEnv(name)`** — returns `undefined` if the key is missing (never throws).
- **`requireEnv(name)`** — throws an `ApiError` (caught by the handler) only when a key is truly required.
- **Error rewriting** — errors containing "API key", "401", "403", or "Server missing" are rewritten to `"Provider unconfigured (using local intelligence)"` for clean UX.
- **Local fallbacks** — every analyzer has a deterministic fallback (heuristic scoring, NLP pattern matching, static DNS lookup) that activates when all live providers fail.

---

## 🔑 Environment Variable Quick Reference

| Variable | Provider | Used In |
|----------|----------|---------|
| `GROQ_API_KEY` | Groq | AI Assistant, News Analyzer, Email Analyzer |
| `VIRUSTOTAL_API_KEY` | VirusTotal | IP Intel, PhishGuard, File Scanner |
| `ABUSEIPDB_API_KEY` | AbuseIPDB | IP Intelligence |
| `ALIENVAULT_OTX_API_KEY` | AlienVault OTX | IP Intel, PhishGuard |
| `GOOGLE_SAFE_BROWSING_API_KEY` | Google | PhishGuard |
| `ABUSE_CH_API_KEY` | Abuse.ch | IP Intel, File Scanner, PhishGuard |
| `HYBRID_ANALYSIS_API_KEY` | Hybrid Analysis | File Scanner |
| `MAXMIND_ACCOUNT_ID` + `MAXMIND_LICENSE_KEY` | MaxMind | IP Intel, PhishGuard |
| `CENSYS_API_KEY` | Censys | IP Intel, PhishGuard |
| `IPINFO_TOKEN` | IPinfo | IP Intelligence |
| `DNSDUMPSTER_API_KEY` | DNSDumpster | PhishGuard |
| `WHOISFREAKS_API_KEY` | WhoisFreaks | PhishGuard |
| `WHOISXML_API_KEY` | WhoisXML | PhishGuard |
| `URLSCAN_API_KEY` | urlscan.io | PhishGuard |
| `PHISHSTATS_API_KEY` | PhishStats | PhishGuard |
| `VERIPHONE_API_KEY` | Veriphone | Phone Intelligence |
| `NUMVERIFY_API_KEY` | Numverify | Phone Intelligence |
| `ABSTRACT_PHONE_API_KEY` | AbstractAPI | Phone Intelligence |
| `ABSTRACT_IP_API_KEY` | AbstractAPI | IP Intelligence |
| `ABSTRACT_EMAIL_API_KEY` | AbstractAPI | Email Lookup |
| `DISIFY_API_KEY` | Disify | Email Lookup |
| `SCANII_API_KEY` + `SCANII_API_SECRET` | Scanii | File Scanner |
| `NEWSAPI_API_KEY` | NewsAPI | News Analyzer, AI Assistant |
| `RAPIDAPI_KEY` | RapidAPI | Numverify fallback |

---

## 📝 License

MIT License — free to use, modify, and distribute.
