import "server-only";
import { z } from "zod";

const schema = z.object({
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-5"),
  RESOLVER_SECRET_KEY: z.string().optional(),
  MINT_AUTHORITY_SECRET_KEY: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  NEXT_PUBLIC_USDC_MINT: z.string().optional(),
});

let cached: z.infer<typeof schema> | null = null;

export function serverEnv() {
  cached ??= schema.parse(process.env);
  return cached;
}
