use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, TransferChecked};

use crate::{constants::*, error::PymError, events::BetFunded, state::*};

#[derive(Accounts)]
pub struct Fund<'info> {
    pub funder: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    #[account(address = config.usdc_mint @ PymError::WrongMint)]
    pub usdc_mint: Box<Account<'info, Mint>>,
    #[account(mut)]
    pub bet: Box<Account<'info, Bet>>,
    #[account(mut, seeds = [VAULT_SEED, bet.key().as_ref()], bump = bet.vault_bump)]
    pub vault: Box<Account<'info, TokenAccount>>,
    #[account(mut, token::mint = usdc_mint, token::authority = funder)]
    pub funder_token: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

pub fn handle_fund(ctx: Context<Fund>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let funder = ctx.accounts.funder.key();
    let bet = &ctx.accounts.bet;
    bet.require_participant(&funder)?;
    require!(bet.state == BetState::Accepted, PymError::InvalidState);
    require!(now < bet.funding_deadline, PymError::FundingDeadlinePassed);

    let is_creator = funder == bet.creator;
    let (already_funded, amount) = if is_creator {
        (bet.creator_funded, bet.creator_stake)
    } else {
        (bet.opponent_funded, bet.opponent_stake)
    };
    require!(!already_funded, PymError::AlreadyFunded);

    token::transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.funder_token.to_account_info(),
                mint: ctx.accounts.usdc_mint.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.funder.to_account_info(),
            },
        ),
        amount,
        ctx.accounts.usdc_mint.decimals,
    )?;

    let bet = &mut ctx.accounts.bet;
    if is_creator {
        bet.creator_funded = true;
    } else {
        bet.opponent_funded = true;
    }
    let active = bet.creator_funded && bet.opponent_funded;
    if active {
        bet.state = BetState::Active;
    }

    emit!(BetFunded { bet: bet.key(), by: funder, amount, active });
    Ok(())
}
