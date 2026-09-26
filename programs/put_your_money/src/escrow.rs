use anchor_lang::prelude::*;
use anchor_spl::token::{self, CloseAccount, Mint, Token, TokenAccount, TransferChecked};

use crate::{constants::BET_SEED, state::Bet};

/// Moves tokens out of a bet's vault, signing with the Bet PDA.
pub struct Escrow<'a, 'info> {
    pub token_program: &'a Program<'info, Token>,
    pub mint: &'a Account<'info, Mint>,
    pub vault: &'a Account<'info, TokenAccount>,
    pub bet_info: AccountInfo<'info>,
    pub creator: Pubkey,
    pub bet_id: u64,
    pub bump: u8,
}

impl<'a, 'info> Escrow<'a, 'info> {
    pub fn new(
        token_program: &'a Program<'info, Token>,
        mint: &'a Account<'info, Mint>,
        vault: &'a Account<'info, TokenAccount>,
        bet: &Account<'info, Bet>,
    ) -> Self {
        Self {
            token_program,
            mint,
            vault,
            bet_info: bet.to_account_info(),
            creator: bet.creator,
            bet_id: bet.bet_id,
            bump: bet.bump,
        }
    }

    pub fn pay(&self, to: &Account<'info, TokenAccount>, amount: u64) -> Result<()> {
        if amount == 0 {
            return Ok(());
        }
        let bet_id = self.bet_id.to_le_bytes();
        let bump = [self.bump];
        let seeds: &[&[u8]] = &[BET_SEED, self.creator.as_ref(), &bet_id, &bump];
        token::transfer_checked(
            CpiContext::new_with_signer(
                self.token_program.key(),
                TransferChecked {
                    from: self.vault.to_account_info(),
                    mint: self.mint.to_account_info(),
                    to: to.to_account_info(),
                    authority: self.bet_info.clone(),
                },
                &[seeds],
            ),
            amount,
            self.mint.decimals,
        )
    }

    /// Closes the (now empty) vault, returning its rent to the creator, who paid it.
    pub fn close(&self, rent_receiver: AccountInfo<'info>) -> Result<()> {
        close_vault(
            self.token_program,
            self.vault.to_account_info(),
            rent_receiver,
            self.bet_info.clone(),
            self.creator,
            self.bet_id,
            self.bump,
        )
    }

    /// Splits the vault back to the parties: the opponent gets their stake back if they funded,
    /// the creator gets everything else (their stake plus any stray tokens).
    pub fn refund(
        &self,
        bet: &Bet,
        creator_token: &Account<'info, TokenAccount>,
        opponent_token: &Account<'info, TokenAccount>,
    ) -> Result<(u64, u64)> {
        let total = self.vault.amount;
        let to_opponent = if bet.opponent_funded { bet.opponent_stake.min(total) } else { 0 };
        let to_creator = total - to_opponent;
        self.pay(creator_token, to_creator)?;
        self.pay(opponent_token, to_opponent)?;
        Ok((to_creator, to_opponent))
    }
}

pub fn close_vault<'info>(
    token_program: &Program<'info, Token>,
    vault: AccountInfo<'info>,
    rent_receiver: AccountInfo<'info>,
    bet_info: AccountInfo<'info>,
    creator: Pubkey,
    bet_id: u64,
    bump: u8,
) -> Result<()> {
    let bet_id = bet_id.to_le_bytes();
    let bump = [bump];
    let seeds: &[&[u8]] = &[BET_SEED, creator.as_ref(), &bet_id, &bump];
    token::close_account(CpiContext::new_with_signer(
        token_program.key(),
        CloseAccount { account: vault, destination: rent_receiver, authority: bet_info },
        &[seeds],
    ))
}
