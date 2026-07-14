#!/bin/bash
set -e

echo "==> Building contracts..."
stellar contract build

# Ensure deployer keys exist
if ! stellar keys ls | grep -q "deployer"; then
    echo "Generating deployer keys..."
    stellar keys generate deployer --network testnet --fund
fi

DEPLOYER="deployer"

echo "==> Deploying Deposit Contract..."
DEPOSIT_ID=$(stellar contract deploy --wasm target/wasm32v1-none/release/deposit.wasm --source $DEPLOYER --network testnet)
echo "Deposit Contract deployed at: $DEPOSIT_ID"

echo "==> Deploying Inspection Contract..."
INSPECTION_ID=$(stellar contract deploy --wasm target/wasm32v1-none/release/inspection.wasm --source $DEPLOYER --network testnet)
echo "Inspection Contract deployed at: $INSPECTION_ID"

echo ""
echo "=================================================="
echo " Deployment complete"
echo "=================================================="
echo " VITE_DEPOSIT_CONTRACT_ID: $DEPOSIT_ID"
echo " VITE_INSPECTION_CONTRACT_ID: $INSPECTION_ID"
echo "=================================================="
