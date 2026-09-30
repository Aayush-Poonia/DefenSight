import { useAuth } from "@/contexts/AuthContext";
import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { analyzeNewsArticle, analyzeNewsAssistantChat, analyzeEmailContent } from "@/lib/api";
import { intelApi } from "@/lib/intel-api";
import { addScan } from "@/lib/scan-history";
import { riskFromScore } from "@/lib/threat-score";
import { saveChatMessage, getChatHistory, clearChatHistory } from "@/lib/firestore";
import {
  Loader2, Send, Trash2, Bot, User, MessageSquare, Paperclip, FileText,
  X, CheckCircle2, ShieldAlert, ShieldCheck, ShieldX, Link2, Mail, Globe,
  Phone, Sparkles, Copy, FileSearch, ChevronDown, ChevronUp, Upload, AlertTriangle, Search, Zap
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { PageHeader } from "@/components/layout/PageHeader";

type InvestigationStep = {
  id: string;
  label: string;
  status: "pending" | "running" | "completed" | "error";
  detail?: string;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachedFile?: { name: string; size: number; type: string };
  isInvestigating?: boolean;
  steps?: InvestigationStep[];
  telemetrySummary?: {
    scannedEntities: string[];
    maxThreatScore?: number;
    riskLevel?: string;
  };
  rawTelemetry?: Record<string, unknown>;
  timestamp?: string;
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function fileToText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read file text"));
    reader.readAsText(file);
  });
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function extractEntities(text: string, file?: File | null) {
  const urlRegex = /https?:\/\/[^\s<>"')]+/gi;
  const urls = Array.from(new Set(text.match(urlRegex) || []));

  const ipRegex = /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g;
  const ips = Array.from(new Set(text.match(ipRegex) || [])).filter(
    (ip) => ip !== "127.0.0.1" && ip !== "0.0.0.0"
  );

  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
  const emails = Array.from(new Set(text.match(emailRegex) || []));

  const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
  const phones = Array.from(new Set(text.match(phoneRegex) || []));

  const lower = text.toLowerCase();
  const isEmailContent =
    emails.length > 0 ||
    /from:|to:|subject:|reply-to:|dear |regards,|sincerely,|gift card|direct deposit|account suspended|verify account|wire transfer/i.test(
      text
    );

  const isNewsRequest = /analyze news|fake news|fact check|check article|verify news/i.test(lower);

  return {
    urls,
    ips,
    emails,
    isEmailContent,
    phones,
    isNewsRequest,
    hasFile: !!file,
  };
}

function shouldPerformScan(text: string, file: File | null): boolean {
  if (file) return true;

  const lower = text.toLowerCase().trim();
  const scanKeywords = /\b(scan|investigate|check|audit|analyze|inspect|verify|test|detail|details|is this safe|is it safe|phishguard|virustotal|scanii|threat level|phishing check|malware check|fake news|news check)\b/i;
  if (scanKeywords.test(lower)) return true;

  const isOnlyUrl = /^https?:\/\/[^\s]+$/i.test(lower);
  const isOnlyIp = /^\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b$/i.test(lower);
  if (isOnlyUrl || isOnlyIp) return true;

  return false;
}

function formatTimestamp(raw: any): string {
  if (!raw) {
    return new Date().toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  let date: Date;
  if (typeof raw === "object" && typeof raw.toDate === "function") {
    date = raw.toDate();
  } else if (typeof raw === "object" && typeof raw.seconds === "number") {
    date = new Date(raw.seconds * 1000);
  } else if (typeof raw === "number") {
    date = new Date(raw);
  } else if (typeof raw === "string") {
    date = new Date(raw);
  } else if (raw instanceof Date) {
    date = raw;
  } else {
    date = new Date();
  }

  if (isNaN(date.getTime())) {
    date = new Date();
  }

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function Chat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [expandedTelemetry, setExpandedTelemetry] = useState<Record<string, boolean>>({});
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    getChatHistory(user.uid)
      .then((docs) => {
        if (docs.length > 0) {
          setMessages(
            docs.map((d, idx) => ({
              id: d.id || `msg-${idx}`,
              role: d.role as "user" | "assistant",
              content: d.content as string,
              timestamp: formatTimestamp(d.createdAt),
            }))
          );
        }
      })
      .catch(() => {
        toast.error("Could not load chat history from cloud.");
      });
  }, [user]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File size limit is 5MB for background scanning.");
        return;
      }
      setAttachedFile(file);
      toast.success(`Attached ${file.name} (Background Scan Mode Enabled)`);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File size limit is 5MB for background scanning.");
        return;
      }
      setAttachedFile(file);
      toast.success(`Attached ${file.name}`);
    }
  };

  const sendMessage = async (overridePrompt?: string, overrideFile?: File) => {
    const textToSend = (overridePrompt ?? input).trim();
    const fileToSend = overrideFile ?? attachedFile;

    if (!textToSend && !fileToSend) return;
    if (!user) return;

    setInput("");
    setAttachedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";

    const timestampStr = formatTimestamp(new Date());
    const userMsgId = crypto.randomUUID();
    const assistantMsgId = crypto.randomUUID();

    const userMessageObj: Message = {
      id: userMsgId,
      role: "user",
      content: textToSend || (fileToSend ? `[Attached file for investigation: ${fileToSend.name}]` : ""),
      attachedFile: fileToSend
        ? { name: fileToSend.name, size: fileToSend.size, type: fileToSend.type || "application/octet-stream" }
        : undefined,
      timestamp: timestampStr,
    };

    const isScanRequest = shouldPerformScan(textToSend, fileToSend);

    const assistantPlaceholderObj: Message = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      isInvestigating: isScanRequest,
      steps: isScanRequest
        ? [
            { id: "entities", label: "Parsing query & extracted targets", status: "running" },
            { id: "scans", label: "Executing background threat feeds (VirusTotal, PhishGuard, Scanii, etc.)", status: "pending" },
            { id: "telemetry", label: "Aggregating threat scores & indicators", status: "pending" },
            { id: "ai", label: "Synthesizing AI threat report with Groq AI", status: "pending" },
          ]
        : undefined,
      timestamp: timestampStr,
    };

    const currentHistory = [...messages, userMessageObj];
    setMessages((prev) => [...prev, userMessageObj, assistantPlaceholderObj]);
    setLoading(true);

    try {
      await saveChatMessage(user.uid, "user", userMessageObj.content);
    } catch {}

    if (isScanRequest) {
      await runBackgroundInvestigation(textToSend, fileToSend, assistantMsgId, currentHistory);
    } else {
      await runNormalChat(textToSend, assistantMsgId, currentHistory);
    }

    setLoading(false);
  };

  const runNormalChat = async (text: string, assistantMsgId: string, historyForGroq: Message[]) => {
    const updateAssistantMsg = (updater: (msg: Message) => Message) => {
      setMessages((prev) => prev.map((m) => (m.id === assistantMsgId ? updater(m) : m)));
    };

    const validHistory = historyForGroq
      .filter((m) => typeof m.content === "string" && m.content.trim().length > 0)
      .map((m) => ({ role: m.role, content: m.content.trim() }));

    let replyText = "";

    try {
      if (validHistory.length > 0) {
        const raw = await analyzeNewsAssistantChat({ messages: validHistory });
        replyText = typeof raw?.reply === "string" ? raw.reply.trim() : "";
      }
    } catch (err) {
      console.warn("[normal chat groq error]", err);
    }

    if (!replyText) {
      replyText = getCyberResponse(text);
    }

    updateAssistantMsg((msg) => ({
      ...msg,
      content: replyText,
      isInvestigating: false,
    }));

    if (user) {
      try {
        await saveChatMessage(user.uid, "assistant", replyText);
      } catch {}
    }
  };

  const runBackgroundInvestigation = async (
    text: string,
    file: File | null,
    assistantMsgId: string,
    historyForGroq: Message[]
  ) => {
    const updateAssistantMsg = (updater: (msg: Message) => Message) => {
      setMessages((prev) => prev.map((m) => (m.id === assistantMsgId ? updater(m) : m)));
    };

    const updateStep = (stepId: string, status: InvestigationStep["status"], detail?: string) => {
      updateAssistantMsg((msg) => {
        const steps = (msg.steps || []).map((s) => (s.id === stepId ? { ...s, status, detail } : s));
        return { ...msg, steps };
      });
    };

    const entities = extractEntities(text, file);
    const scannedEntitiesList: string[] = [];

    if (file) scannedEntitiesList.push(`Attached File (${file.name})`);
    if (entities.urls.length > 0) scannedEntitiesList.push(`${entities.urls.length} URL(s)`);
    if (entities.emails.length > 0 || entities.isEmailContent) scannedEntitiesList.push("Email Header/Content");
    if (entities.ips.length > 0) scannedEntitiesList.push(`${entities.ips.length} IP Address(es)`);
    if (entities.phones.length > 0) scannedEntitiesList.push(`${entities.phones.length} Phone Number(s)`);
    if (entities.isNewsRequest) scannedEntitiesList.push("News Credibility Analysis");

    updateStep(
      "entities",
      "completed",
      scannedEntitiesList.length > 0 ? scannedEntitiesList.join(" Â· ") : "Security Target Investigation"
    );

    updateStep("scans", "running");

    const telemetryData: Record<string, unknown> = {
      user_prompt: text,
      timestamp: new Date().toISOString(),
      entities_detected: scannedEntitiesList,
    };

    let maxThreatScore = 0;
    const scanPromises: Promise<void>[] = [];

    // 1. URL Phishing Intel
    if (entities.urls.length > 0) {
      for (const url of entities.urls.slice(0, 3)) {
        scanPromises.push(
          intelApi
            .phishingIntel(url)
            .then((r) => {
              telemetryData[`url_scan_${url}`] = r;
              if (r.threat_score > maxThreatScore) maxThreatScore = r.threat_score;
              addScan({
                type: "phishing",
                input: url,
                result: r as unknown as Record<string, unknown>,
                threat_score: r.threat_score,
                risk_level: r.risk_level,
              });
            })
            .catch((e) => {
              telemetryData[`url_scan_error_${url}`] = e?.message || "URL scan failed";
            })
        );
      }
    }

    // 2. File Scanning
    if (file) {
      scanPromises.push(
        (async () => {
          try {
            const contentBase64 = await fileToBase64(file);
            const r = await intelApi.file({
              filename: file.name,
              contentBase64,
              contentType: file.type || "application/octet-stream",
            });
            telemetryData[`file_scan_${file.name}`] = r;
            if (r.threat_score > maxThreatScore) maxThreatScore = r.threat_score;

            if (
              file.size < 100 * 1024 &&
              (file.type.startsWith("text/") ||
                file.name.endsWith(".txt") ||
                file.name.endsWith(".log") ||
                file.name.endsWith(".json"))
            ) {
              const textContent = await fileToText(file);
              telemetryData[`file_text_snippet`] = textContent.slice(0, 4000);
            }

            addScan({
              type: "file",
              input: file.name,
              result: r as unknown as Record<string, unknown>,
              threat_score: r.threat_score,
              risk_level: r.risk_level,
            });
          } catch (e: any) {
            telemetryData[`file_scan_error`] = e?.message || "File scan error";
          }
        })()
      );
    }

    // 3. Email Phishing & Header Audit
    if (entities.isEmailContent && text.length >= 20) {
      scanPromises.push(
        analyzeEmailContent({
          body: text,
          from: entities.emails[0] || "",
          subject: "Background AI Assistant Investigation",
        })
          .then((r: any) => {
            telemetryData["email_analysis"] = r;
            if (r.risk_score && r.risk_score > maxThreatScore) maxThreatScore = r.risk_score;
            addScan({
              type: "email_ai",
              input: text.slice(0, 60),
              result: r,
              threat_score: r.risk_score || 0,
              risk_level: riskFromScore(r.risk_score || 0),
            });
          })
          .catch((e) => {
            telemetryData["email_analysis_error"] = e?.message || "Email analysis failed";
          })
      );
    }

    // 4. IP Intelligence
    if (entities.ips.length > 0) {
      const topIp = entities.ips[0];
      scanPromises.push(
        intelApi
          .ip(topIp)
          .then((r) => {
            telemetryData[`ip_intel_${topIp}`] = r;
            if (r.threat_score > maxThreatScore) maxThreatScore = r.threat_score;
            addScan({
              type: "ip",
              input: topIp,
              result: r as unknown as Record<string, unknown>,
              threat_score: r.threat_score,
              risk_level: r.risk_level,
            });
          })
          .catch((e) => {
            telemetryData[`ip_intel_error`] = e?.message || "IP lookup failed";
          })
      );
    }

    // 5. Phone Intelligence
    if (entities.phones.length > 0) {
      const topPhone = entities.phones[0];
      scanPromises.push(
        intelApi
          .phone(topPhone)
          .then((r) => {
            telemetryData[`phone_intel_${topPhone}`] = r;
            if (r.threat_score > maxThreatScore) maxThreatScore = r.threat_score;
          })
          .catch((e) => {
            telemetryData[`phone_intel_error`] = e?.message || "Phone lookup failed";
          })
      );
    }

    // 6. News Credibility
    if (entities.isNewsRequest && text.length >= 20) {
      scanPromises.push(
        analyzeNewsArticle({ content: text })
          .then((r) => {
            telemetryData["news_credibility"] = r;
          })
          .catch((e) => {
            telemetryData["news_error"] = e?.message || "News analysis failed";
          })
      );
    }

    await Promise.allSettled(scanPromises);

    updateStep("scans", "completed", `${scanPromises.length} background feed(s) executed`);
    updateStep("telemetry", "running");

    const computedRiskLevel = riskFromScore(maxThreatScore);
    updateStep("telemetry", "completed", `Max Risk Score: ${maxThreatScore}/100 (${computedRiskLevel})`);

    updateStep("ai", "running");

    const groqHistory = historyForGroq.map((m) => {
      if (m.id === historyForGroq[historyForGroq.length - 1].id && Object.keys(telemetryData).length > 3) {
        return {
          role: m.role,
          content: `${m.content}\n\n[BACKGROUND THREAT TELEMETRY & SCAN RESULTS]:\n${JSON.stringify(telemetryData, null, 2)}`,
        };
      }
      return { role: m.role, content: m.content };
    });

    let finalAiReply = "";

    try {
      const raw = await analyzeNewsAssistantChat({ messages: groqHistory });
      finalAiReply = typeof raw?.reply === "string" ? raw.reply.trim() : "";
    } catch (err) {
      console.error("[chat background investigation groq error]", err);
    }

    if (!finalAiReply) {
      finalAiReply = generateFallbackReport(text, file, entities, telemetryData, maxThreatScore, computedRiskLevel);
    }

    updateStep("ai", "completed");

    updateAssistantMsg((msg) => ({
      ...msg,
      content: finalAiReply,
      isInvestigating: false,
      telemetrySummary: {
        scannedEntities: scannedEntitiesList,
        maxThreatScore,
        riskLevel: computedRiskLevel,
      },
      rawTelemetry: telemetryData,
    }));

    if (user) {
      try {
        await saveChatMessage(user.uid, "assistant", finalAiReply);
      } catch {}
    }
    toast.success("Background threat investigation complete");
  };

  const handleClear = async () => {
    if (!user) return;
    await clearChatHistory(user.uid);
    setMessages([]);
    toast.success("Chat history cleared");
  };

  const toggleTelemetry = (msgId: string) => {
    setExpandedTelemetry((prev) => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] max-w-5xl mx-auto gap-0">
      <Toaster richColors position="top-center" />

      {/* Chat Header */}
      <div className="flex items-center justify-between px-5 py-3.5 rounded-t-2xl border border-b-0 border-border/60 bg-card/80 backdrop-blur-sm shadow-sm">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="h-10 w-10 rounded-xl overflow-hidden ring-2 ring-accent/30 shadow-md">
              <img src="/logo.png" alt="DefenSight AI" className="h-full w-full object-cover" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-card ring-1 ring-emerald-500/30" />
          </div>
          <div>
            <div className="font-bold text-sm tracking-tight text-foreground">DefenSight AI</div>
            <div className="flex items-center gap-1.5 text-[10px] text-emerald-500 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
              Online • Groq AI Engine
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent/10 border border-accent/20 text-[10px] font-mono text-accent">
            <Sparkles className="h-3 w-3" />
            Auto-detect threats
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClear}
            className="gap-1.5 h-8 text-xs hover:text-destructive hover:bg-destructive/5 border-border/60"
          >
            <Trash2 className="h-3.5 w-3.5" /> Clear
          </Button>
        </div>
      </div>

      {/* Messages Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex-1 flex flex-col overflow-hidden border border-y-0 border-border/60 bg-card/40 backdrop-blur-sm relative min-h-0 transition-all ${
          isDragging ? "ring-2 ring-inset ring-accent border-accent/60 bg-accent/5" : ""
        }`}
      >
        {isDragging && (
          <div className="absolute inset-0 z-50 bg-background/90 backdrop-blur-md flex flex-col items-center justify-center border-2 border-dashed border-accent rounded-none animate-in fade-in duration-200">
            <Upload className="h-12 w-12 text-accent mb-3 animate-bounce" />
            <h3 className="text-base font-bold">Drop File for AI Threat Scan</h3>
            <p className="text-xs text-muted-foreground mt-1">VirusTotal • Scanii • Hybrid Analysis • Threat Feeds</p>
          </div>
        )}

        <ScrollArea className="flex-1 px-5 py-4">
          {/* Empty State */}
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center min-h-[420px] text-center max-w-lg mx-auto">
              <div className="relative mb-5">
                <div className="h-20 w-20 rounded-2xl overflow-hidden ring-2 ring-accent/20 shadow-xl mx-auto">
                  <img src="/logo.png" alt="DefenSight" className="h-full w-full object-cover" />
                </div>
                <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-accent/20 border border-accent/30 grid place-items-center">
                  <Sparkles className="h-3 w-3 text-accent" />
                </div>
              </div>
              <h2 className="font-bold text-xl tracking-tight" style={{ fontFamily: "Georgia, serif" }}>
                DefenSight AI Assistant
              </h2>
              <p className="text-xs text-muted-foreground mt-2.5 leading-relaxed max-w-sm">
                Chat freely about any cybersecurity topic, or ask me to scan a URL, file, email, or IP address for threats.
              </p>

              {/* Quick Prompts */}
              <div className="mt-7 grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full text-left">
                {[
                  {
                    icon: MessageSquare,
                    label: "Explain a concept",
                    prompt: "How does SQL Injection work and what are modern ways to prevent it?",
                    color: "text-blue-400",
                  },
                  {
                    icon: Search,
                    label: "Scan suspicious URL",
                    prompt: "Scan this URL: https://secure-login-account-update.info",
                    color: "text-accent",
                  },
                  {
                    icon: Mail,
                    label: "Audit phishing email",
                    prompt: "Check this email: From: CEO <exec-desk@gmail.com>\nSubject: URGENT purchase 5 gift cards now.",
                    color: "text-orange-400",
                  },
                  {
                    icon: Zap,
                    label: "Security best practices",
                    prompt: "What are best practices for securing API keys in production?",
                    color: "text-yellow-400",
                  },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => setInput(item.prompt)}
                    className="p-3.5 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/60 hover:border-accent/40 text-left transition-all group flex items-start gap-3"
                  >
                    <div className={`h-7 w-7 rounded-lg bg-muted/50 grid place-items-center shrink-0 mt-0.5 group-hover:bg-muted/80 transition-colors ${item.color}`}>
                      <item.icon className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <div className="font-semibold text-[12px] text-foreground group-hover:text-accent transition-colors">{item.label}</div>
                      <div className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5 font-mono leading-relaxed">{item.prompt}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message List */}
          <div className="space-y-6">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-3 items-end ${msg.role === "user" ? "justify-end" : "justify-start"}`}>

                {/* AI Avatar */}
                {msg.role === "assistant" && (
                  <div className="h-8 w-8 rounded-xl overflow-hidden ring-1 ring-accent/20 shrink-0 shadow-sm mb-0.5">
                    <img src="/logo.png" alt="AI" className="h-full w-full object-cover" />
                  </div>
                )}

                <div className={`max-w-[82%] sm:max-w-[76%] flex flex-col gap-1.5 ${msg.role === "user" ? "items-end" : "items-start"}`}>

                  {/* Attached File Pill */}
                  {msg.attachedFile && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/60 border border-border/60 text-[11px] font-mono text-muted-foreground">
                      <FileText className="h-3.5 w-3.5 text-accent shrink-0" />
                      <span className="font-semibold text-foreground">{msg.attachedFile.name}</span>
                      <span>({formatBytes(msg.attachedFile.size)})</span>
                    </div>
                  )}

                  {/* Bubble */}
                  <div
                    className={`rounded-2xl px-4 py-3 text-[13px] leading-relaxed shadow-sm ${
                      msg.role === "user"
                        ? "bg-accent text-accent-foreground rounded-br-sm"
                        : "bg-card border border-border/60 text-foreground rounded-bl-sm"
                    }`}
                  >
                    {/* Investigation Tracker */}
                    {msg.isInvestigating && (
                      <div className="space-y-3 py-0.5">
                        <div className="flex items-center gap-2 font-semibold text-accent text-xs">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Background Threat Investigation in Progress...</span>
                        </div>
                        <div className="space-y-1.5 border-l-2 border-accent/30 pl-3 mt-1.5 text-[11px]">
                          {msg.steps?.map((step) => (
                            <div key={step.id} className="flex items-start gap-2">
                              {step.status === "completed" && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />}
                              {step.status === "running" && <Loader2 className="h-3.5 w-3.5 text-accent animate-spin shrink-0 mt-0.5" />}
                              {step.status === "pending" && <div className="h-3.5 w-3.5 rounded-full border border-muted-foreground/40 shrink-0 mt-0.5" />}
                              {step.status === "error" && <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />}
                              <div>
                                <div className={`font-medium ${
                                  step.status === "running" ? "text-foreground font-semibold"
                                  : step.status === "completed" ? "text-muted-foreground"
                                  : "text-muted-foreground/60"
                                }`}>{step.label}</div>
                                {step.detail && <div className="text-[10px] font-mono text-accent/80 mt-0.5">{step.detail}</div>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Telemetry Summary Header */}
                    {!msg.isInvestigating && msg.telemetrySummary && (
                      <div className="mb-3 p-2.5 rounded-xl bg-background/60 border border-border/60 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge variant="outline" className="bg-accent/10 text-accent border-accent/30 text-[10px]">
                            Scan Completed
                          </Badge>
                          {msg.telemetrySummary.scannedEntities.map((ent, idx) => (
                            <Badge key={idx} variant="secondary" className="text-[10px] font-mono">{ent}</Badge>
                          ))}
                        </div>
                        {msg.telemetrySummary.maxThreatScore !== undefined && (
                          <div className="flex items-center gap-1.5 text-[11px] font-mono font-semibold">
                            <span className="text-muted-foreground">Risk:</span>
                            <span className={
                              (msg.telemetrySummary.maxThreatScore || 0) >= 70 ? "text-destructive"
                              : (msg.telemetrySummary.maxThreatScore || 0) >= 30 ? "text-orange-400"
                              : "text-emerald-500"
                            }>
                              {msg.telemetrySummary.maxThreatScore}/100 • {msg.telemetrySummary.riskLevel}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Message Content */}
                    {msg.role === "assistant" ? (
                      <div className="w-full min-w-0">
                        {msg.content ? (
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              // Headings
                              h1: ({ children }) => (
                                <h1 className="text-base font-bold text-foreground mt-4 mb-2 pb-1 border-b border-border/50 first:mt-0">{children}</h1>
                              ),
                              h2: ({ children }) => (
                                <h2 className="text-sm font-bold text-foreground mt-4 mb-2 first:mt-0">{children}</h2>
                              ),
                              h3: ({ children }) => (
                                <h3 className="text-[13px] font-semibold text-foreground mt-3 mb-1.5 first:mt-0">{children}</h3>
                              ),
                              h4: ({ children }) => (
                                <h4 className="text-[13px] font-semibold text-muted-foreground mt-2 mb-1 first:mt-0">{children}</h4>
                              ),
                              // Paragraphs — key fix: proper spacing so lines don't merge
                              p: ({ children }) => (
                                <p className="text-[13px] leading-relaxed text-foreground mb-3 last:mb-0 whitespace-pre-line">{children}</p>
                              ),
                              // Unordered lists
                              ul: ({ children }) => (
                                <ul className="my-2 ml-4 space-y-1 list-none">{children}</ul>
                              ),
                              // Ordered lists
                              ol: ({ children }) => (
                                <ol className="my-2 ml-4 space-y-1 list-none counter-reset-[item]">{children}</ol>
                              ),
                              // List items with custom bullet
                              li: ({ children }) => (
                                <li className="flex items-start gap-2 text-[13px] leading-relaxed text-foreground">
                                  <span className="mt-[5px] h-1.5 w-1.5 rounded-full bg-accent shrink-0 flex-none" />
                                  <span className="flex-1 min-w-0">{children}</span>
                                </li>
                              ),
                              // Inline code
                              code: ({ inline, children, ...props }: { inline?: boolean; children?: React.ReactNode }) =>
                                inline ? (
                                  <code className="px-1.5 py-0.5 rounded-md bg-muted/80 border border-border/60 text-[11px] font-mono text-accent">
                                    {children}
                                  </code>
                                ) : (
                                  <code className="block w-full overflow-x-auto text-[11px] font-mono text-emerald-400 leading-relaxed" {...props}>
                                    {children}
                                  </code>
                                ),
                              // Code block wrapper
                              pre: ({ children }) => (
                                <pre className="my-3 p-3 rounded-xl bg-black/50 border border-border/60 overflow-x-auto text-[11px] font-mono leading-relaxed">
                                  {children}
                                </pre>
                              ),
                              // Blockquote
                              blockquote: ({ children }) => (
                                <blockquote className="my-3 pl-3 border-l-2 border-accent/50 text-muted-foreground italic text-[12px]">
                                  {children}
                                </blockquote>
                              ),
                              // Bold
                              strong: ({ children }) => (
                                <strong className="font-bold text-foreground">{children}</strong>
                              ),
                              // Italic
                              em: ({ children }) => (
                                <em className="italic text-muted-foreground">{children}</em>
                              ),
                              // Horizontal rule
                              hr: () => (
                                <hr className="my-4 border-border/50" />
                              ),
                              // Links
                              a: ({ href, children }) => (
                                <a
                                  href={href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-accent underline underline-offset-2 hover:text-accent/80 transition-colors break-all"
                                >
                                  {children}
                                </a>
                              ),
                              // Tables
                              table: ({ children }) => (
                                <div className="my-3 overflow-x-auto rounded-xl border border-border/60">
                                  <table className="w-full text-[12px] border-collapse">{children}</table>
                                </div>
                              ),
                              thead: ({ children }) => (
                                <thead className="bg-muted/60 text-foreground font-semibold">{children}</thead>
                              ),
                              tbody: ({ children }) => (
                                <tbody className="divide-y divide-border/40">{children}</tbody>
                              ),
                              tr: ({ children }) => (
                                <tr className="hover:bg-muted/30 transition-colors">{children}</tr>
                              ),
                              th: ({ children }) => (
                                <th className="px-3 py-2 text-left font-semibold border-b border-border/60">{children}</th>
                              ),
                              td: ({ children }) => (
                                <td className="px-3 py-2 text-muted-foreground">{children}</td>
                              ),
                            }}
                          >
                            {msg.content}
                          </ReactMarkdown>
                        ) : (
                          loading && !msg.isInvestigating && (
                            <div className="flex items-center gap-2 text-muted-foreground text-xs">
                              <span className="flex gap-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-accent/70 animate-bounce [animation-delay:0ms]" />
                                <span className="h-1.5 w-1.5 rounded-full bg-accent/70 animate-bounce [animation-delay:120ms]" />
                                <span className="h-1.5 w-1.5 rounded-full bg-accent/70 animate-bounce [animation-delay:240ms]" />
                              </span>
                            </div>
                          )
                        )}
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap text-[13px] leading-relaxed">{msg.content}</p>
                    )}
                  </div>

                  {/* Footer: timestamp + actions */}
                  {msg.role === "assistant" && !msg.isInvestigating && msg.content && (
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-mono px-1">
                      <span>{msg.timestamp || ""}</span>
                      <button
                        onClick={() => copyToClipboard(msg.content)}
                        className="hover:text-foreground inline-flex items-center gap-1 transition-colors"
                      >
                        <Copy className="h-3 w-3" /> Copy
                      </button>
                      {msg.rawTelemetry && (
                        <button
                          onClick={() => toggleTelemetry(msg.id)}
                          className="hover:text-accent inline-flex items-center gap-1 text-accent font-semibold transition-colors"
                        >
                          {expandedTelemetry[msg.id] ? (
                            <><ChevronUp className="h-3 w-3" /> Hide Telemetry</>
                          ) : (
                            <><ChevronDown className="h-3 w-3" /> Raw Telemetry</>
                          )}
                        </button>
                      )}
                    </div>
                  )}
                  {msg.role === "user" && msg.timestamp && (
                    <span className="text-[10px] text-muted-foreground font-mono px-1">{msg.timestamp}</span>
                  )}

                  {/* Collapsible Telemetry */}
                  {expandedTelemetry[msg.id] && msg.rawTelemetry && (
                    <div className="w-full mt-1 p-3 rounded-xl bg-black/50 border border-border/60 text-[10px] font-mono text-emerald-400 overflow-x-auto max-h-60">
                      <pre>{JSON.stringify(msg.rawTelemetry, null, 2)}</pre>
                    </div>
                  )}
                </div>

                {/* User Avatar */}
                {msg.role === "user" && (
                  <div className="h-8 w-8 rounded-xl bg-accent/20 text-accent border border-accent/30 grid place-items-center shrink-0 shadow-sm mb-0.5">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            ))}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>
      </div>

      {/* Input Area */}
      <div className="border border-t-0 border-border/60 rounded-b-2xl bg-card/80 backdrop-blur-sm px-4 py-3 space-y-2.5 shadow-sm">
        {/* Attached File Chip */}
        {attachedFile && (
          <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-accent/10 border border-accent/30 text-xs font-mono animate-in fade-in duration-150">
            <div className="flex items-center gap-2 truncate">
              <FileText className="h-4 w-4 text-accent shrink-0" />
              <span className="font-semibold text-foreground truncate">{attachedFile.name}</span>
              <span className="text-muted-foreground text-[11px]">({formatBytes(attachedFile.size)})</span>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setAttachedFile(null)}
              className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        <form
          onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
          className="flex gap-2 items-end"
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
            id="chat-file-upload"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            className="h-11 w-11 shrink-0 border-border/60 hover:bg-accent/10 hover:border-accent/40 hover:text-accent transition-colors"
            title="Attach file for AI scan"
            disabled={loading}
          >
            <Paperclip className="h-4 w-4" />
          </Button>

          <div className="flex-1 relative">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Ask me anything, or say 'scan https://...' to run a security check..."
              className="w-full min-h-[44px] max-h-[120px] text-sm resize-none py-3 pr-3 border-border/60 focus:border-accent/60 bg-background/60 transition-colors rounded-xl"
              disabled={loading}
            />
          </div>

          <Button
            type="submit"
            size="icon"
            className="h-11 w-11 shrink-0 bg-accent text-accent-foreground hover:bg-accent/90 shadow-sm transition-all hover:scale-105 active:scale-95 rounded-xl"
            disabled={loading || (!input.trim() && !attachedFile)}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>

        <p className="text-[10px] text-muted-foreground font-mono text-center">
          Powered by Groq AI • Threat scans auto-trigger when you mention a URL, IP, email, or file
        </p>
      </div>
    </div>
  );
}

function generateFallbackReport(
  prompt: string,
  file: File | null,
  entities: ReturnType<typeof extractEntities>,
  telemetry: Record<string, unknown>,
  maxThreatScore: number,
  computedRiskLevel: string
): string {
  let report = `## Threat Investigation Report\n\n`;

  report += `**Overall Verdict:** ${
    maxThreatScore >= 70
      ? "ðŸš¨ HIGH RISK / MALICIOUS INDICATORS"
      : maxThreatScore >= 30
      ? "âš ï¸ SUSPICIOUS PATTERNS DETECTED"
      : "âœ… CLEAN / LOW THREAT SCORE"
  }\n`;
  report += `**Calibrated Threat Score:** ${maxThreatScore}/100 (${computedRiskLevel} risk)\n\n`;

  report += `### Target Breakdown\n`;
  if (file) {
    report += `- **File Analyzed:** \`${file.name}\` (${formatBytes(file.size)})\n`;
  }
  if (entities.urls.length > 0) {
    report += `- **URLs Inspected:** ${entities.urls.map((u) => `\`${u}\``).join(", ")}\n`;
  }
  if (entities.ips.length > 0) {
    report += `- **IP Addresses:** ${entities.ips.map((ip) => `\`${ip}\``).join(", ")}\n`;
  }
  if (entities.emails.length > 0) {
    report += `- **Email Senders/Recipients:** ${entities.emails.map((e) => `\`${e}\``).join(", ")}\n`;
  }

  report += `\n### Telemetry Findings & IOCs\n`;
  if (maxThreatScore >= 30) {
    report += `- Suspicious indicators or threat telemetry flagged during multi-feed investigation.\n`;
    report += `- External feeds (PhishGuard / VirusTotal / Scanii / AbuseIPDB) recorded non-zero threat signatures.\n`;
  } else {
    report += `- No critical malware signatures, phishing lookalikes, or malicious domain matches were identified.\n`;
  }

  report += `\n### Actionable Recommendations\n`;
  if (maxThreatScore >= 70) {
    report += `1. **Do not execute or click** any associated links or files.\n`;
    report += `2. **Isolate target endpoint** if the file was opened.\n`;
    report += `3. Block communication to associated IPs / domains on perimeter firewall.\n`;
  } else if (maxThreatScore >= 30) {
    report += `1. Verify sender identity via secondary out-of-band communication.\n`;
    report += `2. Inspect embedded links carefully before inputting credentials.\n`;
  } else {
    report += `1. Target appears safe under standard security baseline checks.\n`;
  }

  return report;
}

function getCyberResponse(question: string): string {
  const q = question.trim().toLowerCase();

  if (/^(hi|hello|hey|greetings|good morning|good afternoon|good evening|yo)\b/i.test(q)) {
    return `Hello! ðŸ‘‹ I am **DefenSight AI**, your AI Cybersecurity Assistant & Threat Investigator.\n\nI can help you with:\n- **Cybersecurity Q&A & Code Audits** â€” Ask about SQL injection, XSS, password security, BEC, zero trust, 2FA/MFA, or web security.\n- **Background Threat Scanning** â€” Ask me to scan a URL, audit an email message, inspect an attached file, or check IP threat scores.\n\nHow can I assist you today?`;
  }

  if (/^(who are you|what are you|what is your name|identify yourself)\b/i.test(q)) {
    return `I am **DefenSight AI**, an advanced AI Threat Intelligence & Forensics Assistant powered by Groq High-Limit AI.\n\nMy primary goal is to help you analyze security concepts, answer cybersecurity questions, and perform background investigations across URLs, files, emails, IP addresses, and phone numbers.`;
  }

  if (/^(how are you|how's it going|what's up)\b/i.test(q)) {
    return `I'm operating smoothly and ready to assist with your cybersecurity questions or background investigations! What would you like to explore today?`;
  }

  if (/^(what can you do|help|features|capabilities|commands)\b/i.test(q)) {
    return `## DefenSight AI Capabilities ðŸ›¡ï¸\n\n- **Conversational Security Q&A**: Ask about web security, vulnerability fixes, cryptography, or security architecture.\n- **URL Phishing Scans**: Ask to *"scan https://example.com"* to check domain reputation and phishing indicators.\n- **Email Phishing Audits**: Paste an email or email header to check for BEC and wire fraud.\n- **File Scanning**: Attach any file or paste code/logs to scan across VirusTotal, Scanii, and ThreatFox.\n- **IP & Phone Intelligence**: Lookup IP addresses or phone numbers for risk ratings.`;
  }

  if (q.includes("sql injection") || q.includes("sqli")) {
    return `## SQL Injection (SQLi) Overview\n\nSQL Injection is a code injection technique where malicious SQL statements are inserted into entry fields for execution.\n\n### Prevention:\n1. **Prepared Statements / Parameterized Queries** (Primary Defense)\n2. **Use ORM Frameworks** (Prisma, TypeORM, Hibernate)\n3. **Input Validation & Sanitization**\n4. **Apply Least Privilege DB Permissions**\n5. **Web Application Firewall (WAF)**`;
  }

  if (q.includes("xss") || q.includes("cross-site scripting")) {
    return `## Cross-Site Scripting (XSS)\n\nXSS allows attackers to inject malicious scripts into web pages viewed by other users.\n\n### Prevention:\n1. **Context-Aware Output Encoding**\n2. **Content Security Policy (CSP)** headers\n3. **Sanitize HTML Input** (\`DOMPurify\`)\n4. **HttpOnly & SameSite Cookie Flags**`;
  }

  if (q.includes("password")) {
    return `## Password Security Best Practices\n\n- Use **14+ characters** minimum\n- Use a **password manager** (Bitwarden, 1Password)\n- Enable **2FA/MFA** (Prefer TOTP apps or FIDO2 YubiKeys over SMS)\n- Never reuse passwords across services\n\n*Try our built-in Password Lab tool from the navigation menu!*`;
  }

  if (q.includes("phishing") || q.includes("bec")) {
    return `## Phishing & Social Engineering Awareness\n\nPhishing uses deceptive emails, websites, or messages to steal credentials or commit wire fraud.\n\n**Red Flags:**\n- Urgent pressure tactics\n- Mismatched sender domain\n- Suspicious links/attachments\n- Requests for gift cards or direct deposit changes\n\n*Tip: Paste any suspicious URL or email text here to run a background threat scan!*`;
  }

  return `## DefenSight AI Security Response\n\nThank you for your message regarding **"${question.slice(0, 80)}"**.\n\n### Key Security Recommendations:\n1. **Principle of Least Privilege**: Grant minimal necessary permissions.\n2. **Defense in Depth**: Implement multi-layered security controls (WAF, MFA, EDR).\n3. **Keep Software Updated**: Apply patches promptly for known CVE vulnerabilities.\n4. **Zero Trust Baseline**: Explicitly verify all network requests.\n\nFeel free to ask follow-up security questions or instruct me to scan a URL, file, email, or IP address!`;
}
