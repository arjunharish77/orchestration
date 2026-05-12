type HeaderResponse = {
  setHeader(name: string, value: string): void;
  status: (code: number) => { json: (body: unknown) => void };
};

import { timingSafeEqual } from 'crypto';

type SecurityRequest = {
  method?: string;
  path: string;
  headers: Record<string, string | string[] | undefined>;
};

type NextFunction = () => void;

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);
const csrfExemptPrefixes = ['/auth/login', '/auth/login/email-otp/verify', '/auth/refresh', '/webhooks', '/connectors/whatsapp/webhook', '/connectors/voicebot/webhook'];

export function securityHeaders() {
  return (_request: SecurityRequest, response: HeaderResponse, next: NextFunction) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    response.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self' data:; img-src 'self' data: blob:; frame-ancestors 'none'; base-uri 'self'");
    next();
  };
}

export function csrfProtection() {
  return (request: SecurityRequest, response: HeaderResponse, next: NextFunction) => {
    const method = String(request.method ?? 'GET').toUpperCase();
    if (safeMethods.has(method) || csrfExemptPrefixes.some((prefix) => request.path.startsWith(prefix))) return next();
    // Skip CSRF only when no cookie session is present (Bearer-only API clients)
    if (!readCookie(request.headers.cookie, 'unnatify_access_token')) return next();

    const cookieToken = readCookie(request.headers.cookie, 'unnatify_csrf_token');
    const headerToken = headerValue(request.headers['x-csrf-token']);
    if (!cookieToken || !headerToken || !safeEqual(cookieToken, headerToken)) {
      response.status(403).json({ message: 'Invalid CSRF token' });
      return;
    }

    next();
  };
}

function headerValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function readCookie(value: string | string[] | undefined, name: string) {
  const header = headerValue(value);
  if (!header) return null;
  const cookie = header
    .split(';')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${name}=`));
  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : null;
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}
