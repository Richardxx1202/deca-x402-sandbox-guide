
import 'dotenv/config';

const apiKey = process.env.DECA_API_KEY;

if (!apiKey) {
  console.error('Missing DECA_API_KEY in .env');
  process.exit(1);
}

const url = 'https://app.decalabs.ai/api/agent/ideas?limit=1';

try {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
  });

  console.log('HTTP status:', response.status);

  const body = await response.text();

  if (!response.ok) {
    console.error('API request failed.');
    console.error('Check API permissions and endpoint.');
    process.exit(1);
  }

  try {
    console.log(JSON.stringify(JSON.parse(body), null, 2));
  } catch {
    console.log(body);
  }
} catch (error) {
  console.error('Connection error:', error.message);
  process.exit(1);
}
