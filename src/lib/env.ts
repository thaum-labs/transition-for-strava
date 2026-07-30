import { z } from "zod";

const EnvSchema = z.object({
  SESSION_SECRET: z
    .string()
    .min(32, "SESSION_SECRET must be at least 32 characters."),
  STRAVA_CLIENT_ID: z
    .string()
    .regex(/^\d+$/, "STRAVA_CLIENT_ID must be numeric."),
  STRAVA_CLIENT_SECRET: z.string().min(1, "STRAVA_CLIENT_SECRET is required."),
  STRAVA_REDIRECT_URI: z.string().url("STRAVA_REDIRECT_URI must be a valid URL."),
  APP_BASE_URL: z.string().url("APP_BASE_URL must be a valid URL.").optional(),
  STRAVA_SCOPES: z.string().optional(),
  NODE_ENV: z.string().optional(),
});

let cached: z.infer<typeof EnvSchema> | null = null;

/** Test-only: clear cached env so subsequent requiredEnv reads pick up new process.env. */
export function resetEnvCacheForTests() {
  cached = null;
}

function readEnv() {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse({
    SESSION_SECRET: process.env.SESSION_SECRET,
    STRAVA_CLIENT_ID: process.env.STRAVA_CLIENT_ID,
    STRAVA_CLIENT_SECRET: process.env.STRAVA_CLIENT_SECRET,
    STRAVA_REDIRECT_URI: process.env.STRAVA_REDIRECT_URI,
    APP_BASE_URL: process.env.APP_BASE_URL || undefined,
    STRAVA_SCOPES: process.env.STRAVA_SCOPES || undefined,
    NODE_ENV: process.env.NODE_ENV,
  });
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${details}`);
  }
  if (isProd() && parsed.data.APP_BASE_URL) {
    const url = new URL(parsed.data.APP_BASE_URL);
    if (url.protocol !== "https:") {
      throw new Error("APP_BASE_URL must use https in production.");
    }
  }
  cached = parsed.data;
  return cached;
}

export function requiredEnv(name: keyof z.infer<typeof EnvSchema> | string): string {
  // Prefer schema-backed values for known keys; fall back for flexibility.
  if (
    name === "SESSION_SECRET" ||
    name === "STRAVA_CLIENT_ID" ||
    name === "STRAVA_CLIENT_SECRET" ||
    name === "STRAVA_REDIRECT_URI"
  ) {
    return readEnv()[name];
  }
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

export function optionalEnv(name: string): string | undefined {
  const v = process.env[name];
  return v && v.length > 0 ? v : undefined;
}

export function isProd() {
  return process.env.NODE_ENV === "production";
}

/** Canonical public origin for redirects. Prefer APP_BASE_URL over forwarded headers. */
export function getAppBaseUrl(req?: Request): string {
  const fromEnv = optionalEnv("APP_BASE_URL");
  if (fromEnv) {
    return fromEnv.replace(/\/$/, "");
  }

  if (req) {
    const xfProto = req.headers.get("x-forwarded-proto");
    const xfHost = req.headers.get("x-forwarded-host");
    if (xfProto && xfHost) {
      const host = xfHost.split(",")[0].trim().toLowerCase();
      const proto = xfProto.split(",")[0].trim().toLowerCase();
      // Reject header values that could break out of URL/script contexts.
      if (
        (proto === "http" || proto === "https") &&
        /^[a-z0-9.-]+(?::\d+)?$/i.test(host)
      ) {
        return `${proto}://${host}`;
      }
    }
    return new URL(req.url).origin;
  }

  throw new Error("APP_BASE_URL is required when no request is available.");
}
