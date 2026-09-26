use anchor_lang::prelude::*;
use anchor_spl::token::Mint;

use crate::{constants::*, error::PymError, state::Config};

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(init, payer = admin, space = 8 + Config::INIT_SPACE, seeds = [CONFIG_SEED], bump)]
    pub config: Account<'info, Config>,
    pub usdc_mint: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
}

pub fn handle_initialize_config(ctx: Context<InitializeConfig>, resolver: Pubkey) -> Result<()> {
    let config = &mut ctx.accounts.config;
    config.admin = ctx.accounts.admin.key();
    config.resolver = resolver;
    config.usdc_mint = ctx.accounts.usdc_mint.key();
    config.bump = ctx.bumps.config;
    Ok(())
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    pub admin: Signer<'info>,
    #[account(mut, seeds = [CONFIG_SEED], bump = config.bump, has_one = admin @ PymError::NotAdmin)]
    pub config: Account<'info, Config>,
    pub usdc_mint: Account<'info, Mint>,
}

pub fn handle_update_config(ctx: Context<UpdateConfig>, resolver: Pubkey) -> Result<()> {
    let config = &mut ctx.accounts.config;
    config.resolver = resolver;
    config.usdc_mint = ctx.accounts.usdc_mint.key();
    Ok(())
}
