
import { readFile } from 'node:fs/promises';
import {
  verifyTypedData,
  getAddress,
} from 'viem';

const WALLET =
  '0xcFA50612b1836f3937d2A93d7E0aaa13Db51F481';

const USDC =
  '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

const PAY_TO =
  '0x7FB30eD8D7a7B45EE7b98903d94D87D1B9C3DaD2';

const headers = JSON.parse(
  await readFile('payment-headers.json', 'utf8')
);

const signatureHeader =
  headers['PAYMENT-SIGNATURE'] ??
  headers['payment-signature'];

if (!signatureHeader) {
  throw new Error('PAYMENT-SIGNATURE not found');
}

const payload = JSON.parse(
  Buffer.from(signatureHeader, 'base64').toString('utf8')
);

if (payload.accepted?.network !== 'eip155:84532') {
  throw new Error('Unexpected network');
}

const authorization = payload.payload?.authorization;
const signature = payload.payload?.signature;

if (!authorization || !signature) {
  throw new Error('Missing authorization or signature');
}

if (
  getAddress(authorization.from) !== getAddress(WALLET) ||
  getAddress(authorization.to) !== getAddress(PAY_TO) ||
  BigInt(authorization.value) !== 1000000n
) {
  throw new Error('Unexpected payment authorization');
}

const domain = {
  name: 'USDC',
  version: '2',
  chainId: 84532,
  verifyingContract: USDC,
};

const types = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
};

const message = {
  from: authorization.from,
  to: authorization.to,
  value: BigInt(authorization.value),
  validAfter: BigInt(authorization.validAfter),
  validBefore: BigInt(authorization.validBefore),
  nonce: authorization.nonce,
};

const valid = await verifyTypedData({
  address: WALLET,
  domain,
  types,
  primaryType: 'TransferWithAuthorization',
  message,
  signature,
});

console.log('=== X402 SIGNATURE VERIFICATION ===');
console.log('Network: Base Sepolia');
console.log('Amount: 1 USDC');
console.log('Recipient verified: YES');
console.log('Signature valid:', valid ? 'YES' : 'NO');
