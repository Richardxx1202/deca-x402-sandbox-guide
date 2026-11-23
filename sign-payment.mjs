
import 'dotenv/config';
import { readFile, writeFile } from 'node:fs/promises';
import { x402Client } from '@x402/core/client';
import { x402HTTPClient } from '@x402/core/http';
import { ExactEvmScheme } from '@x402/evm/exact/client';
import { toClientEvmSigner } from '@x402/evm';
import { privateKeyToAccount } from 'viem/accounts';

import {
  createPublicClient,
  http,
  parseAbi,
  parseSignature,
} from 'viem';
import { baseSepolia } from 'viem/chains';

const URL = 'https://app.decalabs.ai/api/agent/tests';

const NETWORK = 'eip155:84532';
const PAY_TO = '0x7fb30ed8d7a7b45ee7b98903d94d87d1b9c3dad2';
const USDC = '0x036cbd53842c5426634e7929541ec2318f3dcf7e';
const MAX_AMOUNT = 1000000n;

const apiKey = process.env.DECA_API_KEY;

const rawPrivateKey = process.env.X402_PRIVATE_KEY?.trim();

const privateKey = rawPrivateKey
  ? rawPrivateKey.startsWith('0x')
    ? rawPrivateKey
    : `0x${rawPrivateKey}`
  : undefined;


if (!apiKey || !privateKey) {
  throw new Error('Missing API key or wallet private key');
}

if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
  throw new Error('Invalid private key format');
}

const request = JSON.parse(
  await readFile('sandbox-request.json', 'utf8')
);

if (
  request.sandbox !== true ||
  request.option !== 'signal' ||
  !request.quote_id ||
  !request.idempotency_key
) {
  throw new Error('Invalid sandbox request');
}

const body = JSON.stringify(request);

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${apiKey}`,
};

const ask = await fetch(URL, {
  method: 'POST',
  headers,
  body,
});

const responseData = await ask.json();

if (ask.status !== 402) {
  console.log('HTTP status:', ask.status);
  console.log('No payment signed.');
  console.log(JSON.stringify(responseData, null, 2));
  process.exit(1);
}

const accepts = responseData.accepts ?? [];

if (
  accepts.length !== 1 ||
  accepts[0].scheme !== 'exact' ||
  accepts[0].network !== NETWORK ||
  accepts[0].payTo?.toLowerCase() !== PAY_TO ||
  accepts[0].asset?.toLowerCase() !== USDC ||
  !/^\d+$/.test(accepts[0].amount ?? '') ||
  BigInt(accepts[0].amount) !== MAX_AMOUNT
) {
  throw new Error('Unsafe payment requirements. Aborting.');
}

console.log('Payment requirements verified.');
console.log('Network:', NETWORK);
console.log('Amount: 1 test USDC');
console.log('Sandbox: true');

const signer = toClientEvmSigner(
  privateKeyToAccount(privateKey)
);

const client = new x402HTTPClient(
  x402Client.fromConfig({
    schemes: [
      {
        network: NETWORK,
        client: new ExactEvmScheme(signer),
      },
    ],
    spendControls: {
      maxAmountPerPayment: '$1',
    },
    policies: [
      (_version, requirements) =>
        requirements.filter(
          (r) =>
            r.scheme === 'exact' &&
            r.network === NETWORK &&
            r.payTo?.toLowerCase() === PAY_TO &&
            r.asset?.toLowerCase() === USDC &&
            /^\d+$/.test(r.amount ?? '') &&
            BigInt(r.amount) <= MAX_AMOUNT
        ),
    ],
  })
);

const required = client.getPaymentRequiredResponse(
  (name) => ask.headers.get(name),
  responseData
);

const payment = await client.createPaymentPayload(required);

const authorization = payment.payload?.authorization;

if (!authorization) {
  throw new Error('Missing payment authorization');
}

const validAfter = BigInt(authorization.validAfter);
const validBefore = BigInt(authorization.validBefore);
const now = BigInt(Math.floor(Date.now() / 1000));

const remainingSeconds = validBefore - now;

console.log('Authorization lifetime:', remainingSeconds.toString(), 'seconds');

if (now <= validAfter || remainingSeconds < 60n) {
  throw new Error(
    'Payment authorization is not currently valid or expires too soon. Aborting.'
  );
}

console.log('Authorization time check: PASSED');

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http('https://sepolia.base.org'),
});

const signedAuthorization = payment.payload?.signature;

if (!signedAuthorization) {
  throw new Error('Missing EIP-3009 signature');
}

const { r, s, v, yParity } = parseSignature(
  signedAuthorization
);

const recoveryV =
  v !== undefined ? Number(v) : Number(yParity) + 27;

const usdcAbi = parseAbi([
  'function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s)',
]);

console.log('Simulating USDC transferWithAuthorization...');

try {
  await publicClient.simulateContract({
    address: USDC,
    abi: usdcAbi,
    functionName: 'transferWithAuthorization',
    account: PAY_TO,
    args: [
      authorization.from,
      authorization.to,
      BigInt(authorization.value),
      validAfter,
      validBefore,
      authorization.nonce,
      recoveryV,
      r,
      s,
    ],
  });

  console.log('ON-CHAIN SIMULATION: PASSED');

  if (process.env.DRY_RUN === 'true') {
    console.log('DRY RUN COMPLETE - No payment submitted.');
    process.exit(0);
  }

} catch (error) {
  console.error('ON-CHAIN SIMULATION: FAILED');
  console.error('Reason:', error.shortMessage ?? error.message);
  throw new Error(
    'Payment was not submitted because simulation failed.'
  );
}

const paymentHeaders =
  client.encodePaymentSignatureHeader(payment);

// Save the signature for retry with the same request.
await writeFile(
  'payment-headers.json',
  JSON.stringify(paymentHeaders, null, 2),
  { mode: 0o600 }
);

console.log('Payment signature created.');

if (process.env.CONFIRM_SANDBOX_PAYMENT !== 'YES') {
  console.log('Payment submission blocked.');
  console.log('Set CONFIRM_SANDBOX_PAYMENT=YES to authorize submission.');
  process.exit(0);
}

console.log('Submitting sandbox test...');

const paid = await fetch(URL, {
  method: 'POST',
  headers: {
    ...headers,
    ...paymentHeaders,
  },
  body,
});

const result = await paid.json();

console.log('HTTP status:', paid.status);

if (paid.status === 201) {
  console.log('Sandbox test created!');
  console.log('Test ID:', result.test?.id);
  console.log('State:', result.test?.state);

  await writeFile(
    'sandbox-result.json',
    JSON.stringify(result, null, 2),
    { mode: 0o600 }
  );
} else {
  console.log('Test not confirmed.');
  console.log('Error:', result.code ?? result.error ?? paid.status);
  console.log('Keep the existing request and signature for retry.');
}
