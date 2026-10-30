#!/usr/bin/env bash
# ตั้ง "Supabase จำลอง" สำหรับ integration test: Postgres + PostgREST + gateway + Next.js dev server
# ใช้ใน CI (.github/workflows/ci.yml) — ต้องมี Postgres รันอยู่แล้ว และ psql ในเครื่อง
#
#   PGHOST / PGPORT / PGUSER / PGPASSWORD / PGDATABASE  → Postgres ที่จะใช้ (ค่าตาม libpq)
#   ผลลัพธ์: ไฟล์ .env.test (ให้ `source` ก่อนรันเทส) + แอปรันที่ http://localhost:3000
set -euo pipefail
cd "$(dirname "$0")/.."

POSTGREST_VERSION=v12.2.3
JWT_SECRET="test-secret-test-secret-test-secret-0123"
mkdir -p .ci

echo "▸ database"
psql -v ON_ERROR_STOP=1 -q -f supabase/test/before.sql
psql -v ON_ERROR_STOP=1 -q -f supabase/schema.sql
psql -v ON_ERROR_STOP=1 -q -f supabase/test/after.sql

echo "▸ postgrest"
if [ ! -x .ci/postgrest ]; then
  curl -fsSL "https://github.com/PostgREST/postgrest/releases/download/${POSTGREST_VERSION}/postgrest-${POSTGREST_VERSION}-linux-static-x64.tar.xz" \
    | tar -xJ -C .ci
fi
cat > .ci/postgrest.conf <<CONF
db-uri = "postgres://authenticator:authenticator@${PGHOST:-localhost}:${PGPORT:-5432}/${PGDATABASE:-postgres}"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "${JWT_SECRET}"
server-port = 3001
CONF
nohup .ci/postgrest .ci/postgrest.conf > .ci/postgrest.log 2>&1 &
nohup node scripts/gateway.mjs > .ci/gateway.log 2>&1 &

cat > .env.test <<ENV
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=$(node scripts/jwt.mjs "$JWT_SECRET" anon)
SUPABASE_SERVICE_ROLE_KEY=$(node scripts/jwt.mjs "$JWT_SECRET" service_role)
DEV_FAKE_AUTH=1
NEXT_PUBLIC_DEV_FAKE_AUTH=1
APP_URL=http://localhost:3000
ENV

echo "▸ next dev"
set -a; . ./.env.test; set +a
nohup npx next dev -p 3000 > .ci/next.log 2>&1 &

for i in $(seq 1 60); do
  if curl -fs http://localhost:3000/api/me > /dev/null; then echo "✓ stack ready"; exit 0; fi
  sleep 2
done
echo "✗ app did not start"; tail -50 .ci/next.log; exit 1
