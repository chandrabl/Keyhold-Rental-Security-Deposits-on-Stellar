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

echo "==> Deploying Contract 1..."
CONTRACT_1_ID=$(stellar contract deploy --wasm target/wasm32-unknown-unknown/release/contract_1.wasm --source $DEPLOYER --network testnet)
echo "Contract 1 deployed at: $CONTRACT_1_ID"

echo "==> Deploying Contract 2..."
CONTRACT_2_ID=$(stellar contract deploy --wasm target/wasm32-unknown-unknown/release/contract_2.wasm --source $DEPLOYER --network testnet)
echo "Contract 2 deployed at: $CONTRACT_2_ID"

echo ""
echo "=================================================="
echo " Deployment complete"
echo "=================================================="
echo " CONTRACT_1_ID: $CONTRACT_1_ID"
echo " CONTRACT_2_ID: $CONTRACT_2_ID"
echo "=================================================="
