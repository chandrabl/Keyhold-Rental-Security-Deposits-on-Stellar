# Architecture

## Why two contracts

A landlord ruling on their own damage claim is an obvious conflict of
interest. This project splits fund custody from claim adjudication:

```
┌──────────────────┐  file_claim() / get_claim()   ┌───────────────────────┐
│ Deposit Contract   │ ──────────────────────────────▶│ Inspection Contract    │
│ - lease terms       │                                │ - inspector panel       │
│ - holds funds       │◀──────────────────────────────│ - claim + ruling record  │
│ - time-gated release│      returns forfeit ruling     │                        │
└──────────┬─────────┘                                └───────────────────────┘
           │ cross-contract call
           ▼
┌──────────────────┐
│  Token Contract    │  (SEP-41 / Stellar Asset Contract)
│  - transfer()        │
└──────────────────┘
```

- **Deposit** owns the lease lifecycle and all fund custody. It never
  decides how much of a deposit is forfeited — it only knows how to ask
  Inspection for a ruling and execute whatever split comes back.
- **Inspection** never touches funds. It records claims and rulings by
  *amount* (not by a fixed outcome enum like "favor landlord/tenant"),
  which more naturally models a $250-out-of-$400 partial-damage ruling than
  a status-based dispute would.
- A single Inspection contract with a trusted panel could, in principle,
  rule on claims across many independent Deposit contract deployments —
  much like a real property manager might use one inspection service
  across many buildings.

## State machine

**Lease status:** `Draft` (landlord terms only, no funds) →
`Funded` (tenant paid in) → either:
- `Released` (claim window closed with no claim filed), or
- `Disputed` (landlord filed a claim) → `Settled` (Inspection ruled, funds split)

`Draft` can also go directly to `Cancelled` if the landlord withdraws
before the tenant funds it.

## Time-gating

Three points in time matter, all derived from `env.ledger().timestamp()`
with no oracle or off-chain clock:

1. **`lease_end`** — the claim can't be filed before this.
2. **`lease_end + claim_window_seconds`** — the claim can't be filed after
   this; and `release_deposit` can't succeed *before* this (the landlord
   still has a chance to file).
3. Once past window close with no claim on record, `release_deposit`
   becomes callable by anyone — this is the "auto-release" behavior parallel
   to Tollgate's auto-charge-or-cancel logic, but here it's a one-time
   release rather than a recurring cycle.

## Events (the "real-time" layer)

| Event topics | Emitted when |
|---|---|
| `lease, created` | Landlord drafts lease terms |
| `lease, funded` | Tenant pays the deposit in |
| `lease, cancel` | Landlord withdraws an unfunded draft |
| `lease, claimed` | Landlord files a damage claim |
| `lease, released` | Deposit auto-releases to tenant |
| `lease, settled` | Deposit splits per an inspector's ruling |
| `claim, filed` | Inspection contract records the claim |
| `claim, resolved` | Inspection contract records a ruling |
| `inspect, added` | A new inspector joins the panel |

The frontend polls `getEvents` (`useEventStream`) and separately ticks a
live per-lease countdown (`useCountdown`) against the on-chain `lease_end`
and claim-window-close timestamps — "lease ends in 3d 4h", "claim window
closes in 6d 22h" — entirely client-side between polls.

## Frontend structure

```
frontend/src/
├── lib/
│   ├── config.js            # env-driven contract addresses & network config
│   ├── wallet.js              # Freighter wallet integration
│   ├── sorobanClient.js        # low-level build/simulate/sign/submit
│   ├── depositActions.js       # typed wrappers per contract method
│   ├── events.js                # getEvents polling with ledger cursor
│   └── formatEvent.js           # pure event -> label mapping (unit tested)
├── hooks/
│   ├── useWallet.js
│   ├── useEventStream.js
│   └── useCountdown.js          # live "time until" ticker for lease milestones
└── components/                  # presentational, mobile-first with Tailwind
```

## Security notes

- `create_lease`, `cancel_lease`, `fund_deposit`, and `file_claim` all call
  `require_auth()` on the relevant party.
- `release_deposit` and `settle_claim` are intentionally open to any
  caller — the payout logic is fully determined by on-chain state (elapsed
  time, or a stored ruling) rather than by who calls the function, so
  there's no way to game the outcome by controlling who triggers it.
- The Inspection panel is closed by default (only the address that called
  `initialize` is trusted) and grows only via `add_inspector`, itself
  gated on the stored admin address.
- Claims can't be filed twice concurrently (`ClaimAlreadyOpen`) or ruled
  twice (`ClaimAlreadyRuled`), and a ruling's forfeit amount can never
  exceed the claimed amount (`ForfeitExceedsClaim`) — defense in depth
  against a compromised or careless inspector over-forfeiting.
