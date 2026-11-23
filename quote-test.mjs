
import 'dotenv/config';

const apiKey = process.env.DECA_API_KEY;

if (!apiKey) {
  console.error('Missing DECA_API_KEY in .env');
  process.exit(1);
}

const endpoint = 'https://app.decalabs.ai/api/agent/quote';

const idea = {
  name: 'Smart Pantry',
  pitch:
    'A mobile app that helps busy families reduce food waste by tracking pantry items, reminding them before food expires, and suggesting recipes using ingredients they already have.',
};

async function main() {
  console.log('Requesting DECA demand test quote...');

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      idea,
      markets: ['US', 'GB'],
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('Quote failed:', data);
    process.exit(1);
  }

  console.log('\n=== DECA QUOTE ===');
  console.log('Idea:', data.idea?.name);
  console.log('Currency:', data.currency);
  console.log('Network:', data.network);
  console.log('Expires:', data.expires_at);

  console.log('\n=== AVAILABLE OPTIONS ===');

  for (const option of data.options ?? []) {
    console.log({
      id: option.id,
      budget_usd: option.budget_usd,
      days: option.days,
      expected_visits: option.expected_visits,
      pass_line: option.pass_line,
    });
  }

  console.log('\nRecommended:', data.recommended);
  console.log('\nSandbox available: check start_test documentation');
}

main().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
