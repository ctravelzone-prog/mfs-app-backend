#!/bin/bash
# Backend sandbox test — server start kore sob API check kore
set -u
BASE="http://localhost:3001"
rm -f data/data.json
node src/server.js > /tmp/mfs-backend.log 2>&1 &
PID=$!
trap "kill $PID 2>/dev/null || true" EXIT
sleep 2

pass=0; fail=0
check() {
  local name="$1"; local code="$2"
  if echo "$code" | grep -q '"ok":true'; then echo "PASS: $name"; pass=$((pass+1)); else echo "FAIL: $name -> $code"; fail=$((fail+1)); fi
}

check "health" "$(curl -s $BASE/health)"
check "otp request" "$(curl -s -X POST $BASE/api/auth/otp/request -H 'Content-Type: application/json' -d '{"mobile":"01711111111"}')"
check "otp verify" "$(curl -s -X POST $BASE/api/auth/otp/verify -H 'Content-Type: application/json' -d '{"mobile":"01711111111","otp":"123456"}')"
SIGNUP=$(curl -s -X POST $BASE/api/auth/signup -H 'Content-Type: application/json' -d '{"name":"Test User","mobile":"01711111111","pin":"1234"}')
check "signup" "$SIGNUP"
TOKEN=$(echo "$SIGNUP" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).token)}catch(e){}})")

SIGNUP2=$(curl -s -X POST $BASE/api/auth/signup -H 'Content-Type: application/json' -d '{"name":"Receiver","mobile":"01722222222","pin":"1234"}')
check "signup receiver" "$SIGNUP2"

INIT=$(curl -s -X POST $BASE/api/wallet/cash-in/card/init -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"amount":1000}')
check "card cash-in init" "$INIT"
SESS=$(echo "$INIT" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).sessionId)}catch(e){}})")

check "card cash-in confirm" "$(curl -s -X POST $BASE/api/wallet/cash-in/card/confirm -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d "{\"sessionId\":\"$SESS\",\"last4\":\"4242\",\"brand\":\"Visa\"}")"
check "balance 1000" "$(curl -s $BASE/api/wallet/balance -H "Authorization: Bearer $TOKEN")"
check "send money 200" "$(curl -s -X POST $BASE/api/wallet/send-money -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"toMobile":"01722222222","amount":200,"pin":"1234"}')"
check "recharge 100" "$(curl -s -X POST $BASE/api/wallet/recharge -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"mobile":"01711111111","operator":"Grameenphone","amount":100}')"
check "bill pay 100" "$(curl -s -X POST $BASE/api/wallet/bill-pay -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"biller":"DESCO","account":"12345","amount":100}')"
check "transactions" "$(curl -s $BASE/api/transactions -H "Authorization: Bearer $TOKEN")"
check "kyc" "$(curl -s -X POST $BASE/api/kyc -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"nid":"1234567890","dob":"2000-01-01"}')"
check "admin users" "$(curl -s $BASE/api/admin/users)"

echo ""
echo "PASS: $pass, FAIL: $fail"
if [ "$fail" -gt 0 ]; then exit 1; fi
