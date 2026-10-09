#!/usr/bin/env bash
# ==============================================================================
# SoroStream: Soroban Testnet Deployment & Auto-Funding Automation Script
# Issue #4 Deliverable: Compile WASM, fund deployer via Friendbot, deploy & init
# ==============================================================================

set -euo pipefail

NETWORK="testnet"
RPC_URL="https://soroban-testnet.stellar.org"
FRIENDBOT_URL="https://friendbot.stellar.org"
NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
IDENTITY_NAME="${IDENTITY_NAME:-sorostream-admin}"
CONTRACT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../contracts/vesting_stream" && pwd)"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "=========================================================="
echo "  SoroStream Testnet Deployment Pipeline"
echo "  Network: ${NETWORK}"
echo "  Identity: ${IDENTITY_NAME}"
echo "=========================================================="

# 1. Verify stellar-cli installation
if command -v stellar &> /dev/null; then
    STELLAR_BIN="stellar"
elif command -v soroban &> /dev/null; then
    STELLAR_BIN="soroban"
elif [ -f "${HOME}/.cargo/bin/stellar" ]; then
    STELLAR_BIN="${HOME}/.cargo/bin/stellar"
else
    echo "[-] Error: 'stellar' or 'soroban' CLI is not found in PATH."
    echo "    Install via: cargo install --locked stellar-cli --features opt"
    exit 1
fi

echo "[+] Using CLI: $(${STELLAR_BIN} --version | head -n 1)"

# 2. Configure network in CLI if not already registered
echo "[*] Configuring '${NETWORK}' network profile..."
${STELLAR_BIN} network add \
    --global "${NETWORK}" \
    --rpc-url "${RPC_URL}" \
    --network-passphrase "${NETWORK_PASSPHRASE}" 2>/dev/null || true

# 3. Setup deployer identity & Auto-fund via Friendbot
echo "[*] Checking identity '${IDENTITY_NAME}'..."
if ! ${STELLAR_BIN} keys show "${IDENTITY_NAME}" &>/dev/null; then
    echo "[+] Generating new identity '${IDENTITY_NAME}' and funding via Friendbot..."
    ${STELLAR_BIN} keys generate "${IDENTITY_NAME}" --network "${NETWORK}" --fund
else
    DEPLOYER_PUBKEY=$(${STELLAR_BIN} keys address "${IDENTITY_NAME}")
    echo "[+] Found identity '${IDENTITY_NAME}' with address: ${DEPLOYER_PUBKEY}"
    echo "[*] Requesting Friendbot top-up for ${DEPLOYER_PUBKEY}..."
    curl -s -X POST "${FRIENDBOT_URL}?addr=${DEPLOYER_PUBKEY}" > /dev/null || true
fi

DEPLOYER_PUBKEY=$(${STELLAR_BIN} keys address "${IDENTITY_NAME}")
echo "[+] Deployer Address: ${DEPLOYER_PUBKEY}"

# 4. Compile the smart contract to WASM
echo "[*] Building vesting_stream WASM..."
cd "${CONTRACT_DIR}"
${STELLAR_BIN} contract build

WASM_FILE="${CONTRACT_DIR}/target/wasm32-unknown-unknown/release/vesting_stream.wasm"
if [ ! -f "${WASM_FILE}" ]; then
    WASM_FILE="${ROOT_DIR}/target/wasm32-unknown-unknown/release/vesting_stream.wasm"
fi

if [ ! -f "${WASM_FILE}" ]; then
    echo "[-] Error: Compiled WASM not found at expected path: ${WASM_FILE}"
    exit 1
fi
echo "[+] Contract compiled successfully: ${WASM_FILE} ($(du -h "${WASM_FILE}" | cut -f1))"

# 5. Deploy Contract to Stellar Testnet
echo "[*] Deploying contract to ${NETWORK}..."
CONTRACT_ID=$(${STELLAR_BIN} contract deploy \
    --wasm "${WASM_FILE}" \
    --source "${IDENTITY_NAME}" \
    --network "${NETWORK}")

echo "=========================================================="
echo "  [SUCCESS] SoroStream Contract Deployed!"
echo "  Contract ID: ${CONTRACT_ID}"
echo "=========================================================="

# 6. Initialize contract with deployer as administrator
echo "[*] Initializing contract with admin: ${DEPLOYER_PUBKEY}..."
${STELLAR_BIN} contract invoke \
    --id "${CONTRACT_ID}" \
    --source "${IDENTITY_NAME}" \
    --network "${NETWORK}" \
    -- \
    initialize \
    --admin "${DEPLOYER_PUBKEY}"

echo "[+] Contract initialized successfully!"

# 7. Write deployment configuration artifact
DEPLOY_ENV_FILE="${ROOT_DIR}/.env.testnet"
cat <<EOF > "${DEPLOY_ENV_FILE}"
# SoroStream Testnet Deployment Config
SOROBAN_NETWORK=${NETWORK}
SOROBAN_RPC_URL=${RPC_URL}
SOROBAN_NETWORK_PASSPHRASE="${NETWORK_PASSPHRASE}"
SOROSTREAM_CONTRACT_ID=${CONTRACT_ID}
SOROSTREAM_ADMIN_ADDRESS=${DEPLOYER_PUBKEY}
DEPLOYED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
EOF

echo "[+] Environment configuration saved to: ${DEPLOY_ENV_FILE}"

# Update frontend env if directory exists
FRONTEND_ENV="${ROOT_DIR}/frontend/.env.local"
if [ -d "${ROOT_DIR}/frontend" ]; then
    cat <<EOF > "${FRONTEND_ENV}"
NEXT_PUBLIC_SOROBAN_RPC_URL=${RPC_URL}
NEXT_PUBLIC_SOROBAN_NETWORK_PASSPHRASE="${NETWORK_PASSPHRASE}"
NEXT_PUBLIC_SOROSTREAM_CONTRACT_ID=${CONTRACT_ID}
NEXT_PUBLIC_BACKEND_API_URL=http://localhost:8000
EOF
    echo "[+] Frontend configuration updated: ${FRONTEND_ENV}"
fi

echo "=========================================================="
echo "  Deployment Complete! Ready for Streaming Escrows."
echo "=========================================================="
