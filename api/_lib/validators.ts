import { ApiError } from "./http.js";

const IPV4 =
  /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d?\d)$/;
const IPV6 =
  /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;

export function validateIp(raw: unknown): string {
  if (typeof raw !== "string" || !raw.trim()) throw new ApiError("IP address is required", 400);
  const ip = raw.trim();
  if (!IPV4.test(ip) && !IPV6.test(ip)) throw new ApiError("Invalid IP address format", 400);
  return ip;
}

export function validatePhone(raw: unknown): string {
  if (typeof raw !== "string" || !raw.trim()) throw new ApiError("Phone number is required", 400);
  let phone = raw.trim().replace(/[\s().-]/g, "");
  if (phone.startsWith("00")) phone = `+${phone.slice(2)}`;
  if (!phone.startsWith("+") && phone.length >= 10) {
    // allow national numbers; providers accept E.164 without +
    phone = phone.replace(/\D/g, "");
  } else {
    phone = phone.replace(/[^\d+]/g, "");
  }
  if (!/^\+?\d{7,15}$/.test(phone)) {
    throw new ApiError("Invalid phone number â€” use digits with optional country code (+)", 400);
  }
  return phone;
}

export function validateEmail(raw: unknown): string {
  if (typeof raw !== "string" || !raw.trim()) throw new ApiError("Email is required", 400);
  const email = raw.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new ApiError("Invalid email address", 400);
  }
  return email;
}

export function validateDomain(raw: unknown): string {
  if (typeof raw !== "string" || !raw.trim()) throw new ApiError("Domain is required", 400);
  let domain = raw.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0].split("?")[0];
  domain = domain.replace(/:\d+$/, "");
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i.test(domain)) {
    throw new ApiError("Invalid domain name", 400);
  }
  return domain;
}

export function validateUrl(raw: unknown): string {
  if (typeof raw !== "string" || !raw.trim()) throw new ApiError("URL is required", 400);
  let url = raw.trim();
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  if (url.length > 2048) throw new ApiError("URL too long", 400);
  try {
    const u = new URL(url);
    if (!u.hostname.includes(".")) throw new ApiError("Invalid URL host", 400);
    return u.toString();
  } catch {
    throw new ApiError("Invalid URL", 400);
  }
}

export function validateFilePayload(body: {
  filename?: unknown;
  contentBase64?: unknown;
  contentType?: unknown;
}): { filename: string; buffer: Buffer; contentType: string } {
  const filename = typeof body.filename === "string" ? body.filename.trim() : "";
  const contentBase64 = typeof body.contentBase64 === "string" ? body.contentBase64.trim() : "";
  const contentType = typeof body.contentType === "string" && body.contentType.trim()
    ? body.contentType.trim()
    : "application/octet-stream";

  if (!filename) throw new ApiError("filename is required", 400);
  if (!contentBase64) throw new ApiError("contentBase64 is required", 400);
  if (filename.length > 255) throw new ApiError("filename too long", 400);

  const cleaned = contentBase64.replace(/^data:[^;]+;base64,/, "");
  let buffer: Buffer;
  try {
    buffer = Buffer.from(cleaned, "base64");
  } catch {
    throw new ApiError("Invalid base64 file content", 400);
  }
  if (buffer.length === 0) throw new ApiError("Empty file", 400);
  if (buffer.length > 5 * 1024 * 1024) throw new ApiError("File too large (max 5MB)", 400);

  return { filename, buffer, contentType };
}

