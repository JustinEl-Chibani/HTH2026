use anchor_lang::prelude::*;

#[constant]
pub const CONFIG_SEED: &[u8] = b"config";
#[constant]
pub const BET_SEED: &[u8] = b"bet";
#[constant]
pub const VAULT_SEED: &[u8] = b"vault";

/// Time both parties have to fund after acceptance (capped at the event deadline).
pub const FUNDING_WINDOW_SECS: i64 = 30 * 60;
/// After the event deadline, how long the bet can still be resolved before it becomes refundable.
pub const RESOLVE_WINDOW_SECS: i64 = 48 * 60 * 60;
