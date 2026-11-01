import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import Login from "./pages/Login";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Home from "./pages/Home";
import Phishing from "./pages/Phishing";
import Password from "./pages/Password";
import Reports from "./pages/Reports";
import HistoryPage from "./pages/HistoryPage";
import EmailAnalyzer from "./pages/EmailAnalyzer";
import EmailIntelligence from "./pages/EmailIntelligence";
import IpIntelligence from "./pages/IpIntelligence";
import PhoneIntelligence from "./pages/PhoneIntelligence";
import FileScanner from "./pages/FileScanner";
import Chat from "./pages/Chat";
import Account from "./pages/Account";
import ResetPassword from "./pages/ResetPassword";
import VulnerabilityIntelligence from "./pages/VulnerabilityIntelligence";
import AppShell from "./components/AppShell";
import { Loader2 } from "lucide-react";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  return <AppShell>{children}</AppShell>;
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/landing" element={<Landing />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/intel" element={<Navigate to="/intel/ip" replace />} />
      <Route path="/intel/ip" element={<ProtectedRoute><IpIntelligence /></ProtectedRoute>} />
      <Route path="/intel/phone" element={<ProtectedRoute><PhoneIntelligence /></ProtectedRoute>} />
      <Route path="/intel/file" element={<ProtectedRoute><FileScanner /></ProtectedRoute>} />
      <Route path="/intel/email" element={<ProtectedRoute><EmailIntelligence /></ProtectedRoute>} />
      <Route path="/news" element={<ProtectedRoute><Home /></ProtectedRoute>} />
      <Route path="/phishing" element={<ProtectedRoute><Phishing /></ProtectedRoute>} />
      <Route path="/email" element={<ProtectedRoute><EmailAnalyzer /></ProtectedRoute>} />
      <Route path="/password" element={<ProtectedRoute><Password /></ProtectedRoute>} />
      <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
      <Route path="/vulnerability" element={<ProtectedRoute><VulnerabilityIntelligence /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
      <Route path="/history" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Account /></ProtectedRoute>} />
      <Route path="/account" element={<Navigate to="/settings" replace />} />
      <Route path="/" element={<Landing />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
