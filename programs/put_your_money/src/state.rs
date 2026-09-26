use anchor_lang::prelude::*;

use crate::error::PymError;

#[account]
#[derive(InitSpace)]
pub struct Config {
    pub admin: Pubkey,
    pub resolver: Pubkey,
    pub usdc_mint: Pubkey,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum Side {
    Yes,
    No,
}

impl Side {
    pub fn opposite(self) -> Side {
        match self {
            Side::Yes => Side::No,
            Side::No => Side::Yes,
        }
    }
}

/// A mutual-resolution proposal: one side won, or call the whole thing off.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum Outcome {
    Yes,
    No,
    Void,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum ResolutionKind {
    Oracle,
    Mutual,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum FeedId {
    SolUsd,
    BtcUsd,
    EthUsd,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum ConditionKind {
    /// YES if the price reaches >= threshold at any point before the event deadline.
    TouchAbove,
    /// YES if the price reaches <= threshold at any point before the event deadline.
    TouchBelow,
    /// YES if the price is >= threshold at the event deadline.
    AboveAt,
    /// YES if the price is <= threshold at the event deadline.
    BelowAt,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub struct OracleCondition {
    pub feed: FeedId,
    pub kind: ConditionKind,
    /// USD price * 1e6
    pub threshold: i64,
}

impl OracleCondition {
    /// Whether `value` (price * 1e6) satisfies the YES condition.
    pub fn is_yes(&self, value: i64) -> bool {
        match self.kind {
            ConditionKind::TouchAbove | ConditionKind::AboveAt => value >= self.threshold,
            ConditionKind::TouchBelow | ConditionKind::BelowAt => value <= self.threshold,
        }
    }

    pub fn is_touch(&self) -> bool {
        matches!(self.kind, ConditionKind::TouchAbove | ConditionKind::TouchBelow)
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum BetState {
    Proposed,
    Accepted,
    Active,
    AwaitingConfirmation,
    Settled,
    Cancelled,
    Expired,
    Void,
}

#[account]
#[derive(InitSpace)]
pub struct Bet {
    pub bet_id: u64,
    pub creator: Pubkey,
    pub opponent: Pubkey,
    pub creator_side: Side,
    pub creator_stake: u64,
    pub opponent_stake: u64,
    /// Increments on every counteroffer. Accepting requires naming the exact version.
    pub version: u32,
    /// The party who made the current proposal (and therefore cannot accept it).
    pub last_proposer: Pubkey,
    /// sha256 of the canonical JSON of the human-readable terms.
    pub terms_hash: [u8; 32],
    pub resolution: ResolutionKind,
    pub oracle: Option<OracleCondition>,
    pub created_at: i64,
    pub accept_deadline: i64,
    pub funding_deadline: i64,
    pub event_deadline: i64,
    pub resolve_deadline: i64,
    pub state: BetState,
    pub creator_funded: bool,
    pub opponent_funded: bool,
    pub proposed_outcome: Option<Outcome>,
    pub proposed_by: Option<Pubkey>,
    pub winner: Option<Side>,
    /// Oracle price * 1e6 recorded at resolution, for display/audit.
    pub resolved_value: Option<i64>,
    pub settled_at: i64,
    pub bump: u8,
    pub vault_bump: u8,
}

impl Bet {
    pub fn is_participant(&self, key: &Pubkey) -> bool {
        *key == self.creator || *key == self.opponent
    }

    pub fn require_participant(&self, key: &Pubkey) -> Result<()> {
        require!(self.is_participant(key), PymError::NotParticipant);
        Ok(())
    }

    /// The wallet that holds `side`.
    pub fn holder_of(&self, side: Side) -> Pubkey {
        if side == self.creator_side {
            self.creator
        } else {
            self.opponent
        }
    }

    pub fn pot(&self) -> Result<u64> {
        self.creator_stake
            .checked_add(self.opponent_stake)
            .ok_or_else(|| error!(PymError::Overflow))
    }
}
