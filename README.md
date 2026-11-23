# DECA x402 Sandbox Guide 🚀

Community walkthrough for **DECA Labs — Launch a test through the API (+30 points)**. This is a **Base Sepolia sandbox** flow, not the paid **Launch a test on the web** advertising campaign.

> **Safety:** This tutorial uses **1 TEST USDC**, not $700 of real advertising spend. The quote may show a real-campaign budget (e.g. $700), but the request uses `sandbox: true`. Never change it to `false` while following this guide. Always verify the live API payment requirements and official documentation before signing. The example recipient is from one successful test and may change.

## Requirements

- Node.js 20+ and npm (tested locally with Node 24)
- DECA account and API key: https://app.decalabs.ai/ → **MCP & API**
- A **dedicated disposable wallet** with at least 1 Base Sepolia **test USDC**
- PowerShell on Windows (or adapt the environment variable commands to your shell)

Official guide: https://app.decalabs.ai/docs/guides/paid-tests

## 1. Install

```powershell
npm install
Copy-Item .env.example .env
```

Edit `.env` and replace `YOUR_DECA_API_KEY_HERE` with your API key. Do **not** put your wallet private key into `.env`, code, screenshots, Git, or messages.

## 2. Load the wallet key for this terminal session

```powershell
$secureKey = Read-Host "Enter disposable testnet wallet private key" -AsSecureString
$env:X402_PRIVATE_KEY = [System.Net.NetworkCredential]::new("", $secureKey).Password
Remove-Variable secureKey
```

Check the wallet:

```powershell
npm run wallet
```

Expected network: Base Sepolia, chain ID `84532`. USDC address: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`. You need sufficient **test** USDC. A public RPC and an off-chain facilitator can submit the settlement; this example does not require your wallet to send a direct gas transaction.

## 3. Request a quote and sandbox payment requirements

```powershell
npm run quote
```

The script creates a new Smart Pantry idea quote (`US`, `GB`), selects `signal`, saves `sandbox-request.json` with a new UUID, then requests a sandbox test. Expected: **HTTP 402**, with `eip155:84532`, `exact`, and **1,000,000 USDC base units = 1 test USDC**.

**Important:** A quote's `budget_usd` (for example, $700) describes a *real* demand-test budget. It is **not** the sandbox charge.

## 4. Simulate payment first (no submission)

```powershell
$env:DRY_RUN = "true"
npm run dry-run
```

The script verifies the 402 requirements, generates a fresh EIP-712/EIP-3009 authorization, checks its expiration, and simulates `transferWithAuthorization` on Base Sepolia. It should print `ON-CHAIN SIMULATION: PASSED` and `DRY RUN COMPLETE - No payment submitted.`

**A successful simulation does not guarantee facilitator settlement.** It uses the payee address as the simulated caller; the real facilitator may use another caller or different conditions.

## 5. Explicitly authorize the sandbox payment

Only proceed after confirming you are using **test USDC on Base Sepolia** and the response still requests exactly **1 test USDC**.

```powershell
Remove-Item Env:DRY_RUN -ErrorAction SilentlyContinue
$env:CONFIRM_SANDBOX_PAYMENT = "YES"
npm run submit
```

The script creates a **new** signature, re-simulates, and submits the *same request body* with `PAYMENT-SIGNATURE`. A successful response is **HTTP 201**, with a test ID and a state such as `in_review`. Save the test ID. The API task may be marked complete before the demand-test result is finalized; verify completion in your DECA dashboard.

**Do not run the submission twice blindly.** The same idempotency key may return an existing test (`HTTP 200`, `repeated: true`); a failed settlement should be investigated before making a new request. Only run `npm run quote` again when you intentionally want a *new* test request.

## 6. Clear the temporary wallet secret

```powershell
Remove-Item Env:X402_PRIVATE_KEY -ErrorAction SilentlyContinue
Remove-Item Env:CONFIRM_SANDBOX_PAYMENT -ErrorAction SilentlyContinue
Remove-Item Env:DRY_RUN -ErrorAction SilentlyContinue
```

## Troubleshooting

| Symptom | Meaning / next action |
|---|---|
| `402 Payment Required` | Expected before signing; inspect the payment requirements. |
| `200` with `repeated: true` | Existing idempotency key; inspect previous test state rather than blindly retrying. |
| Authorization expired | The sample authorization lifetime was 300 seconds; create a fresh signature. |
| `invalid_exact_evm_transaction_failed` | Settlement failed. Verify chain, token, balance, nonce, authorization, and facilitator behavior; no single cause can be inferred from this error alone. |
| `ON-CHAIN SIMULATION: PASSED` | Contract simulation passed, **not** proof that payment settled. |
| `201 Created` | DECA created the sandbox test; inspect `test.state` and dashboard task completion. |

## Security

- Use a separate test-only wallet. Never use your main wallet.
- `.env`, `sandbox-request.json`, `payment-required.json`, `payment-headers.json`, and `sandbox-result.json` are ignored by Git.
- The scripts never print the private key or payment signature.
- A successful API response can contain an `access_token`, so `sandbox-result.json` must remain private.
- The example addresses and payment amount are pinned for **this sandbox flow**; if the DECA API changes, stop and verify official docs rather than bypassing safety checks.

## Project files

- `start-test.mjs` — quote + sandbox HTTP 402 + strict requirements validation
- `sign-payment.mjs` — signature + expiry check + simulation + explicit opt-in submission
- `check-wallet.mjs` — wallet address and Base Sepolia balances
- `.env.example` — safe API key configuration template

**Not affiliated with DECA Labs.** Educational community example based on one successful sandbox API test; review official documentation for updates.
