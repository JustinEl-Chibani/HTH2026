use anchor_lang::prelude::*;

#[error_code]
pub enum PymError {
    #[msg("Stakes must be greater than zero")]
    InvalidStake,
    #[msg("You can't bet against yourself")]
    SelfBet,
    #[msg("Deadlines must be in the future and in order")]
    InvalidDeadlines,
    #[msg("Oracle condition must be set for oracle bets and only for oracle bets")]
    InvalidOracle,
    #[msg("Only the two participants can do that")]
    NotParticipant,
    #[msg("The bet is not in the right state for that")]
    InvalidState,
    #[msg("The offer changed; refresh to see the latest terms")]
    VersionMismatch,
    #[msg("You can't accept or counter your own offer")]
    OwnProposal,
    #[msg("The offer has expired")]
    AcceptDeadlinePassed,
    #[msg("The funding window has closed")]
    FundingDeadlinePassed,
    #[msg("You have already funded this bet")]
    AlreadyFunded,
    #[msg("Only the configured resolver can resolve oracle bets")]
    NotResolver,
    #[msg("This bet is not resolved by an oracle")]
    NotOracleBet,
    #[msg("This bet is resolved by mutual agreement")]
    NotMutualBet,
    #[msg("The event deadline has not passed yet")]
    EventNotOver,
    #[msg("The reported value does not support that outcome")]
    OutcomeMismatch,
    #[msg("You can't confirm your own proposed outcome")]
    OwnOutcome,
    #[msg("Nothing to refund yet")]
    NotExpired,
    #[msg("Only the admin can do that")]
    NotAdmin,
    #[msg("That token is not the configured USDC mint")]
    WrongMint,
    #[msg("Only price-oracle bets can be open to anyone")]
    PublicMustBeOracle,
    #[msg("This bet is not open for anyone to take")]
    NotPublic,
    #[msg("Math overflow")]
    Overflow,
}
