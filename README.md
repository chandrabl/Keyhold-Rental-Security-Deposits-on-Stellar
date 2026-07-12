# Keyhold — Rental Security Deposits on Stellar

An on-chain rental deposit manager built on Soroban. A tenant funds a
security deposit for a fixed lease term. If the landlord files no damage
claim within the claim window after the lease ends, the deposit
**auto-releases** to the tenant — no landlord discretion required. If a
claim is filed, a **separate Inspection contract** — not the landlord —
rules on how much is actually forfeited.

> Built for Stellar Level 3 (Orange Belt) — advanced smart contracts,
> production dApp architecture, CI/CD, and real-time event streaming.

---

## Why this shape of project

A landlord being the sole judge of their own damage claim is a structural
conflict of interest that most escrow-style demos don't model. This
project treats the deposit contract and the claims-adjudication contract
as genuinely separate systems: Deposit never decides *how much* is
forfeited, it only knows how to ask Inspection for a ruling — by dollar
amount, not a fixed status — and execute whatever split comes back. It
also leans on Soroban's on-chain ledger timestamp for real time-gating
(lease end, claim window) rather than any off-chain clock.

## How it works

1. **Landlord drafts lease terms** — tenant, token, deposit amount, lease
   end date, and a claim window (how long after lease end they have to
   file a claim).
2. **Tenant reviews and funds** the deposit, activating the lease.
3. **At lease end**, if the landlord files no claim within the window,
   **anyone** can call `release_deposit` to return the full deposit to the
   tenant.
4. **If the landlord files a claim** instead (with a claimed amount and
   reason), it escalates to the Inspection contract via a cross-contract
   call.
5. **A trusted inspector rules** on how much of the claimed amount is
   justified.
6. **Anyone can call `settle_claim`** afterward — it reads the ruling back
   from Inspection and splits the deposit: the ruled amount to the
   landlord, the remainder back to the tenant.

Every step emits an event, streamed live into the frontend's case log; a
live per-lease countdown shows "lease ends in 3d 4h" and "claim window
closes in 6d 22h" ticking down against on-chain timestamps. See
[ARCHITECTURE.md](./ARCHITECTURE.md) for the full diagram and event table.

## Tech stack

| Layer | Choice |
|---|---|
| Smart contracts | Rust + Soroban SDK 21 |
| Token standard | SEP-41 (Stellar Asset Contract compatible) |
| Frontend | React 18 + Vite + Tailwind CSS |
| Wallet | Freighter |
| Testing | `cargo test` (contracts), Vitest + Testing Library (frontend) |
| CI/CD | GitHub Actions |
| Hosting | Vercel |

## Project structure

```
keyhold/
├── contracts/
│   ├── deposit/          # lease terms, fund custody, time-gated release
│   └── inspection/        # standalone claim arbitration by trusted panel
├── frontend/               # React app
├── .github/workflows/      # CI/CD pipeline
├── ARCHITECTURE.md          # contract design, state machine, event table
└── DEPLOYMENT.md            # step-by-step testnet deployment guide
```

## Running locally

### Contracts

```bash
rustup target add wasm32-unknown-unknown
cargo test --workspace
cargo build --release --target wasm32-unknown-unknown
```

### Frontend

```bash
cd frontend
npm install
npm test
npm run lint
npm run dev
```

By default the frontend runs with no contract addresses configured and
shows a clear banner saying so — see [DEPLOYMENT.md](./DEPLOYMENT.md) for
deploying your own instance to testnet.

## Testing

- **Contracts:** 26 tests across both contracts — lease draft/fund/cancel
  lifecycle, claim-window timing edge cases (before lease end, after
  window close), the full claim-and-settlement flow with a partial
  forfeit, a claim still pending ruling, and authorization checks (only
  the tenant can fund, only the landlord can file a claim, forfeit can
  never exceed the claimed amount).
- **Frontend:** 15 tests covering event-label formatting, the live
  countdown hook, and the key-status component.

Run `cargo test --workspace` and `cd frontend && npm test` locally, or
check the **Actions** tab on GitHub for CI runs.

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for deploying both contracts to
Stellar testnet, wiring up a test token, and deploying the frontend to
Vercel.

**Live demo:** _add your Vercel URL here after deploying_
**Deposit contract:** _add your deployed contract ID here_
**Inspection contract:** _add your deployed contract ID here_
**Example transaction:** _add a transaction hash from a real interaction here_

## Screenshots

_Add screenshots here after deploying:_
- Mobile responsive UI
- CI/CD pipeline passing (GitHub Actions tab)
- Test output showing passing tests (`cargo test --workspace` and `npm test`)

## Demo video

_Add your 1–2 minute demo video link here._

## License

MIT
