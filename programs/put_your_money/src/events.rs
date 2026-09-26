use anchor_lang::prelude::*;

use crate::state::{Outcome, Side};

#[event]
pub struct BetCreated {
    pub bet: Pubkey,
    pub creator: Pubkey,
    pub opponent: Pubkey,
    pub creator_stake: u64,
    pub opponent_stake: u64,
}

#[event]
pub struct CounterOffered {
    pub bet: Pubkey,
    pub by: Pubkey,
    pub version: u32,
    pub creator_side: Side,
    pub creator_stake: u64,
    pub opponent_stake: u64,
}

#[event]
pub struct BetAccepted {
    pub bet: Pubkey,
    pub by: Pubkey,
    pub version: u32,
    pub funding_deadline: i64,
}

#[event]
pub struct BetFunded {
    pub bet: Pubkey,
    pub by: Pubkey,
    pub amount: u64,
    pub active: bool,
}

#[event]
pub struct BetCancelled {
    pub bet: Pubkey,
    pub by: Pubkey,
}

#[event]
pub struct BetExpired {
    pub bet: Pubkey,
    pub refunded_creator: u64,
    pub refunded_opponent: u64,
}

#[event]
pub struct BetVoided {
    pub bet: Pubkey,
    pub refunded_creator: u64,
    pub refunded_opponent: u64,
}

#[event]
pub struct OutcomeProposed {
    pub bet: Pubkey,
    pub by: Pubkey,
    pub outcome: Outcome,
}

#[event]
pub struct OutcomeRejected {
    pub bet: Pubkey,
    pub by: Pubkey,
}

#[event]
pub struct BetSettled {
    pub bet: Pubkey,
    pub winner_side: Side,
    pub winner: Pubkey,
    pub amount: u64,
    pub resolved_value: Option<i64>,
}

#[event]
pub struct BetTaken {
    pub bet: Pubkey,
    pub taker: Pubkey,
    pub version: u32,
    pub funding_deadline: i64,
}
