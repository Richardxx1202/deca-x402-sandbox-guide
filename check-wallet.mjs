
import 'dotenv/config';
import { privateKeyToAccount } from 'viem/accounts';
import {
  createPublicClient,
  http,
  formatUnits,
  formatEther,
} from 'viem';
import { baseSepolia } from 'viem/chains';

const privateKey = process.env.X402_PRIVATE_KEY?.trim();

if (!privateKey) {
  throw new Error('Missing X402_PRIVATE_KEY');
}

const normalizedKey = privateKey.startsWith('0x')
  ? privateKey
  : `0x${privateKey}`;

if (!/^0x[0-9a-fA-F]{64}$/.test(normalizedKey)) {
  throw new Error('Invalid private key format');
}

const account = privateKeyToAccount(normalizedKey);

const client = createPublicClient({
  chain: baseSepolia,
  transport: http('https://sepolia.base.org'),
});

const USDC = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

const balanceOfAbi = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'account', type: 'address' },
    ],
    outputs: [
      { name: '', type: 'uint256' },
    ],
  },
];

const [ethBalance, usdcBalance] = await Promise.all([
  client.getBalance({ address: account.address }),
  client.readContract({
    address: USDC,
    abi: balanceOfAbi,
    functionName: 'balanceOf',
    args: [account.address],
  }),
]);

console.log('\n=== X402 WALLET CHECK ===');
console.log('Wallet:', account.address);
console.log('Network: Base Sepolia');
console.log('ETH:', formatEther(ethBalance));
console.log('USDC:', formatUnits(usdcBalance, 6));

if (usdcBalance < 1000000n) {
  console.log('\nWARNING: Insufficient test USDC.');
} else {
  console.log('\nUSDC balance is sufficient.');
}
