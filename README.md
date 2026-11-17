# [App Name] — Backend Sandbox
Demo only, real taka noy.

## Run
```bash
cd backend
npm install
npm start
# http://localhost:3001
# health: curl http://localhost:3001/health
```

## Test
```bash
bash test.sh
# sob API ekbar kore chalay, pass/fail dekhay
```

## Test data (sandbox only)
- OTP: `123456`
- Test card: `4242 4242 4242 4242`, expiry `12/30`, CVV `123`
- Card number kokhono server-e pathaba na — gateway sandbox token + last4 dey, amra sudhu setai rakhi.

## Flow
1. OTP request/verify
2. Signup (name, mobile, 4-digit PIN) -> token
3. Card Cash-In init -> sessionId
4. Card Cash-In confirm {sessionId, last4: 4242, brand: Visa} -> balance bare
5. Send Money / Recharge / Bill Pay / Cash Out
6. Transactions list

## Real gateway-te jaoar somoy
- `src/gateway-sandbox.js`-er mock function SSLCommerz / ShurjoPay sandbox API diye replace hobe
- `.env`-e store id / password bosbe — kokhono code-e hardcode noy
- DB: demo JSON file-er bodle PostgreSQL
- Admin: real auth + role lagbe

## License note
Wallet chalate Bangladesh Bank license lagbei. Eta demo backend — license chara real money chalano jabe na.
