// Gateway Sandbox Adapter — SSLCommerz / ShurjoPay-er moto flow-er demo
// RULE: card number / CVV / expiry kokhono ekhane asbe na, save-o hobe na.
// Gateway sudhu token + last4 + brand pathay. Amra sudhu setai rakhi.
// Real gateway connect korar somoy ei file-er mock function-gulo
// asol gateway-er sandbox API diye replace hobe, baki API same thakbe.

const crypto = require('crypto');
const sessions = new Map(); // sessionId -> { amount, mobile, status, token, last4, brand }

function createSession({ amount, mobile }) {
  if (!amount || amount < 10 || amount > 50000) {
    throw new Error('Amount 10 theke 50000 er moddhe hote hobe (demo limit)');
  }
  const sessionId = 'sess_' + crypto.randomBytes(8).toString('hex');
  const session = {
    sessionId,
    amount: Number(amount),
    mobile,
    status: 'PENDING',
    provider: 'sandbox',
    // Demo test card — real card noy
    testCard: { number: '4242 4242 4242 4242', expiry: '12/30', cvv: '123' },
    gatewayUrl: `/api/wallet/cash-in/card/pay/${sessionId}`,
    createdAt: new Date().toISOString(),
  };
  sessions.set(sessionId, session);
  return session;
}

function confirmPayment({ sessionId, last4, brand }) {
  const s = sessions.get(sessionId);
  if (!s) throw new Error('Session paini');
  if (s.status !== 'PENDING') throw new Error('Session already ' + s.status);
  // Gateway tokenize koreche — amra sudhu token rakhi
  s.status = 'SUCCESS';
  s.token = 'tok_' + crypto.randomBytes(10).toString('hex');
  s.last4 = last4 || '4242';
  s.brand = brand || 'Visa';
  s.paidAt = new Date().toISOString();
  // testCard kokhono response-e jabe na, DB-teo jabe na
  delete s.testCard;
  return s;
}

function getSession(sessionId) {
  return sessions.get(sessionId) || null;
}

module.exports = { createSession, confirmPayment, getSession };
