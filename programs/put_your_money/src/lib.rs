pub mod constants;
pub mod error;
pub mod escrow;
pub mod events;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("9gCvDMSSSqsCARyrubQTwUcC88U52YvM7CCd1zuUGZiG");

#[program]
pub mod put_your_money {
    use super::*;

    pub fn initialize_config(ctx: Context<InitializeConfig>, resolver: Pubkey) -> Result<()> {
        instructions::config::handle_initialize_config(ctx, resolver)
    }

    pub fn update_config(ctx: Context<UpdateConfig>, resolver: Pubkey) -> Result<()> {
        instructions::config::handle_update_config(ctx, resolver)
    }

    #[allow(clippy::too_many_arguments)]
    pub fn create_bet(
        ctx: Context<CreateBet>,
        bet_id: u64,
        opponent: Pubkey,
        creator_side: Side,
        creator_stake: u64,
        opponent_stake: u64,
        terms_hash: [u8; 32],
        resolution: ResolutionKind,
        oracle: Option<OracleCondition>,
        accept_deadline: i64,
        event_deadline: i64,
    ) -> Result<()> {
        instructions::create::handle_create_bet(
            ctx,
            bet_id,
            opponent,
            creator_side,
            creator_stake,
            opponent_stake,
            terms_hash,
            resolution,
            oracle,
            accept_deadline,
            event_deadline,
        )
    }

    #[allow(clippy::too_many_arguments)]
    pub fn counter_offer(
        ctx: Context<Negotiate>,
        expected_version: u32,
        creator_stake: u64,
        opponent_stake: u64,
        creator_side: Side,
        terms_hash: [u8; 32],
        event_deadline: i64,
        oracle: Option<OracleCondition>,
    ) -> Result<()> {
        instructions::negotiate::handle_counter_offer(
            ctx,
            expected_version,
            creator_stake,
            opponent_stake,
            creator_side,
            terms_hash,
            event_deadline,
            oracle,
        )
    }

    /// Public (open) oracle bets: the first taker becomes the opponent and funds their side.
    pub fn take_public(ctx: Context<TakePublic>, expected_version: u32) -> Result<()> {
        instructions::take::handle_take_public(ctx, expected_version)
    }

    pub fn accept(ctx: Context<Negotiate>, expected_version: u32) -> Result<()> {
        instructions::negotiate::handle_accept(ctx, expected_version)
    }

    pub fn cancel(ctx: Context<Cancel>) -> Result<()> {
        instructions::negotiate::handle_cancel(ctx)
    }

    pub fn fund(ctx: Context<Fund>) -> Result<()> {
        instructions::fund::handle_fund(ctx)
    }

    pub fn refund_expired(ctx: Context<RefundExpired>) -> Result<()> {
        instructions::refund::handle_refund_expired(ctx)
    }

    pub fn resolve_oracle(
        ctx: Context<ResolveOracle>,
        winner: Side,
        resolved_value: i64,
    ) -> Result<()> {
        instructions::resolve::handle_resolve_oracle(ctx, winner, resolved_value)
    }

    /// Mutual bets: propose a winner (or `Void` to call it off by agreement).
    pub fn propose_outcome(ctx: Context<Negotiate>, outcome: Outcome) -> Result<()> {
        instructions::resolve::handle_propose_outcome(ctx, outcome)
    }

    pub fn confirm_outcome(ctx: Context<ConfirmOutcome>) -> Result<()> {
        instructions::resolve::handle_confirm_outcome(ctx)
    }

    pub fn reject_outcome(ctx: Context<Negotiate>) -> Result<()> {
        instructions::resolve::handle_reject_outcome(ctx)
    }
}
