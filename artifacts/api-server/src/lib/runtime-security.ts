import type { CorsOptions } from "cors";
import type { NextFunction, Request, Response } from "express";

const parseOrigin = (value: string | undefined): string | null => {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || ["127.0.0.1", "localhost", "::1"].includes(parsed.hostname) ? parsed.origin : null;
  } catch { return null; }
};

export function productionOrigins(environment: NodeJS.ProcessEnv = process.env): ReadonlySet<string> {
  const candidates = [environment.BIMLOG_PUBLIC_URL, environment.BIMLOG_URL, environment.APP_URL];
  for (const domain of (environment.REPLIT_DOMAINS ?? "").split(",")) candidates.push(domain.trim() ? `https://${domain.trim()}` : undefined);
  if (environment.REPLIT_DEV_DOMAIN) candidates.push(`https://${environment.REPLIT_DEV_DOMAIN}`);
  return new Set(candidates.map(parseOrigin).filter((value): value is string => Boolean(value)));
}

export function governedCorsOptions(environment: NodeJS.ProcessEnv = process.env): CorsOptions {
  const allowed = productionOrigins(environment);
  return {
    credentials: true,
    origin(origin, callback) {
      if (!origin || allowed.has(origin)) return callback(null, true);
      callback(new Error("CORS_ORIGIN_DENIED"));
    },
  };
}

export function resolveSessionSecret(environment: NodeJS.ProcessEnv = process.env): string {
  const configured = environment.SESSION_SECRET?.trim();
  if (configured && configured.length >= 32) return configured;
  if (environment.REPLIT_DEPLOYMENT === "1" || environment.NODE_ENV === "production") throw new Error("SESSION_SECRET_REQUIRED");
  return "bimlog-local-development-session-secret";
}

export function securityHeaders(_request: Request, response: Response, next: NextFunction): void {
  response.setHeader("Content-Security-Policy", "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'; form-action 'self'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https: wss:; script-src 'self'; style-src 'self' 'unsafe-inline'");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
}
