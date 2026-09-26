use {
    anchor_lang::{
        prelude::{Clock, Pubkey},
        solana_program::{instruction::Instruction, system_program},
        AccountDeserialize, InstructionData, ToAccountMetas,
    },
    anchor_spl::{associated_token, associated_token::get_associated_token_address, token},
    litesvm::{
        types::{FailedTransactionMetadata, TransactionMetadata},
        LiteSVM,
    },
    litesvm_token::{spl_token::state::Account as SplAccount, CreateAssociatedTokenAccount, CreateMint, MintTo},
    put_your_money::{
        error::PymError,
        state::{Bet, BetState, ConditionKind, FeedId, OracleCondition, Outcome, ResolutionKind, Side},
        BET_SEED, CONFIG_SEED, VAULT_SEED,
    },
    solana_keypair::Keypair,
    solana_message::{Message, VersionedMessage},
    solana_signer::Signer,
    solana_transaction::versioned::VersionedTransaction,
    anchor_lang::solana_program::program_pack::Pack,
};

const USDC: u64 = 1_000_000;
const START_BALANCE: u64 = 1_000 * USDC;
const HOUR: i64 = 3600;

type TxResult = Result<TransactionMetadata, FailedTransactionMetadata>;

struct H {
    svm: LiteSVM,
    #[allow(dead_code)]
    admin: Keypair,
    resolver: Keypair,
    mint_auth: Keypair,
    mint: Pubkey,
    alice: Keypair,
    bob: Keypair,
    eve: Keypair,
    next_id: u64,
}

fn pid() -> Pubkey {
    put_your_money::id()
}

fn config_pda() -> Pubkey {
    Pubkey::find_program_address(&[CONFIG_SEED], &pid()).0
}

fn bet_pda(creator: &Pubkey, id: u64) -> Pubkey {
    Pubkey::find_program_address(&[BET_SEED, creator.as_ref(), &id.to_le_bytes()], &pid()).0
}

fn vault_pda(bet: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[VAULT_SEED, bet.as_ref()], &pid()).0
}

fn ix(data: impl InstructionData, accounts: impl ToAccountMetas) -> Instruction {
    Instruction::new_with_bytes(pid(), &data.data(), accounts.to_account_metas(None))
}

fn sol_price(usd: i64) -> i64 {
    usd * 1_000_000
}

impl H {
    fn new() -> H {
        let mut svm = LiteSVM::new();
        let bytes = include_bytes!(concat!(env!("CARGO_TARGET_TMPDIR"), "/../deploy/put_your_money.so"));
        svm.add_program(pid(), bytes).unwrap();

        let admin = Keypair::new();
        let resolver = Keypair::new();
        let mint_auth = Keypair::new();
        let alice = Keypair::new();
        let bob = Keypair::new();
        let eve = Keypair::new();
        for k in [&admin, &resolver, &mint_auth, &alice, &bob, &eve] {
            svm.airdrop(&k.pubkey(), 10_000_000_000).unwrap();
        }
        // Start the clock somewhere realistic.
        let mut clock: Clock = svm.get_sysvar();
        clock.unix_timestamp = 1_800_000_000;
        svm.set_sysvar(&clock);

        let mint = CreateMint::new(&mut svm, &mint_auth)
            .authority(&mint_auth.pubkey())
            .decimals(6)
            .send()
            .unwrap();
        for k in [&alice, &bob, &eve] {
            let ata = CreateAssociatedTokenAccount::new(&mut svm, &mint_auth, &mint)
                .owner(&k.pubkey())
                .send()
                .unwrap();
            MintTo::new(&mut svm, &mint_auth, &mint, &ata, START_BALANCE)
                .owner(&mint_auth)
                .send()
                .unwrap();
        }

        let mut h = H { svm, admin, resolver, mint_auth, mint, alice, bob, eve, next_id: 1 };
        let init = ix(
            put_your_money::instruction::InitializeConfig { resolver: h.resolver.pubkey() },
            put_your_money::accounts::InitializeConfig {
                admin: h.admin.pubkey(),
                config: config_pda(),
                usdc_mint: h.mint,
                system_program: system_program::ID,
            },
        );
        let admin = h.admin.insecure_clone();
        h.send(&[init], &[&admin]).unwrap();
        h
    }

    fn send(&mut self, ixs: &[Instruction], signers: &[&Keypair]) -> TxResult {
        self.svm.expire_blockhash();
        let blockhash = self.svm.latest_blockhash();
        let msg = Message::new_with_blockhash(ixs, Some(&signers[0].pubkey()), &blockhash);
        let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), signers).unwrap();
        self.svm.send_transaction(tx)
    }

    fn now(&self) -> i64 {
        self.svm.get_sysvar::<Clock>().unix_timestamp
    }

    fn warp(&mut self, secs: i64) {
        let mut clock: Clock = self.svm.get_sysvar();
        clock.unix_timestamp += secs;
        clock.slot += 1;
        self.svm.set_sysvar(&clock);
    }

    fn bet(&self, pda: &Pubkey) -> Bet {
        let acct = self.svm.get_account(pda).unwrap();
        Bet::try_deserialize(&mut acct.data.as_slice()).unwrap()
    }

    fn usdc(&self, owner: &Pubkey) -> u64 {
        let acct = self.svm.get_account(&get_associated_token_address(owner, &self.mint)).unwrap();
        SplAccount::unpack(&acct.data).unwrap().amount
    }

    fn account_exists(&self, key: &Pubkey) -> bool {
        self.svm.get_account(key).map(|a| a.lamports > 0).unwrap_or(false)
    }

    /// Alice (creator) proposes a bet to Bob. Returns the bet PDA.
    fn create(&mut self, spec: BetSpec) -> TxResult {
        let creator = spec.creator.insecure_clone();
        let id = self.next_id;
        self.next_id += 1;
        let bet = bet_pda(&creator.pubkey(), id);
        let now = self.now();
        let i = ix(
            put_your_money::instruction::CreateBet {
                bet_id: id,
                opponent: spec.opponent,
                creator_side: spec.creator_side,
                creator_stake: spec.creator_stake,
                opponent_stake: spec.opponent_stake,
                terms_hash: [7u8; 32],
                resolution: spec.resolution,
                oracle: spec.oracle,
                accept_deadline: now + spec.accept_in,
                event_deadline: now + spec.event_in,
            },
            put_your_money::accounts::CreateBet {
                creator: creator.pubkey(),
                config: config_pda(),
                usdc_mint: spec.mint.unwrap_or(self.mint),
                bet,
                vault: vault_pda(&bet),
                token_program: token::ID,
                system_program: system_program::ID,
            },
        );
        self.send(&[i], &[&creator])
    }

    fn create_ok(&mut self, spec: BetSpec) -> Pubkey {
        let id = self.next_id;
        let creator = spec.creator.pubkey();
        self.create(spec).expect("create_bet failed");
        bet_pda(&creator, id)
    }

    fn counter(&mut self, who: &Keypair, bet: Pubkey, v: u32, cs: u64, os: u64, side: Side) -> TxResult {
        let b = self.bet(&bet);
        let i = ix(
            put_your_money::instruction::CounterOffer {
                expected_version: v,
                creator_stake: cs,
                opponent_stake: os,
                creator_side: side,
                terms_hash: [9u8; 32],
                event_deadline: b.event_deadline,
                oracle: b.oracle,
            },
            put_your_money::accounts::Negotiate { signer: who.pubkey(), bet },
        );
        self.send(&[i], &[who])
    }

    fn accept(&mut self, who: &Keypair, bet: Pubkey, v: u32) -> TxResult {
        let i = ix(
            put_your_money::instruction::Accept { expected_version: v },
            put_your_money::accounts::Negotiate { signer: who.pubkey(), bet },
        );
        self.send(&[i], &[who])
    }

    fn fund(&mut self, who: &Keypair, bet: Pubkey) -> TxResult {
        self.fund_from(who, bet, get_associated_token_address(&who.pubkey(), &self.mint))
    }

    fn fund_from(&mut self, who: &Keypair, bet: Pubkey, funder_token: Pubkey) -> TxResult {
        let i = ix(
            put_your_money::instruction::Fund {},
            put_your_money::accounts::Fund {
                funder: who.pubkey(),
                config: config_pda(),
                usdc_mint: self.mint,
                bet,
                vault: vault_pda(&bet),
                funder_token,
                token_program: token::ID,
            },
        );
        self.send(&[i], &[who])
    }

    fn take(&mut self, who: &Keypair, bet: Pubkey, v: u32) -> TxResult {
        let i = ix(
            put_your_money::instruction::TakePublic { expected_version: v },
            put_your_money::accounts::TakePublic {
                taker: who.pubkey(),
                config: config_pda(),
                usdc_mint: self.mint,
                bet,
                vault: vault_pda(&bet),
                taker_token: get_associated_token_address(&who.pubkey(), &self.mint),
                token_program: token::ID,
            },
        );
        self.send(&[i], &[who])
    }

    fn cancel(&mut self, who: &Keypair, bet: Pubkey) -> TxResult {
        let b = self.bet(&bet);
        let i = ix(
            put_your_money::instruction::Cancel {},
            put_your_money::accounts::Cancel {
                signer: who.pubkey(),
                bet,
                vault: vault_pda(&bet),
                creator: b.creator,
                token_program: token::ID,
            },
        );
        self.send(&[i], &[who])
    }

    fn resolve(&mut self, who: &Keypair, bet: Pubkey, winner: Side, value: i64) -> TxResult {
        let b = self.bet(&bet);
        let i = ix(
            put_your_money::instruction::ResolveOracle { winner, resolved_value: value },
            put_your_money::accounts::ResolveOracle {
                resolver: who.pubkey(),
                config: config_pda(),
                usdc_mint: self.mint,
                bet,
                vault: vault_pda(&bet),
                creator: b.creator,
                opponent: b.opponent,
                creator_token: get_associated_token_address(&b.creator, &self.mint),
                opponent_token: get_associated_token_address(&b.opponent, &self.mint),
                token_program: token::ID,
                associated_token_program: associated_token::ID,
                system_program: system_program::ID,
            },
        );
        self.send(&[i], &[who])
    }

    fn propose(&mut self, who: &Keypair, bet: Pubkey, outcome: Outcome) -> TxResult {
        let i = ix(
            put_your_money::instruction::ProposeOutcome { outcome },
            put_your_money::accounts::Negotiate { signer: who.pubkey(), bet },
        );
        self.send(&[i], &[who])
    }

    fn reject(&mut self, who: &Keypair, bet: Pubkey) -> TxResult {
        let i = ix(
            put_your_money::instruction::RejectOutcome {},
            put_your_money::accounts::Negotiate { signer: who.pubkey(), bet },
        );
        self.send(&[i], &[who])
    }

    fn confirm(&mut self, who: &Keypair, bet: Pubkey) -> TxResult {
        let b = self.bet(&bet);
        let i = ix(
            put_your_money::instruction::ConfirmOutcome {},
            put_your_money::accounts::ConfirmOutcome {
                signer: who.pubkey(),
                config: config_pda(),
                usdc_mint: self.mint,
                bet,
                vault: vault_pda(&bet),
                creator: b.creator,
                opponent: b.opponent,
                creator_token: get_associated_token_address(&b.creator, &self.mint),
                opponent_token: get_associated_token_address(&b.opponent, &self.mint),
                token_program: token::ID,
                associated_token_program: associated_token::ID,
                system_program: system_program::ID,
            },
        );
        self.send(&[i], &[who])
    }

    fn refund_expired(&mut self, who: &Keypair, bet: Pubkey) -> TxResult {
        let b = self.bet(&bet);
        let i = ix(
            put_your_money::instruction::RefundExpired {},
            put_your_money::accounts::RefundExpired {
                payer: who.pubkey(),
                config: config_pda(),
                usdc_mint: self.mint,
                bet,
                vault: vault_pda(&bet),
                creator: b.creator,
                opponent: b.opponent,
                creator_token: get_associated_token_address(&b.creator, &self.mint),
                opponent_token: get_associated_token_address(&b.opponent, &self.mint),
                token_program: token::ID,
                associated_token_program: associated_token::ID,
                system_program: system_program::ID,
            },
        );
        self.send(&[i], &[who])
    }

    fn alice(&self) -> Keypair {
        self.alice.insecure_clone()
    }
    fn bob(&self) -> Keypair {
        self.bob.insecure_clone()
    }
    fn eve(&self) -> Keypair {
        self.eve.insecure_clone()
    }
    fn resolver(&self) -> Keypair {
        self.resolver.insecure_clone()
    }

    /// Default: Alice YES $10 vs Bob NO $50 that SOL is >= $250 at the deadline (2h out).
    fn spec(&self) -> BetSpec {
        BetSpec {
            creator: self.alice(),
            opponent: self.bob.pubkey(),
            creator_side: Side::Yes,
            creator_stake: 10 * USDC,
            opponent_stake: 50 * USDC,
            resolution: ResolutionKind::Oracle,
            oracle: Some(OracleCondition {
                feed: FeedId::SolUsd,
                kind: ConditionKind::AboveAt,
                threshold: sol_price(250),
            }),
            accept_in: HOUR,
            event_in: 2 * HOUR,
            mint: None,
        }
    }

    fn mutual_spec(&self) -> BetSpec {
        BetSpec { resolution: ResolutionKind::Mutual, oracle: None, ..self.spec() }
    }

    /// Create + accept + both fund → Active.
    fn active_bet(&mut self, spec: BetSpec) -> Pubkey {
        let (alice, bob) = (self.alice(), self.bob());
        let bet = self.create_ok(spec);
        self.accept(&bob, bet, 1).unwrap();
        self.fund(&alice, bet).unwrap();
        self.fund(&bob, bet).unwrap();
        assert_eq!(self.bet(&bet).state, BetState::Active);
        bet
    }
}

struct BetSpec {
    creator: Keypair,
    opponent: Pubkey,
    creator_side: Side,
    creator_stake: u64,
    opponent_stake: u64,
    resolution: ResolutionKind,
    oracle: Option<OracleCondition>,
    accept_in: i64,
    event_in: i64,
    mint: Option<Pubkey>,
}

fn custom_code(res: &TxResult) -> Option<u32> {
    use solana_transaction_error::TransactionError;
    match res {
        Err(f) => match &f.err {
            // InstructionError isn't re-exported anywhere convenient; parse "Custom(6012)".
            TransactionError::InstructionError(_, e) => format!("{e:?}")
                .strip_prefix("Custom(")
                .and_then(|s| s.strip_suffix(")"))
                .and_then(|s| s.parse().ok()),
            _ => None,
        },
        Ok(_) => None,
    }
}

fn assert_pym_err(res: TxResult, expected: PymError) {
    let want = expected as u32 + anchor_lang::error::ERROR_CODE_OFFSET;
    let got = custom_code(&res);
    assert_eq!(
        got,
        Some(want),
        "expected {:?} ({}), got {:?}\nlogs: {:#?}",
        expected,
        want,
        got,
        res.err().map(|e| e.meta.logs)
    );
}

// ---------------------------------------------------------------------------------------------

#[test]
fn happy_path_oracle_asymmetric_stakes() {
    let mut h = H::new();
    let (alice, bob, resolver) = (h.alice(), h.bob(), h.resolver());
    let bet = h.create_ok(h.spec());
    let b = h.bet(&bet);
    assert_eq!(b.state, BetState::Proposed);
    assert_eq!(b.version, 1);
    assert_eq!(b.last_proposer, alice.pubkey());

    h.accept(&bob, bet, 1).unwrap();
    assert_eq!(h.bet(&bet).state, BetState::Accepted);
    h.fund(&alice, bet).unwrap();
    assert_eq!(h.bet(&bet).state, BetState::Accepted);
    assert!(h.bet(&bet).creator_funded);
    h.fund(&bob, bet).unwrap();
    assert_eq!(h.bet(&bet).state, BetState::Active);
    assert_eq!(h.usdc(&alice.pubkey()), START_BALANCE - 10 * USDC);
    assert_eq!(h.usdc(&bob.pubkey()), START_BALANCE - 50 * USDC);

    // Can't fund twice.
    assert_pym_err(h.fund(&alice, bet), PymError::InvalidState);

    h.warp(2 * HOUR);
    h.resolve(&resolver, bet, Side::Yes, sol_price(251)).unwrap();
    let b = h.bet(&bet);
    assert_eq!(b.state, BetState::Settled);
    assert_eq!(b.winner, Some(Side::Yes));
    assert_eq!(b.resolved_value, Some(sol_price(251)));
    // Alice put in $10 and takes the $60 pot.
    assert_eq!(h.usdc(&alice.pubkey()), START_BALANCE + 50 * USDC);
    assert_eq!(h.usdc(&bob.pubkey()), START_BALANCE - 50 * USDC);
    assert!(!h.account_exists(&vault_pda(&bet)), "vault should be closed");
}

#[test]
fn counteroffer_chain_then_accept() {
    let mut h = H::new();
    let (alice, bob) = (h.alice(), h.bob());
    let bet = h.create_ok(h.spec());

    // Bob takes NO but wants $50 vs $50... then Alice counters back, then Bob accepts v3.
    h.counter(&bob, bet, 1, 50 * USDC, 50 * USDC, Side::Yes).unwrap();
    let b = h.bet(&bet);
    assert_eq!((b.version, b.last_proposer), (2, bob.pubkey()));
    assert_eq!(b.terms_hash, [9u8; 32]);

    // Bob can't counter his own offer.
    assert_pym_err(h.counter(&bob, bet, 2, 1, 1, Side::Yes), PymError::OwnProposal);

    h.counter(&alice, bet, 2, 20 * USDC, 50 * USDC, Side::Yes).unwrap();
    assert_eq!(h.bet(&bet).version, 3);

    h.accept(&bob, bet, 3).unwrap();
    let b = h.bet(&bet);
    assert_eq!(b.state, BetState::Accepted);
    assert_eq!((b.creator_stake, b.opponent_stake), (20 * USDC, 50 * USDC));
    assert!(b.funding_deadline > h.now());

    // No more counters once accepted.
    assert_pym_err(h.counter(&alice, bet, 3, 1, 1, Side::Yes), PymError::InvalidState);
}

#[test]
fn accepting_stale_version_fails() {
    let mut h = H::new();
    let (alice, bob) = (h.alice(), h.bob());
    let bet = h.create_ok(h.spec());
    h.counter(&bob, bet, 1, 10 * USDC, 5 * USDC, Side::Yes).unwrap();
    // Alice tries to accept the version she saw before Bob's counter.
    assert_pym_err(h.accept(&alice, bet, 1), PymError::VersionMismatch);
    // Countering a stale version also fails.
    assert_pym_err(h.counter(&alice, bet, 1, 1, 1, Side::No), PymError::VersionMismatch);
    h.accept(&alice, bet, 2).unwrap();
}

#[test]
fn last_proposer_cannot_accept_own_offer() {
    let mut h = H::new();
    let alice = h.alice();
    let bet = h.create_ok(h.spec());
    assert_pym_err(h.accept(&alice, bet, 1), PymError::OwnProposal);
}

#[test]
fn non_participant_cannot_accept_counter_or_fund() {
    let mut h = H::new();
    let (alice, bob, eve) = (h.alice(), h.bob(), h.eve());
    let bet = h.create_ok(h.spec());
    assert_pym_err(h.accept(&eve, bet, 1), PymError::NotParticipant);
    assert_pym_err(h.counter(&eve, bet, 1, 1, 1, Side::No), PymError::NotParticipant);
    h.accept(&bob, bet, 1).unwrap();
    assert_pym_err(h.fund(&eve, bet), PymError::NotParticipant);
    assert_pym_err(h.cancel(&eve, bet), PymError::NotParticipant);
    // Can't fund using someone else's token account either.
    let alice_ata = get_associated_token_address(&alice.pubkey(), &h.mint);
    assert!(h.fund_from(&bob, bet, alice_ata).is_err());
}

#[test]
fn mutual_propose_then_confirm_settles() {
    let mut h = H::new();
    let (alice, bob) = (h.alice(), h.bob());
    let bet = h.active_bet(h.mutual_spec());
    // Oracle-only ix is rejected for mutual bets.
    let resolver = h.resolver();
    assert_pym_err(h.resolve(&resolver, bet, Side::Yes, 1), PymError::NotOracleBet);

    // Bob (NO side) admits Alice won.
    h.propose(&bob, bet, Outcome::Yes).unwrap();
    let b = h.bet(&bet);
    assert_eq!(b.state, BetState::AwaitingConfirmation);
    assert_eq!(b.proposed_by, Some(bob.pubkey()));
    assert_pym_err(h.confirm(&bob, bet), PymError::OwnOutcome);

    h.confirm(&alice, bet).unwrap();
    let b = h.bet(&bet);
    assert_eq!(b.state, BetState::Settled);
    assert_eq!(b.winner, Some(Side::Yes));
    assert_eq!(h.usdc(&alice.pubkey()), START_BALANCE + 50 * USDC);
    assert_eq!(h.usdc(&bob.pubkey()), START_BALANCE - 50 * USDC);
}

#[test]
fn mutual_reject_returns_to_active() {
    let mut h = H::new();
    let (alice, bob) = (h.alice(), h.bob());
    let bet = h.active_bet(h.mutual_spec());
    h.propose(&alice, bet, Outcome::Yes).unwrap();
    h.reject(&bob, bet).unwrap();
    let b = h.bet(&bet);
    assert_eq!(b.state, BetState::Active);
    assert_eq!(b.proposed_outcome, None);
    // Bob proposes the other way; Alice agrees → Bob wins the pot.
    h.propose(&bob, bet, Outcome::No).unwrap();
    h.confirm(&alice, bet).unwrap();
    assert_eq!(h.bet(&bet).winner, Some(Side::No));
    assert_eq!(h.usdc(&bob.pubkey()), START_BALANCE + 10 * USDC);
}

#[test]
fn mutual_void_refunds_both() {
    let mut h = H::new();
    let (alice, bob) = (h.alice(), h.bob());
    let bet = h.active_bet(h.mutual_spec());
    h.propose(&alice, bet, Outcome::Void).unwrap();
    h.confirm(&bob, bet).unwrap();
    assert_eq!(h.bet(&bet).state, BetState::Void);
    assert_eq!(h.usdc(&alice.pubkey()), START_BALANCE);
    assert_eq!(h.usdc(&bob.pubkey()), START_BALANCE);
}

#[test]
fn funding_timeout_refunds_funded_side() {
    let mut h = H::new();
    let (alice, bob, eve) = (h.alice(), h.bob(), h.eve());
    let bet = h.create_ok(h.spec());
    h.accept(&bob, bet, 1).unwrap();
    h.fund(&alice, bet).unwrap();
    assert_pym_err(h.refund_expired(&eve, bet), PymError::NotExpired);

    h.warp(31 * 60);
    assert_pym_err(h.fund(&bob, bet), PymError::FundingDeadlinePassed);
    // Anyone can crank the refund.
    h.refund_expired(&eve, bet).unwrap();
    assert_eq!(h.bet(&bet).state, BetState::Expired);
    assert_eq!(h.usdc(&alice.pubkey()), START_BALANCE);
    assert_eq!(h.usdc(&bob.pubkey()), START_BALANCE);
    assert!(!h.account_exists(&vault_pda(&bet)));
}

#[test]
fn unresolved_past_deadline_refunds_both() {
    let mut h = H::new();
    let (alice, bob, eve) = (h.alice(), h.bob(), h.eve());
    let bet = h.active_bet(h.spec());
    h.warp(2 * HOUR + 1);
    assert_pym_err(h.refund_expired(&eve, bet), PymError::NotExpired);
    h.warp(48 * HOUR);
    h.refund_expired(&eve, bet).unwrap();
    assert_eq!(h.bet(&bet).state, BetState::Void);
    assert_eq!(h.usdc(&alice.pubkey()), START_BALANCE);
    assert_eq!(h.usdc(&bob.pubkey()), START_BALANCE);
}

#[test]
fn proposal_expires_after_accept_deadline() {
    let mut h = H::new();
    let (bob, eve) = (h.bob(), h.eve());
    let bet = h.create_ok(h.spec());
    h.warp(HOUR);
    assert_pym_err(h.accept(&bob, bet, 1), PymError::AcceptDeadlinePassed);
    h.refund_expired(&eve, bet).unwrap();
    assert_eq!(h.bet(&bet).state, BetState::Expired);
}

#[test]
fn non_resolver_cannot_resolve() {
    let mut h = H::new();
    let (alice, eve) = (h.alice(), h.eve());
    let bet = h.active_bet(h.spec());
    h.warp(2 * HOUR);
    assert_pym_err(h.resolve(&eve, bet, Side::Yes, sol_price(300)), PymError::NotResolver);
    assert_pym_err(h.resolve(&alice, bet, Side::Yes, sol_price(300)), PymError::NotResolver);
}

#[test]
fn oracle_resolution_rules() {
    let mut h = H::new();
    let (bob, resolver) = (h.bob(), h.resolver());
    // AboveAt: can't resolve before the deadline, and the winner must match the value.
    let bet = h.active_bet(h.spec());
    assert_pym_err(h.resolve(&resolver, bet, Side::Yes, sol_price(300)), PymError::EventNotOver);
    h.warp(2 * HOUR);
    assert_pym_err(h.resolve(&resolver, bet, Side::Yes, sol_price(200)), PymError::OutcomeMismatch);
    h.resolve(&resolver, bet, Side::No, sol_price(200)).unwrap();
    assert_eq!(h.usdc(&bob.pubkey()), START_BALANCE + 10 * USDC);

    // TouchAbove: early YES allowed once touched; early NO is not.
    let mut spec = h.spec();
    spec.oracle = Some(OracleCondition {
        feed: FeedId::BtcUsd,
        kind: ConditionKind::TouchAbove,
        threshold: sol_price(100_000),
    });
    let bet = h.active_bet(spec);
    assert_pym_err(h.resolve(&resolver, bet, Side::No, sol_price(90_000)), PymError::EventNotOver);
    assert_pym_err(h.resolve(&resolver, bet, Side::Yes, sol_price(99_999)), PymError::OutcomeMismatch);
    h.resolve(&resolver, bet, Side::Yes, sol_price(100_001)).unwrap();
    assert_eq!(h.bet(&bet).state, BetState::Settled);
}

#[test]
fn wrong_mint_rejected() {
    let mut h = H::new();
    let (alice, bob) = (h.alice(), h.bob());
    let mint_auth = h.mint_auth.insecure_clone();
    let fake = CreateMint::new(&mut h.svm, &mint_auth)
        .authority(&mint_auth.pubkey())
        .decimals(6)
        .send()
        .unwrap();
    let mut spec = h.spec();
    spec.mint = Some(fake);
    assert_pym_err(h.create(spec), PymError::WrongMint);

    // Funding from a token account of the wrong mint fails too.
    let bet = h.create_ok(h.spec());
    h.accept(&bob, bet, 1).unwrap();
    let fake_ata = CreateAssociatedTokenAccount::new(&mut h.svm, &mint_auth, &fake)
        .owner(&alice.pubkey())
        .send()
        .unwrap();
    MintTo::new(&mut h.svm, &mint_auth, &fake, &fake_ata, START_BALANCE)
        .owner(&mint_auth)
        .send()
        .unwrap();
    assert!(h.fund_from(&alice, bet, fake_ata).is_err());
    assert!(!h.bet(&bet).creator_funded);
}

#[test]
fn create_validation_and_cancel() {
    let mut h = H::new();
    let (alice, bob) = (h.alice(), h.bob());

    let mut s = h.spec();
    s.creator_stake = 0;
    assert_pym_err(h.create(s), PymError::InvalidStake);
    let mut s = h.spec();
    s.opponent = alice.pubkey();
    assert_pym_err(h.create(s), PymError::SelfBet);
    let mut s = h.spec();
    s.event_in = HOUR / 2; // before the accept deadline
    assert_pym_err(h.create(s), PymError::InvalidDeadlines);
    let mut s = h.spec();
    s.oracle = None;
    assert_pym_err(h.create(s), PymError::InvalidOracle);
    let mut s = h.mutual_spec();
    s.oracle = h.spec().oracle;
    assert_pym_err(h.create(s), PymError::InvalidOracle);

    // Opponent declines.
    let bet = h.create_ok(h.spec());
    h.cancel(&bob, bet).unwrap();
    assert_eq!(h.bet(&bet).state, BetState::Cancelled);
    assert!(!h.account_exists(&vault_pda(&bet)));
    assert_pym_err(h.accept(&bob, bet, 1), PymError::InvalidState);

    // Can't cancel once accepted.
    let bet = h.create_ok(h.spec());
    h.accept(&bob, bet, 1).unwrap();
    assert_pym_err(h.cancel(&alice, bet), PymError::InvalidState);
}

#[test]
fn public_oracle_bet_taken_by_stranger() {
    let mut h = H::new();
    let (alice, bob, eve, resolver) = (h.alice(), h.bob(), h.eve(), h.resolver());
    let mut spec = h.spec();
    spec.opponent = Pubkey::default(); // open to anyone
    let bet = h.create_ok(spec);
    assert_eq!(h.bet(&bet).opponent, Pubkey::default());

    // Nobody can accept/counter an open bet; the creator can't take their own.
    assert_pym_err(h.accept(&bob, bet, 1), PymError::NotParticipant);
    assert_pym_err(h.counter(&bob, bet, 1, 1, 1, Side::No), PymError::NotParticipant);
    assert_pym_err(h.take(&alice, bet, 1), PymError::SelfBet);
    assert_pym_err(h.take(&eve, bet, 2), PymError::VersionMismatch);

    // Eve (not a friend, just anyone) takes it: becomes opponent and funds $50 atomically.
    h.take(&eve, bet, 1).unwrap();
    let b = h.bet(&bet);
    assert_eq!(b.opponent, eve.pubkey());
    assert_eq!(b.state, BetState::Accepted);
    assert!(b.opponent_funded && !b.creator_funded);
    assert_eq!(h.usdc(&eve.pubkey()), START_BALANCE - 50 * USDC);

    // First taker wins.
    assert_pym_err(h.take(&bob, bet, 1), PymError::NotPublic);

    // Creator funds → Active → resolves like any other bet; Eve (NO) wins the $60.
    h.fund(&alice, bet).unwrap();
    assert_eq!(h.bet(&bet).state, BetState::Active);
    h.warp(2 * HOUR);
    h.resolve(&resolver, bet, Side::No, sol_price(200)).unwrap();
    assert_eq!(h.usdc(&eve.pubkey()), START_BALANCE + 10 * USDC);
}

#[test]
fn public_bet_rules() {
    let mut h = H::new();
    let (alice, eve) = (h.alice(), h.eve());

    // "We agree" bets can't be public.
    let mut s = h.mutual_spec();
    s.opponent = Pubkey::default();
    assert_pym_err(h.create(s), PymError::PublicMustBeOracle);

    // Directed bets can't be taken by a third party.
    let directed = h.create_ok(h.spec());
    assert_pym_err(h.take(&eve, directed, 1), PymError::NotPublic);

    // Creator can withdraw an untaken public bet.
    let mut s = h.spec();
    s.opponent = Pubkey::default();
    let open = h.create_ok(s);
    h.cancel(&alice, open).unwrap();
    assert_eq!(h.bet(&open).state, BetState::Cancelled);

    // Can't take after the accept deadline.
    let mut s = h.spec();
    s.opponent = Pubkey::default();
    let late = h.create_ok(s);
    h.warp(HOUR);
    assert_pym_err(h.take(&eve, late, 1), PymError::AcceptDeadlinePassed);

    // Taker whose creator never funds gets refunded when funding times out.
    h.warp(-HOUR);
    let mut s = h.spec();
    s.opponent = Pubkey::default();
    s.accept_in = 3 * HOUR;
    s.event_in = 4 * HOUR;
    let stalled = h.create_ok(s);
    h.take(&eve, stalled, 1).unwrap();
    h.warp(31 * 60);
    h.refund_expired(&eve, stalled).unwrap();
    assert_eq!(h.bet(&stalled).state, BetState::Expired);
    assert_eq!(h.usdc(&eve.pubkey()), START_BALANCE);
}
