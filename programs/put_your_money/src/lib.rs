use anchor_lang::prelude::*;

declare_id!("9gCvDMSSSqsCARyrubQTwUcC88U52YvM7CCd1zuUGZiG");

#[program]
pub mod put_your_money {
    use super::*;

    pub fn ping(_ctx: Context<Ping>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Ping {}
