import type { IncomingMessage, ServerResponse } from "node:http";
import type { Connect } from "vite";

const routes: Record<string, () => Promise<(req: any, res: any) => any>> = {
  "analyze-phishing": () => import("../api/analyze-phishing.ts").then((m) => m.default),
  "analyze-news": () => import("../api/analyze-news.ts").then((m) => m.default),
  "analyze-email": () => import("../api/analyze-email.ts").then((m) => m.default),
  ip: () => import("../api/ip.ts").then((m) => m.default),
  phone: () => import("../api/phone.ts").then((m) => m.default),
  email: () => import("../api/email.ts").then((m) => m.default),
  domain: () => import("../api/domain.ts").then((m) => m.default),
  url: () => import("../api/url.ts").then((m) => m.default),
  file: () => import("../api/file.ts").then((m) => m.default),
  "phishing-intel": () => import("../api/phishing-intel.ts").then((m) => m.default),
  hackertarget: () => import("../api/hackertarget.ts").then((m) => m.default),
  vulnerability: () => import("../api/vulnerability.ts").then((m) => m.default),
};

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function createMockRes(res: ServerResponse) {
  let statusCode = 200;
  const self = {
    status(code: number) {
      statusCode = code;
      return self;
    },
    setHeader(key: string, value: string | number) {
      res.setHeader(key, String(value));
      return self;
    },
    json(payload: unknown) {
      res.statusCode = statusCode;
      if (!res.getHeader("Content-Type")) {
        res.setHeader("Content-Type", "application/json");
      }
      res.end(JSON.stringify(payload));
      return self;
    },
    end(data?: string) {
      res.statusCode = statusCode;
      res.end(data);
      return self;
    },
  };
  return self;
}

export function apiDevMiddleware(): Connect.NextHandleFunction {
  return async (req, res, next) => {
    const url = req.url ?? "";
    if (!url.startsWith("/api/")) {
      next();
      return;
    }

    const name = url.slice("/api/".length).split("?")[0];
    const loadHandler = routes[name];
    if (!loadHandler) {
      next();
      return;
    }

    try {
      const handler = await loadHandler();
      let body: unknown = {};
      if (req.method === "POST") {
        const raw = await readBody(req);
        body = raw ? JSON.parse(raw) : {};
      }
      await handler({ method: req.method, body, headers: req.headers }, createMockRes(res));
    } catch (e) {
      if (!res.writableEnded) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }));
      }
    }
  };
}
