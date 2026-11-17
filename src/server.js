const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const gateway = require('./gateway-sandbox');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));
const PORT = process.env.PORT || 3001;

const DATA_FILE = path.join(__dirname, '..', 'data', 'data.json');

// ---- Demo store (JSON file, sandbox only — production-e PostgreSQL lagbe) ----
function load() {
  try {
    if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {}
  return { users: [], transactions: [] };
}
function save(db) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}
let db = load();

function hashPin(pin) {
  return crypto.createHash('sha256').update('mfs-demo-salt:' + String(pin)).digest('hex');
}
function makeToken(mobile) {
  return Buffer.from(mobile + ':' + Date.now() + ':' + crypto.randomBytes(6).toString('hex')).toString('base64');
}
function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.replace('Bearer ', '');
  if (!token) return res.status(401).json({ ok: false, error: 'Token lagbe' });
  const mobile = Buffer.from(token, 'base64').toString('utf8').split(':')[0];
  const user = db.users.find(u => u.mobile === mobile);
  if (!user) return res.status(401).json({ ok: false, error: 'Invalid token' });
  req.user = user;
  next();
}
function tx({ type, mobile, toMobile, amount, status, ref, note }) {
  const t = { id: 'trx_' + crypto.randomBytes(6).toString('hex'), type, mobile, toMobile: toMobile || null, amount: Number(amount), status: status || 'SUCCESS', ref: ref || null, note: note || '', createdAt: new Date().toISOString() };
  db.transactions.unshift(t);
  save(db);
  return t;
}
function publicUser(u) {
  return { id: u.id, name: u.name, mobile: u.mobile, balance: u.balance, kycStatus: u.kycStatus, createdAt: u.createdAt };
}

// ---- Health / docs ----
app.get('/health', (req, res) => res.json({ ok: true, app: '[App Name]', mode: 'sandbox', time: new Date().toISOString() }));
app.get('/api', (req, res) => res.json({
  ok: true, app: '[App Name] — MFS Backend Sandbox',
  note: 'Demo only, real taka noy. License chara real money chalano jabe na.',
  endpoints: [
    'POST /api/auth/otp/request {mobile}',
    'POST /api/auth/otp/verify {mobile, otp}',
    'POST /api/auth/signup {name, mobile, pin}',
    'POST /api/auth/login {mobile, pin}',
    'GET /api/wallet/balance',
    'POST /api/wallet/send-money {toMobile, amount, pin}',
    'POST /api/wallet/cash-in/card/init {amount}',
    'POST /api/wallet/cash-in/card/confirm {sessionId, last4, brand}',
    'POST /api/wallet/cash-out {amount, agentId, pin}',
    'POST /api/wallet/recharge {mobile, operator, amount}',
    'POST /api/wallet/bill-pay {biller, account, amount}',
    'GET /api/transactions',
    'POST /api/kyc {nid, dob}',
    'GET /api/admin/users', 'GET /api/admin/transactions',
  ],
  testCard: '4242 4242 4242 4242, 12/30, 123 — sandbox only',
  testOtp: '123456',
}));

// ---- Auth: OTP mock (sandbox-e 123456) ----
app.post('/api/auth/otp/request', (req, res) => {
  const { mobile } = req.body || {};
  if (!mobile || String(mobile).length < 11) return res.status(400).json({ ok: false, error: 'Sothik mobile number dao' });
  res.json({ ok: true, message: 'Sandbox OTP: 123456 (real-e SMS jabe)', mobile });
});
app.post('/api/auth/otp/verify', (req, res) => {
  const { mobile, otp } = req.body || {};
  if (String(otp) !== '123456') return res.status(400).json({ ok: false, error: 'OTP vul' });
  res.json({ ok: true, message: 'OTP verified', mobile });
});

app.post('/api/auth/signup', (req, res) => {
  const { name, mobile, pin } = req.body || {};
  if (!name || !mobile || !pin || String(pin).length !== 4) return res.status(400).json({ ok: false, error: 'name, mobile, 4-digit PIN lagbe' });
  if (db.users.find(u => u.mobile === mobile)) return res.status(400).json({ ok: false, error: 'Ei number-e account ache' });
  const user = { id: 'usr_' + crypto.randomBytes(6).toString('hex'), name, mobile, pinHash: hashPin(pin), balance: 0, kycStatus: 'PENDING', createdAt: new Date().toISOString() };
  db.users.push(user); save(db);
  res.json({ ok: true, token: makeToken(mobile), user: publicUser(user) });
});
app.post('/api/auth/login', (req, res) => {
  const { mobile, pin } = req.body || {};
  const user = db.users.find(u => u.mobile === mobile);
  if (!user || user.pinHash !== hashPin(pin)) return res.status(401).json({ ok: false, error: 'Mobile / PIN vul' });
  res.json({ ok: true, token: makeToken(mobile), user: publicUser(user) });
});

// ---- KYC (fields only) ----
app.post('/api/kyc', auth, (req, res) => {
  const { nid, dob } = req.body || {};
  if (!nid || !dob) return res.status(400).json({ ok: false, error: 'NID + date of birth lagbe' });
  req.user.kycStatus = 'UNDER_REVIEW';
  req.user.nidLast4 = String(nid).slice(-4);
  save(db);
  res.json({ ok: true, kycStatus: req.user.kycStatus, note: 'Demo-e UNDER_REVIEW, real verification pore' });
});

// ---- Wallet ----
app.get('/api/wallet/balance', auth, (req, res) => res.json({ ok: true, balance: req.user.balance, mobile: req.user.mobile }));

app.post('/api/wallet/send-money', auth, (req, res) => {
  const { toMobile, amount, pin } = req.body || {};
  if (req.user.pinHash !== hashPin(pin)) return res.status(401).json({ ok: false, error: 'PIN vul' });
  if (!amount || amount <= 0) return res.status(400).json({ ok: false, error: 'Amount > 0 hote hobe' });
  if (req.user.balance < amount) return res.status(400).json({ ok: false, error: 'Balance kom' });
  const receiver = db.users.find(u => u.mobile === toMobile);
  if (!receiver) return res.status(404).json({ ok: false, error: 'Receiver paini — age signup korte hobe (demo)' });
  req.user.balance -= Number(amount);
  receiver.balance += Number(amount);
  save(db);
  const t = tx({ type: 'SEND_MONEY', mobile: req.user.mobile, toMobile, amount });
  res.json({ ok: true, balance: req.user.balance, transaction: t });
});

// Card Add Money — gateway sandbox
app.post('/api/wallet/cash-in/card/init', auth, (req, res) => {
  try {
    const s = gateway.createSession({ amount: req.body.amount, mobile: req.user.mobile });
    res.json({ ok: true, sessionId: s.sessionId, amount: s.amount, gatewayUrl: s.gatewayUrl, note: 'Card details gateway-e dibe, amader server-e kokhono pathaba na', testCard: s.testCard });
  } catch (e) { res.status(400).json({ ok: false, error: e.message }); }
});
app.post('/api/wallet/cash-in/card/confirm', auth, (req, res) => {
  try {
    const s = gateway.confirmPayment({ sessionId: req.body.sessionId, last4: req.body.last4, brand: req.body.brand });
    req.user.balance += s.amount;
    save(db);
    const t = tx({ type: 'CASH_IN_CARD', mobile: req.user.mobile, amount: s.amount, ref: s.token, note: `Card ****${s.last4} (${s.brand}) — tokenized` });
    res.json({ ok: true, balance: req.user.balance, transaction: t, gateway: { token: s.token, last4: s.last4, brand: s.brand } });
  } catch (e) { res.status(400).json({ ok: false, error: e.message }); }
});

app.post('/api/wallet/cash-out', auth, (req, res) => {
  const { amount, agentId, pin } = req.body || {};
  if (req.user.pinHash !== hashPin(pin)) return res.status(401).json({ ok: false, error: 'PIN vul' });
  if (!amount || amount <= 0 || req.user.balance < amount) return res.status(400).json({ ok: false, error: 'Amount / balance check koro' });
  req.user.balance -= Number(amount); save(db);
  const t = tx({ type: 'CASH_OUT', mobile: req.user.mobile, amount, status: 'PENDING_AGENT', note: 'Agent: ' + (agentId || '[agentId]') + ' — demo-e PENDING, live agent network pore' });
  res.json({ ok: true, balance: req.user.balance, transaction: t });
});
app.post('/api/wallet/recharge', auth, (req, res) => {
  const { mobile, operator, amount } = req.body || {};
  if (!amount || amount <= 0 || req.user.balance < amount) return res.status(400).json({ ok: false, error: 'Amount / balance check koro' });
  req.user.balance -= Number(amount); save(db);
  const t = tx({ type: 'RECHARGE', mobile: req.user.mobile, amount, note: `${operator || '[operator]'} -> ${mobile}` });
  res.json({ ok: true, balance: req.user.balance, transaction: t });
});
app.post('/api/wallet/bill-pay', auth, (req, res) => {
  const { biller, account, amount } = req.body || {};
  if (!amount || amount <= 0 || req.user.balance < amount) return res.status(400).json({ ok: false, error: 'Amount / balance check koro' });
  req.user.balance -= Number(amount); save(db);
  const t = tx({ type: 'BILL_PAY', mobile: req.user.mobile, amount, note: `${biller || '[biller]'} / ${account || '[account]'}` });
  res.json({ ok: true, balance: req.user.balance, transaction: t });
});
app.get('/api/transactions', auth, (req, res) => {
  res.json({ ok: true, transactions: db.transactions.filter(t => t.mobile === req.user.mobile || t.toMobile === req.user.mobile) });
});

// ---- Admin (demo — real-e admin auth + role lagbe) ----
app.get('/api/admin/users', (req, res) => res.json({ ok: true, users: db.users.map(publicUser) }));
app.get('/api/admin/transactions', (req, res) => res.json({ ok: true, transactions: db.transactions }));

app.listen(PORT, () => console.log(`[App Name] backend sandbox running on http://localhost:${PORT}`));
module.exports = app;
