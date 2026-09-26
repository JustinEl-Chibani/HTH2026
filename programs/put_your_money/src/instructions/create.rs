use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::{constants::*, error::PymError, events::BetCreated, state::*};

pub fn validate_oracle(resolution: ResolutionKind, oracle: &Option<OracleCondition>) -> Result<()> {
    match (resolution, oracle) {
        (ResolutionKind::Oracle, Some(o)) => require!(o.threshold > 0, PymError::InvalidOracle),
        (ResolutionKind::Mutual, None) => {}
        _ => return err!(PymError::InvalidOracle),
    }
    Ok(())
}

pub fn resolve_deadline_for(event_deadline: i64) -> Result<i64> {
    event_deadline
        .checked_add(RESOLVE_WINDOW_SECS)
        .ok_or_else(|| error!(PymError::Overflow))
}

#[derive(Accounts)]
#[instruction(bet_id: u64)]
pub struct CreateBet<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    #[account(address = config.usdc_mint @ PymError::WrongMint)]
    pub usdc_mint: Box<Account<'info, Mint>>,
    #[account(
        init,
        payer = creator,
        space = 8 + Bet::INIT_SPACE,
        seeds = [BET_SEED, creator.key().as_ref(), &bet_id.to_le_bytes()],
        bump
    )]
    pub bet: Box<Account<'info, Bet>>,
    #[account(
        init,
        payer = creator,
        seeds = [VAULT_SEED, bet.key().as_ref()],
        bump,
        token::mint = usdc_mint,
        token::authority = bet
    )]
    pub vault: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[allow(clippy::too_many_arguments)]
pub fn handle_create_bet(
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
    let now = Clock::get()?.unix_timestamp;
    let creator = ctx.accounts.creator.key();
    require!(creator_stake > 0 && opponent_stake > 0, PymError::InvalidStake);
    require_keys_neq!(opponent, creator, PymError::SelfBet);
    require!(opponent != Pubkey::default(), PymError::NotParticipant);
    require!(
        accept_deadline > now && event_deadline >= accept_deadline,
        PymError::InvalidDeadlines
    );
    validate_oracle(resolution, &oracle)?;
    creator_stake.checked_add(opponent_stake).ok_or(PymError::Overflow)?;

    let bet = &mut ctx.accounts.bet;
    bet.bet_id = bet_id;
    bet.creator = creator;
    bet.opponent = opponent;
    bet.creator_side = creator_side;
    bet.creator_stake = creator_stake;
    bet.opponent_stake = opponent_stake;
    bet.version = 1;
    bet.last_proposer = creator;
    bet.terms_hash = terms_hash;
    bet.resolution = resolution;
    bet.oracle = oracle;
    bet.created_at = now;
    bet.accept_deadline = accept_deadline;
    bet.funding_deadline = 0;
    bet.event_deadline = event_deadline;
    bet.resolve_deadline = resolve_deadline_for(event_deadline)?;
    bet.state = BetState::Proposed;
    bet.creator_funded = false;
    bet.opponent_funded = false;
    bet.proposed_outcome = None;
    bet.proposed_by = None;
    bet.winner = None;
    bet.resolved_value = None;
    bet.settled_at = 0;
    bet.bump = ctx.bumps.bet;
    bet.vault_bump = ctx.bumps.vault;

    emit!(BetCreated {
        bet: bet.key(),
        creator,
        opponent,
        creator_stake,
        opponent_stake,
    });
    Ok(())
}
