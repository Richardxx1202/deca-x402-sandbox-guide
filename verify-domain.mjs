
import {
  createPublicClient,
  http,
  hashDomain,
  parseAbi,
} from 'viem';
import { baseSepolia } from 'viem/chains';

const USDC =
  '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

const client = createPublicClient({
  chain: baseSepolia,
  transport: http('https://sepolia.base.org'),
});

const abi = parseAbi([
  'function name() view returns (string)',
  'function version() view returns (string)',
  'function DOMAIN_SEPARATOR() view returns (bytes32)',
]);

const [name, version, onchainSeparator] = await Promise.all([
  client.readContract({
    address: USDC,
    abi,
    functionName: 'name',
  }),
  client.readContract({
    address: USDC,
    abi,
    functionName: 'version',
  }),
  client.readContract({
    address: USDC,
    abi,
    functionName: 'DOMAIN_SEPARATOR',
  }),
]);


const calculatedSeparator = hashDomain({
  domain: {
    name,
    version,
    chainId: 84532,
    verifyingContract: USDC,
  },
  types: {
    EIP712Domain: [
      { name: 'name', type: 'string' },
      { name: 'version', type: 'string' },
      { name: 'chainId', type: 'uint256' },
      { name: 'verifyingContract', type: 'address' },
    ],
  },
});


console.log('=== EIP-712 DOMAIN VERIFICATION ===');
console.log('Name:', name);
console.log('Version:', version);
console.log('Chain ID:', 84532);
console.log('On-chain separator:', onchainSeparator);
console.log('Calculated separator:', calculatedSeparator);

const matches =
  onchainSeparator.toLowerCase() ===
  calculatedSeparator.toLowerCase();

console.log('DOMAIN MATCH:', matches ? 'YES' : 'NO');
