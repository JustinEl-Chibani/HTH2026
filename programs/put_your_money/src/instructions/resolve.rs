use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};

use crate::{
    constants::*,
    error::PymError,
    escrow::Escrow,
    events::*,
    instructions::negotiate::Negotiate,
    state::*,
};

/// Pays the whole vault to the holder of `winner` and closes the vault.
#[allow(clippy::too_many_arguments)]
fn pay_winner<'info>(
    bet: &mut Account<'info, Bet>,
    token_program: &Program<'info, Token>,
    mint: &Account<'info, Mint>,
    vault: &Account<'info, TokenAccount>,
    creator: AccountInfo<'info>,
    creator_token: &Account<'info, TokenAccount>,
    opponent_token: &Account<'info, TokenAccount>,
    winner: Side,
    resolved_value: Option<i64>,
) -> Result<()> {
    let escrow = Escrow::new(token_program, mint, vault, bet);
    let amount = vault.amount;
    let winner_key = bet.holder_of(winner);
    let to = if winner_key == bet.creator { creator_token } else { opponent_token };
    escrow.pay(to, amount)?;
    escrow.close(creator)?;

    bet.state = BetState::Settled;
    bet.winner = Some(winner);
    bet.resolved_value = resolved_value;
    bet.settled_at = Clock::get()?.unix_timestamp;

    emit!(BetSettled {
        bet: bet.key(),
        winner_side: winner,
        winner: winner_key,
        amount,
        resolved_value,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct ResolveOracle<'info> {
    #[account(mut)]
    pub resolver: Signer<'info>,
    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
        constraint = config.resolver == resolver.key() @ PymError::NotResolver
    )]
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
        payer = resolver,
        associated_token::mint = usdc_mint,
        associated_token::authority = creator
    )]
    pub creator_token: Box<Account<'info, TokenAccount>>,
    #[account(
        init_if_needed,
        payer = resolver,
        associated_token::mint = usdc_mint,
        associated_token::authority = opponent
    )]
    pub opponent_token: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

/// Trusted-resolver settlement for price bets. The program still checks that the reported value is
/// consistent with the claimed winner, and that deadline-based conditions aren't resolved early.
pub fn handle_resolve_oracle(
    ctx: Context<ResolveOracle>,
    winner: Side,
    resolved_value: i64,
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let bet = &ctx.accounts.bet;
    require!(bet.state == BetState::Active, PymError::InvalidState);
    require!(bet.resolution == ResolutionKind::Oracle, PymError::NotOracleBet);
    let oracle = bet.oracle.ok_or(PymError::NotOracleBet)?;

    if oracle.is_touch() {
        match winner {
            // Early YES is allowed as soon as the threshold is touched.
            Side::Yes => require!(oracle.is_yes(resolved_value), PymError::OutcomeMismatch),
            // NO only once the window closed without a touch.
            Side::No => require!(now >= bet.event_deadline, PymError::EventNotOver),
        }
    } else {
        require!(now >= bet.event_deadline, PymError::EventNotOver);
        require!(
            oracle.is_yes(resolved_value) == (winner == Side::Yes),
            PymError::OutcomeMismatch
        );
    }

    let a = &mut *ctx.accounts;
    pay_winner(
        &mut a.bet,
        &a.token_program,
        &a.usdc_mint,
        &a.vault,
        a.creator.to_account_info(),
        &a.creator_token,
        &a.opponent_token,
        winner,
        Some(resolved_value),
    )
}

pub fn handle_propose_outcome(ctx: Context<Negotiate>, outcome: Outcome) -> Result<()> {
    let signer = ctx.accounts.signer.key();
    let bet = &mut ctx.accounts.bet;
    bet.require_participant(&signer)?;
    require!(bet.resolution == ResolutionKind::Mutual, PymError::NotMutualBet);
    require!(bet.state == BetState::Active, PymError::InvalidState);

    bet.state = BetState::AwaitingConfirmation;
    bet.proposed_outcome = Some(outcome);
    bet.proposed_by = Some(signer);

    emit!(OutcomeProposed { bet: bet.key(), by: signer, outcome });
    Ok(())
}

fn check_can_answer_outcome(bet: &Bet, signer: &Pubkey) -> Result<()> {
    bet.require_participant(signer)?;
    require!(bet.state == BetState::AwaitingConfirmation, PymError::InvalidState);
    require!(bet.proposed_by != Some(*signer), PymError::OwnOutcome);
    Ok(())
}

pub fn handle_reject_outcome(ctx: Context<Negotiate>) -> Result<()> {
    let signer = ctx.accounts.signer.key();
    let bet = &mut ctx.accounts.bet;
    check_can_answer_outcome(bet, &signer)?;

    bet.state = BetState::Active;
    bet.proposed_outcome = None;
    bet.proposed_by = None;

    emit!(OutcomeRejected { bet: bet.key(), by: signer });
    Ok(())
}

#[derive(Accounts)]
pub struct ConfirmOutcome<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
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
        payer = signer,
        associated_token::mint = usdc_mint,
        associated_token::authority = creator
    )]
    pub creator_token: Box<Account<'info, TokenAccount>>,
    #[account(
        init_if_needed,
        payer = signer,
        associated_token::mint = usdc_mint,
        associated_token::authority = opponent
    )]
    pub opponent_token: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

/// The other participant agrees with the proposed outcome: pay the winner, or refund both on Void.
pub fn handle_confirm_outcome(ctx: Context<ConfirmOutcome>) -> Result<()> {
    let signer = ctx.accounts.signer.key();
    check_can_answer_outcome(&ctx.accounts.bet, &signer)?;
    let outcome = ctx.accounts.bet.proposed_outcome.ok_or(PymError::InvalidState)?;

    let a = &mut *ctx.accounts;
    match outcome {
        Outcome::Yes | Outcome::No => {
            let winner = if outcome == Outcome::Yes { Side::Yes } else { Side::No };
            pay_winner(
                &mut a.bet,
                &a.token_program,
                &a.usdc_mint,
                &a.vault,
                a.creator.to_account_info(),
                &a.creator_token,
                &a.opponent_token,
                winner,
                None,
            )
        }
        Outcome::Void => {
            let escrow = Escrow::new(&a.token_program, &a.usdc_mint, &a.vault, &a.bet);
            let (refunded_creator, refunded_opponent) =
                escrow.refund(&a.bet, &a.creator_token, &a.opponent_token)?;
            escrow.close(a.creator.to_account_info())?;
            a.bet.state = BetState::Void;
            a.bet.settled_at = Clock::get()?.unix_timestamp;
            emit!(BetVoided { bet: a.bet.key(), refunded_creator, refunded_opponent });
            Ok(())
        }
    }
}
