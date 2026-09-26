import { z } from "zod";
import { UNITS_PER_USD } from "./money";
import { usernameSchema } from "./validation";

export const MAX_STAKE_UNITS = 10_000n * UNITS_PER_USD;

const units = z
  .string()
  .regex(/^\d+$/, "Amount must be whole base units")
  .refine((v) => BigInt(v) > 0n, "Must be more than $0")
  .refine((v) => BigInt(v) <= MAX_STAKE_UNITS, "Max $10,000 per side");

export const oracleSchema = z.object({
  feed: z.enum(["SOL_USD", "BTC_USD", "ETH_USD"]),
  kind: z.enum(["TOUCH_ABOVE", "TOUCH_BELOW", "ABOVE_AT", "BELOW_AT"]),
  threshold: z
    .string()
    .regex(/^\d+$/)
    .refine((v) => BigInt(v) > 0n, "Threshold must be positive"),
});

export const draftSchema = z
  .object({
    opponentUsername: usernameSchema,
    title: z.string().trim().min(3, "Give it a short title").max(80),
    conditionText: z.string().trim().min(5, "Describe what YES means").max(500),
    creatorSide: z.enum(["YES", "NO"]),
    creatorStake: units,
    opponentStake: units,
    oddsAmerican: z.number().int().nullable().optional(),
    resolution: z.enum(["ORACLE", "MUTUAL"]),
    oracle: oracleSchema.nullable(),
    eventDeadline: z.iso.datetime({ offset: true }),
  })
  .superRefine((d, ctx) => {
    if ((d.resolution === "ORACLE") !== !!d.oracle) {
      ctx.addIssue({ code: "custom", path: ["oracle"], message: "Price bets need a price condition" });
    }
  });

export type DraftInput = z.infer<typeof draftSchema>;

export const counterSchema = z.object({
  creatorSide: z.enum(["YES", "NO"]),
  creatorStake: units,
  opponentStake: units,
});
