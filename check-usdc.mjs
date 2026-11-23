
import {
  createPublicClient,
  http,
  formatUnits,
  parseAbi,
} from 'viem';
import { baseSepolia } from 'viem/chains';

const client = createPublicClient({
  chain: baseSepolia,
  transport: http('https://sepolia.base.org'),
});

const USDC = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
const WALLET = 'your wallet';

const abi = parseAbi([
  'function name() view returns (string)',
  'function version() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)',
  'function DOMAIN_SEPARATOR() view returns (bytes32)',

'function eip712Domain() view returns (bytes1,string,string,uint256,address,bytes32,uint256[])',

]);

async function check(label, functionName, args = []) {
  try {
    const value = await client.readContract({
      address: USDC,
      abi,
      functionName,
      args,
    });

    console.log(label, String(value));
    return value;
  } catch (error) {
    console.log(label, 'NOT AVAILABLE');
    return null;
  }
}

console.log('=== BASE SEPOLIA USDC CHECK ===');

const name = await check('Name:', 'name');
const version = await check('Version:', 'version');
const decimals = await check('Decimals:', 'decimals');
const balance = await check('Balance (raw):', 'balanceOf', [WALLET]);

await check('DOMAIN_SEPARATOR:', 'DOMAIN_SEPARATOR');

await check('EIP-712 domain:', 'eip712Domain');

if (balance !== null && decimals !== null) {
  console.log(
    'Balance:',
    formatUnits(balance, Number(decimals)),
    'USDC'
  );
}

console.log('Expected EIP-712 name: USD Coin');
console.log('Expected EIP-712 version: 2');
