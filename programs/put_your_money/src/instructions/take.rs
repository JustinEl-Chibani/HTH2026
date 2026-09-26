use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, TransferChecked};

use crate::{constants::*, error::PymError, events::BetTaken, state::*};

#[derive(Accounts)]
pub struct TakePublic<'info> {
    pub taker: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    #[account(address = config.usdc_mint @ PymError::WrongMint)]
    pub usdc_mint: Box<Account<'info, Mint>>,
    #[account(mut)]
    pub bet: Box<Account<'info, Bet>>,
    #[account(mut, seeds = [VAULT_SEED, bet.key().as_ref()], bump = bet.vault_bump)]
    pub vault: Box<Account<'info, TokenAccount>>,
    #[account(mut, token::mint = usdc_mint, token::authority = taker)]
    pub taker_token: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

/// Take a public bet: the signer becomes the opponent on the exact posted terms and funds their stake
/// in the same instruction (so nobody can "take" a bet and then stall). The first taker wins; the
/// creator then funds their side as with any accepted bet.
pub fn handle_take_public(ctx: Context<TakePublic>, expected_version: u32) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let taker = ctx.accounts.taker.key();
    let bet = &ctx.accounts.bet;
    require!(bet.opponent == Pubkey::default(), PymError::NotPublic);
    require!(bet.state == BetState::Proposed, PymError::InvalidState);
    require_keys_neq!(taker, bet.creator, PymError::SelfBet);
    require!(expected_version == bet.version, PymError::VersionMismatch);
    require!(now < bet.accept_deadline, PymError::AcceptDeadlinePassed);
    let amount = bet.opponent_stake;

    token::transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.taker_token.to_account_info(),
                mint: ctx.accounts.usdc_mint.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.taker.to_account_info(),
            },
        ),
        amount,
        ctx.accounts.usdc_mint.decimals,
    )?;

    let bet = &mut ctx.accounts.bet;
    bet.opponent = taker;
    bet.opponent_funded = true;
    bet.state = BetState::Accepted;
    let funding_deadline = now.checked_add(FUNDING_WINDOW_SECS).ok_or(PymError::Overflow)?;
    bet.funding_deadline = funding_deadline.min(bet.event_deadline);

    emit!(BetTaken {
        bet: bet.key(),
        taker,
        version: bet.version,
        amount,
        funding_deadline: bet.funding_deadline,
    });
    Ok(())
}
