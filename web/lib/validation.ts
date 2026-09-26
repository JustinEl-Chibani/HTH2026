import { PublicKey } from "@solana/web3.js";
import { z } from "zod";

export const pubkeySchema = z.string().refine((v) => {
  try {
    return new PublicKey(v).toBase58() === v;
  } catch {
    return false;
  }
}, "Invalid wallet address");

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "At least 3 characters")
  .max(20, "At most 20 characters")
  .regex(/^[a-z0-9_]+$/, "Letters, numbers and underscores only");

export const displayNameSchema = z.string().trim().min(1).max(40);
