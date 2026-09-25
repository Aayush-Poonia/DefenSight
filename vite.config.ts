import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { apiDevMiddleware } from "./server/dev-middleware";

const SERVER_ENV_KEYS = [
  "GROQ_API_KEY",
  "WHOISXML_API_KEY",
  "NUMVERIFY_API_KEY",
  "ABSTRACT_PHONE_API_KEY",
  "ABSTRACT_EMAIL_API_KEY",
  "ABSTRACT_IP_API_KEY",
  "WHOISFREAKS_API_KEY",
  "PHISHSTATS_API_KEY",
  "RAPIDAPI_KEY",
  "DISIFY_API_KEY",
  "SCANII_API_KEY",
  "SCANII_API_SECRET",
  "SCANII_API_BASE",
  "IPINFO_TOKEN",
  "URLSCAN_API_KEY",
  "VIRUSTOTAL_API_KEY",
  "ABUSEIPDB_API_KEY",
  "ALIENVAULT_OTX_API_KEY",
  "HYBRID_ANALYSIS_API_KEY",
  "GOOGLE_SAFE_BROWSING_API_KEY",
  "ABUSE_CH_API_KEY",
] as const;

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  for (const key of SERVER_ENV_KEYS) {
    if (env[key]) process.env[key] = env[key];
  }

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: "api-dev-server",
        configureServer(server) {
          server.middlewares.use(apiDevMiddleware());
        },
      },
    ],
    resolve: {
      alias: { "@": path.resolve(__dirname, "./src") },
    },
  };
});
