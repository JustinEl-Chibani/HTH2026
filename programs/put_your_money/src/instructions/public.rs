use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};

use crate::{constants::*, error::PymError, escrow::close_vault, events::*, state::*};

#[derive(Accounts)]
pub struct TakePublic<'info> {
    pub taker: Signer<'info>,
    #[account(mut)]
    pub bet: Box<Account<'info, Bet>>,
}

/// Open (public) bets have no opponent until someone takes them. Taking = becoming the opponent and
/// accepting the exact version you saw, in one step. The client sends `fund` in the same
/// transaction, so the taker's stake is locked immediately.
pub fn handle_take_public(ctx: Context<TakePublic>, expected_version: u32) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let taker = ctx.accounts.taker.key();
    let bet = &mut ctx.accounts.bet;
    require_keys_eq!(bet.opponent, Pubkey::default(), PymError::NotPublic);
    require!(bet.state == BetState::Proposed, PymError::InvalidState);
    require_keys_neq!(taker, bet.creator, PymError::SelfBet);
    require!(expected_version == bet.version, PymError::VersionMismatch);
    require!(now < bet.accept_deadline, PymError::AcceptDeadlinePassed);

    bet.opponent = taker;
    bet.state = BetState::Accepted;
    let funding_deadline = now.checked_add(FUNDING_WINDOW_SECS).ok_or(PymError::Overflow)?;
    bet.funding_deadline = funding_deadline.min(bet.event_deadline);

    emit!(BetTaken {
        bet: bet.key(),
        taker,
        version: bet.version,
        funding_deadline: bet.funding_deadline,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct ExpireProposal<'info> {
    #[account(mut)]
    pub bet: Box<Account<'info, Bet>>,
    #[account(mut, seeds = [VAULT_SEED, bet.key().as_ref()], bump = bet.vault_bump)]
    pub vault: Box<Account<'info, TokenAccount>>,
    /// CHECK: receives the vault rent; must be the bet creator.
    #[account(mut, address = bet.creator)]
    pub creator: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
}

/// A proposal nobody accepted before its accept deadline. Nothing was ever funded, so there is
/// nothing to refund: just close the empty vault. (Unlike `refund_expired`, this needs no token
/// accounts, which matters for open bets that never had an opponent.)
pub fn handle_expire_proposal(ctx: Context<ExpireProposal>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let bet = &ctx.accounts.bet;
    require!(bet.state == BetState::Proposed, PymError::InvalidState);
    require!(now >= bet.accept_deadline, PymError::NotExpired);

    close_vault(
        &ctx.accounts.token_program,
        ctx.accounts.vault.to_account_info(),
        ctx.accounts.creator.to_account_info(),
        bet.to_account_info(),
        bet.creator,
        bet.bet_id,
        bet.bump,
    )?;

    let bet = &mut ctx.accounts.bet;
    bet.state = BetState::Expired;
    bet.settled_at = now;
    emit!(BetExpired { bet: bet.key(), refunded_creator: 0, refunded_opponent: 0 });
    Ok(())
}
