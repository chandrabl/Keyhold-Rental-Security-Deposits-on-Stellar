# Deployment Guide

Deploying both contracts to Stellar testnet and wiring up the frontend
takes about 15–20 minutes. Do this yourself — the addresses and
transaction hash the competition checklist asks for need to come from a
real deployment.

## 0. Prerequisites

```bash
rustup target add wasm32-unknown-unknown
cargo install --locked soroban-cli --features opt
node --version   # 20+
```

Install the [Freighter wallet extension](https://freighter.app) and switch
its network to **Testnet**.

## 1. Create and fund a deployer identity

```bash
soroban keys generate deployer --network testnet
soroban keys fund deployer --network testnet
soroban keys address deployer
```

## 2. Build the contracts

```bash
cargo build --target wasm32-unknown-unknown --release
```

Produces:
- `target/wasm32-unknown-unknown/release/inspection.wasm`
- `target/wasm32-unknown-unknown/release/deposit.wasm`

## 3. Deploy the Inspection contract

```bash
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/inspection.wasm \
  --source deployer \
  --network testnet
```

Save the printed ID as `INSPECTION_ID`, then initialize (you become the
first trusted inspector):

```bash
soroban contract invoke \
  --id $INSPECTION_ID \
  --source deployer \
  --network testnet \
  -- initialize --admin $(soroban keys address deployer)
```

## 4. Deploy the Deposit contract

```bash
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/deposit.wasm \
  --source deployer \
  --network testnet
```

Save the printed ID as `DEPOSIT_ID`, then initialize, pointing it at the
Inspection contract:

```bash
soroban contract invoke \
  --id $DEPOSIT_ID \
  --source deployer \
  --network testnet \
  -- initialize \
  --admin $(soroban keys address deployer) \
  --inspection_contract $INSPECTION_ID
```

## 5. Get a test token

```bash
soroban contract asset deploy \
  --asset native \
  --source deployer \
  --network testnet
```

Save the printed address as `TOKEN_ID`.

## 6. Create and fund a lease (for your transaction hash)

```bash
soroban keys generate tenant --network testnet
soroban keys fund tenant --network testnet
```

Draft a short lease so you can demo the full flow quickly (a real lease
would use a longer `lease_end`; here we use a near-future timestamp for
demo purposes — replace with a real Unix timestamp):

```bash
soroban contract invoke \
  --id $DEPOSIT_ID \
  --source deployer \
  --network testnet \
  -- create_lease \
  --landlord $(soroban keys address deployer) \
  --tenant $(soroban keys address tenant) \
  --token $TOKEN_ID \
  --deposit_amount 1000000000 \
  --lease_end <UNIX_TIMESTAMP_A_FEW_MINUTES_FROM_NOW> \
  --claim_window_seconds 300
```

This returns a `lease_id` (starts at 0). Fund it:

```bash
soroban contract invoke \
  --id $DEPOSIT_ID \
  --source tenant \
  --network testnet \
  -- fund_deposit \
  --tenant $(soroban keys address tenant) \
  --lease_id 0
```

The CLI output includes the transaction hash — this is your submission's
required transaction hash.

## 7. Configure the frontend

```bash
cd frontend
cp .env.example .env
```

Fill in:

```
VITE_DEPOSIT_CONTRACT_ID=<DEPOSIT_ID>
VITE_INSPECTION_CONTRACT_ID=<INSPECTION_ID>
VITE_TOKEN_CONTRACT_ID=<TOKEN_ID>
```

```bash
npm install
npm run dev
```

## 8. Deploy to Vercel

```bash
npm install -g vercel
cd frontend
vercel
```

Set the same `VITE_*` variables in **Settings → Environment Variables**,
then redeploy.

## Checklist mapping

| Item | Where to get it |
|---|---|
| Contract deployment address | `$DEPOSIT_ID` and `$INSPECTION_ID` from steps 3–4 |
| Transaction hash | Output of the `fund_deposit` call in step 6 |
| Live demo link | Your Vercel deployment URL |
| CI/CD screenshot | Green checks on the GitHub Actions tab |
| Test output screenshot | `cargo test --workspace` and `npm test` in your terminal |
| Mobile UI screenshot | Vercel URL on your phone, or dev tools device toolbar |
