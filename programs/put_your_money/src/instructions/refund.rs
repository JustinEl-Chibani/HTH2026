use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};

use crate::{constants::*, error::PymError, escrow::Escrow, events::*, state::*};

#[derive(Accounts)]
pub struct RefundExpired<'info> {
    /// Anyone can crank expirations (the resolver worker does it automatically).
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    #[account(address = config.usdc_mint @ PymError::WrongMint)]
    pub usdc_mint: Box<Account<'info, Mint>>,
    #[account(mut)]
    pub bet: Box<Account<'info, Bet>>,
    #[account(mut, seeds = [VAULT_SEED, bet.key().as_ref()], bump = bet.vault_bump)]
    pub vault: Box<Account<'info, TokenAccount>>,
    /// CHECK: bet creator; receives vault rent.
    #[account(mut, address = bet.creator)]
    pub creator: UncheckedAccount<'info>,
    /// CHECK: bet opponent; only used as the ATA authority.
    #[account(address = bet.opponent)]
    pub opponent: UncheckedAccount<'info>,
    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = usdc_mint,
        associated_token::authority = creator
    )]
    pub creator_token: Box<Account<'info, TokenAccount>>,
    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = usdc_mint,
        associated_token::authority = opponent
    )]
    pub opponent_token: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

/// - Proposed past the accept deadline → Expired
/// - Accepted past the funding deadline → refund whoever funded, Expired
/// - Active/AwaitingConfirmation past the resolve deadline → refund both, Void
pub fn handle_refund_expired(ctx: Context<RefundExpired>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let bet = &ctx.accounts.bet;
    let new_state = match bet.state {
        BetState::Proposed => {
            require!(now >= bet.accept_deadline, PymError::NotExpired);
            BetState::Expired
        }
        BetState::Accepted => {
            require!(now >= bet.funding_deadline, PymError::NotExpired);
            BetState::Expired
        }
        BetState::Active | BetState::AwaitingConfirmation => {
            require!(now >= bet.resolve_deadline, PymError::NotExpired);
            BetState::Void
        }
        _ => return err!(PymError::InvalidState),
    };

    let a = &mut *ctx.accounts;
    let escrow = Escrow::new(&a.token_program, &a.usdc_mint, &a.vault, &a.bet);
    let (refunded_creator, refunded_opponent) =
        escrow.refund(&a.bet, &a.creator_token, &a.opponent_token)?;
    escrow.close(a.creator.to_account_info())?;

    a.bet.state = new_state;
    a.bet.settled_at = now;
    let key = a.bet.key();
    if new_state == BetState::Void {
        emit!(BetVoided { bet: key, refunded_creator, refunded_opponent });
    } else {
        emit!(BetExpired { bet: key, refunded_creator, refunded_opponent });
    }
    Ok(())
}
