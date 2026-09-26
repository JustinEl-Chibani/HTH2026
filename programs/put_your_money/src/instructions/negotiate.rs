use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};

use crate::{
    constants::*,
    error::PymError,
    escrow::close_vault,
    events::*,
    instructions::create::{resolve_deadline_for, validate_oracle},
    state::*,
};

#[derive(Accounts)]
pub struct Negotiate<'info> {
    pub signer: Signer<'info>,
    #[account(mut)]
    pub bet: Box<Account<'info, Bet>>,
}

/// Shared checks for responding to the current proposal (counter or accept).
fn check_can_respond(bet: &Bet, signer: &Pubkey, expected_version: u32, now: i64) -> Result<()> {
    bet.require_participant(signer)?;
    require!(bet.state == BetState::Proposed, PymError::InvalidState);
    require!(expected_version == bet.version, PymError::VersionMismatch);
    require_keys_neq!(*signer, bet.last_proposer, PymError::OwnProposal);
    require!(now < bet.accept_deadline, PymError::AcceptDeadlinePassed);
    Ok(())
}

#[allow(clippy::too_many_arguments)]
pub fn handle_counter_offer(
    ctx: Context<Negotiate>,
    expected_version: u32,
    creator_stake: u64,
    opponent_stake: u64,
    creator_side: Side,
    terms_hash: [u8; 32],
    event_deadline: i64,
    oracle: Option<OracleCondition>,
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let signer = ctx.accounts.signer.key();
    let bet = &mut ctx.accounts.bet;
    check_can_respond(bet, &signer, expected_version, now)?;
    require!(creator_stake > 0 && opponent_stake > 0, PymError::InvalidStake);
    creator_stake.checked_add(opponent_stake).ok_or(PymError::Overflow)?;
    require!(event_deadline > now, PymError::InvalidDeadlines);
    validate_oracle(bet.resolution, &oracle)?;

    bet.creator_stake = creator_stake;
    bet.opponent_stake = opponent_stake;
    bet.creator_side = creator_side;
    bet.terms_hash = terms_hash;
    bet.oracle = oracle;
    bet.event_deadline = event_deadline;
    bet.accept_deadline = bet.accept_deadline.min(event_deadline);
    bet.resolve_deadline = resolve_deadline_for(event_deadline)?;
    bet.last_proposer = signer;
    bet.version = bet.version.checked_add(1).ok_or(PymError::Overflow)?;

    emit!(CounterOffered {
        bet: bet.key(),
        by: signer,
        version: bet.version,
        creator_side,
        creator_stake,
        opponent_stake,
    });
    Ok(())
}

pub fn handle_accept(ctx: Context<Negotiate>, expected_version: u32) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let signer = ctx.accounts.signer.key();
    let bet = &mut ctx.accounts.bet;
    check_can_respond(bet, &signer, expected_version, now)?;

    bet.state = BetState::Accepted;
    let funding_deadline = now.checked_add(FUNDING_WINDOW_SECS).ok_or(PymError::Overflow)?;
    bet.funding_deadline = funding_deadline.min(bet.event_deadline);

    emit!(BetAccepted {
        bet: bet.key(),
        by: signer,
        version: bet.version,
        funding_deadline: bet.funding_deadline,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct Cancel<'info> {
    pub signer: Signer<'info>,
    #[account(mut)]
    pub bet: Box<Account<'info, Bet>>,
    #[account(mut, seeds = [VAULT_SEED, bet.key().as_ref()], bump = bet.vault_bump)]
    pub vault: Box<Account<'info, TokenAccount>>,
    /// CHECK: receives the vault rent; must be the bet creator.
    #[account(mut, address = bet.creator)]
    pub creator: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
}

/// Either participant can call off a bet while it's still a proposal (decline / withdraw).
pub fn handle_cancel(ctx: Context<Cancel>) -> Result<()> {
    let signer = ctx.accounts.signer.key();
    let bet = &ctx.accounts.bet;
    bet.require_participant(&signer)?;
    require!(bet.state == BetState::Proposed, PymError::InvalidState);

    close_vault(
        &ctx.accounts.token_program,
        ctx.accounts.vault.to_account_info(),
        ctx.accounts.creator.to_account_info(),
        bet.to_account_info(),
        bet.creator,
        bet.bet_id,
        bet.bump,
    )?;

    ctx.accounts.bet.state = BetState::Cancelled;
    emit!(BetCancelled { bet: ctx.accounts.bet.key(), by: signer });
    Ok(())
}
