import { z } from "zod";
import { LIMITS } from "../shared/api";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Strip control characters (keep tab/newline) and normalise line endings. */
export function sanitize(s: string): string {
  return s
    .replace(/\r\n?/g, "\n")
    // eslint-disable-next-line no-control-regex -- removing control characters is the point
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

const text = (min: number, max: number) =>
  z
    .string()
    .max(max * 2) // raw cap before sanitising
    .transform(sanitize)
    .pipe(z.string().min(min).max(max));

const base = {
  cvText: text(LIMITS.cvMinChars, LIMITS.cvMaxChars),
  turnstileToken: z.string().max(2048),
  clientId: z.string().regex(UUID_RE),
};

export const TailorRequestSchema = z
  .object({
    ...base,
    postingText: text(LIMITS.postingMinChars, LIMITS.postingMaxChars),
    outputLang: z.enum(["auto", "ar", "en"]),
  })
  .strict();

export const MapRequestSchema = z
  .object({
    ...base,
    city: z.enum(["riyadh", "jeddah", "both"]),
    outputLang: z.enum(["ar", "en"]),
  })
  .strict();

export type ValidTailorRequest = z.infer<typeof TailorRequestSchema>;
export type ValidMapRequest = z.infer<typeof MapRequestSchema>;

export function isUuid(s: string | null): s is string {
  return !!s && UUID_RE.test(s);
}
