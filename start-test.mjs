
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const API_URL = 'https://app.decalabs.ai/api/agent';
const EXPECTED_PAY_TO =
  '0x7FB30eD8D7a7B45EE7b98903d94D87D1B9C3DaD2';
const EXPECTED_USDC =
  '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

const apiKey = process.env.DECA_API_KEY;

if (!apiKey) {
  throw new Error('Missing DECA_API_KEY in .env');
}

async function main() {
  // 1. Request a fresh quote.
  const quoteResponse = await fetch(`${API_URL}/quote`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      idea: {
        name: 'Smart Pantry',
        pitch:
          'A mobile app that helps busy families reduce food waste by tracking pantry items, reminding them before food expires, and suggesting recipes using ingredients they already have.',
      },
      markets: ['US', 'GB'],
    }),
  });

  const quote = await quoteResponse.json();

  if (!quoteResponse.ok || !quote.quote_id) {
    throw new Error('Failed to get a valid quote');
  }

  const option = quote.options?.find(
    (item) => item.id === 'signal'
  );

  if (!option) {
    throw new Error('Signal option is unavailable');
  }

  console.log('Quote received');
  console.log('Option:', option.id);
  console.log('Budget:', option.budget_usd, 'USD');

  // 2. Create the sandbox request.
  const requestBody = {
    quote_id: quote.quote_id,
    option: 'signal',
    sandbox: true,
    idempotency_key: randomUUID(),
  };

  // Save the exact request for the payment step.
  await writeFile(
    'sandbox-request.json',
    JSON.stringify(requestBody, null, 2)
  );

  // 3. Ask DECA for payment requirements.
  const response = await fetch(`${API_URL}/tests`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  const data = await response.json();

  console.log('HTTP status:', response.status);

  if (response.status !== 402) {
    console.log('Response:', JSON.stringify(data, null, 2));
    return;
  }

  // 4. Validate the payment requirements.
  const requirements = data.accepts ?? [];

  const valid = requirements.filter((item) =>
    item.scheme === 'exact' &&
    item.network === 'eip155:84532' &&
    item.payTo?.toLowerCase() ===
      EXPECTED_PAY_TO.toLowerCase() &&
    item.asset?.toLowerCase() ===
      EXPECTED_USDC.toLowerCase() &&
    /^\d+$/.test(item.amount ?? '') &&
    BigInt(item.amount) === 1000000n
  );

  if (valid.length === 0) {
    throw new Error(
      'Payment requirements failed safety checks. Do not pay.'
    );
  }

  await writeFile(
    'payment-required.json',
    JSON.stringify(data, null, 2)
  );

  console.log('\nSANDBOX PAYMENT VERIFIED');
  console.log('Network: Base Sepolia');
  console.log('Amount: 1 test USDC');
  console.log('Recipient:', EXPECTED_PAY_TO);
  console.log('Saved: payment-required.json');
  console.log('No payment has been signed or sent.');
}

main().catch((error) => {
  console.error('Error:', error.message);
  process.exitCode = 1;
});
