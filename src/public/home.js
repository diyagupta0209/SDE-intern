const statusEl = document.querySelector('#status');
const outputEl = document.querySelector('#output');

function showStatus(ok, message) {
  statusEl.textContent = message;
  statusEl.classList.toggle('bad', !ok);
}

async function readJson(response) {
  const body = await response.json();
  if (!response.ok) {
    const message = body?.error?.message || `Request failed (${response.status})`;
    throw new Error(message);
  }
  return body;
}

async function loadHealth() {
  try {
    const body = await readJson(await fetch('/health'));
    const connected = body.data?.mongo === 'connected';
    showStatus(
      connected,
      connected
        ? 'API is running. MongoDB is connected.'
        : 'API is running. MongoDB is disconnected.',
    );
  } catch (error) {
    showStatus(false, error.message);
  }
}

document.querySelector('#login').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  outputEl.textContent = 'Signing in…';
  try {
    const auth = await readJson(await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: form.get('email'),
        password: form.get('password'),
      }),
    }));
    const headers = { Authorization: `Bearer ${auth.data.accessToken}` };
    const [accounts, transactions] = await Promise.all([
      readJson(await fetch('/api/v1/accounts', { headers })),
      readJson(await fetch('/api/v1/transactions', { headers })),
    ]);
    const account = accounts.data[0];
    const lines = [
      `${auth.data.user.name} (${auth.data.user.role})`,
      account ? `${account.name}: ${account.balance} ${account.currency}` : 'No accounts',
      '',
      ...transactions.data.map((item) => (
        `${item.type} ${item.amount}  ${item.description}  → ${item.category.name}`
      )),
    ];
    outputEl.textContent = lines.join('\n');
  } catch (error) {
    outputEl.textContent = error.message;
  }
});

loadHealth();
