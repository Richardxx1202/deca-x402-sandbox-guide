
import { readFile } from 'node:fs/promises';
import {
  createPublicClient,
  http,
  parseAbi,
  formatUnits,
} from 'viem';
import { baseSepolia } from 'viem/chains';

const USDC =
  '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

const client = createPublicClient({
  chain: baseSepolia,
  transport: http('https://sepolia.base.org'),
});

const headers = JSON.parse(
  await readFile('payment-headers.json', 'utf8')
);

const encoded =
  headers['PAYMENT-SIGNATURE'] ??
  headers['payment-signature'];

if (!encoded) {
  throw new Error('Payment signature not found');
}

const payment = JSON.parse(
  Buffer.from(encoded, 'base64').toString('utf8')
);

const auth = payment.payload?.authorization;

if (!auth) {
  throw new Error('Authorization not found');
}

const abi = parseAbi([
  'function authorizationState(address authorizer, bytes32 nonce) view returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
]);

const [used, balance, block] = await Promise.all([
  client.readContract({
    address: USDC,
    abi,
    functionName: 'authorizationState',
    args: [auth.from, auth.nonce],
  }),
  client.readContract({
    address: USDC,
    abi,
    functionName: 'balanceOf',
    args: [auth.from],
  }),
  client.getBlock({ blockTag: 'latest' }),
]);

const now = block.timestamp;
const validAfter = BigInt(auth.validAfter);
const validBefore = BigInt(auth.validBefore);

console.log('=== X402 AUTHORIZATION CHECK ===');
console.log('USDC:', formatUnits(balance, 6));
console.log('Nonce already used:', used);
console.log('Valid after:', new Date(Number(validAfter) * 1000).toISOString());
console.log('Valid before:', new Date(Number(validBefore) * 1000).toISOString());
console.log('Blockchain time:', new Date(Number(now) * 1000).toISOString());

const timeValid = now > validAfter && now < validBefore;
const balanceValid = balance >= BigInt(auth.value);

console.log('Time valid:', timeValid ? 'YES' : 'NO');
console.log('Balance sufficient:', balanceValid ? 'YES' : 'NO');
console.log('Nonce available:', used ? 'NO' : 'YES');
