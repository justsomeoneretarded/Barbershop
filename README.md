# Chair: Barbershop Marketplace

A Laravel 11 API and a separate React/Vite JavaScript SPA for customers, barbers, and shop owners. PostgreSQL is the source of truth for reservations; Redis coordinates concurrent holds and runs the background scheduler lock.

## Run locally

Requirements: Docker with Compose and Node 22 or newer. No local PHP installation is needed.

```bash
cp backend/.env.example backend/.env
docker compose build api
docker compose run --rm --no-deps api composer install
docker compose run --rm --no-deps api php artisan key:generate
docker compose up -d postgres redis
docker compose run --rm api php artisan migrate --force
docker compose run --rm api php artisan storage:link
docker compose run --rm api php artisan db:seed
docker compose up -d api scheduler queue
cd frontend
npm ci
npm run dev
```

Open http://localhost:5173. API: http://localhost:8000/api. Vite proxies API requests and public uploads to Laravel. The image build uses a CA bundle secret for HTTPS package installation; Compose defaults to the system certificate bundle. In managed environments it respects CODEX_PROXY_CERT.

Alternatively, after npm ci in frontend, run docker compose up -d web from the repository root to keep the preview server in Docker. Its API proxy target is configured automatically; do not run both preview servers on port 5173.

The seeder is for an empty development database only. Do not seed production. It creates fictional shops, people, and payment records. The bank account numbers are placeholders. Never send money to sample accounts.

| Portal | Email | Password |
| --- | --- | --- |
| Customer | customer@chair.test | ChairDemo2026! |
| Barber | barber@chair.test | ChairDemo2026! |
| Owner | owner@chair.test | ChairDemo2026! |

New customers and owners can register. Barbers join through owner-generated invitation links. Profile settings support customer, barber, and owner photos. An owner creates a shop, its services, then invites staff; invite acceptance creates an initial weekly schedule and assigns active services. Owners can change staff assignments afterward.

## Included workflows

- Distance-sorted discovery with a bound-parameter PostgreSQL Haversine query, radius limits, service search, favorites, local photographs, and active barber portraits.
- Multi-service bookings with server-calculated prices and duration including buffers, shop-local dates, breaks, days off, and a 90-day booking window.
- A 10-minute checkout hold, private receipt uploads, normalized unique bank references, and a two-hour approval window.
- Barber approval, rejection, customer cancellation, automatic expiry, owner refund recording, and immutable booking-event records.
- Private author-scoped CRM notes, completed visits, favorite barber, lifetime spend, and historical service snapshots.
- Appointment-date financial reports, verified deposits, cash collection, outstanding balances, average ticket, barber comparison, top services, cancellations, and refunds.
- Shop profile/media management, service activation, staff invitations and assignments, schedule/break editing, and time off.
- Sanctum bearer authentication, resource ownership checks, validated image uploads, separate auth/API rate limits, and database overlap constraints.

## Booking and money rules

1. Price calculations run on the server in integer minor units. Deposit is half the total, rounded to the nearest minor unit; the second-half snapshot is total minus deposit. ETB 350.01 becomes ETB 175.01 + ETB 175.00.
2. The entire selected interval, including all buffers, is reserved. Redis provides a per-barber lock and a ten-minute hold key. A PostgreSQL row lock and GiST exclusion constraint prevent overlap even if Redis keys expire or are evicted.
3. Payment submission atomically changes the booking to pending_approval. This keeps the slot reserved after the original checkout TTL expires.
4. Approving a receipt also attests that the deposit arrived in the shop account; it changes payment status to verified. A receipt upload alone is not counted as verified revenue.
5. Rejecting, cancelling, or expiring a paid request releases the interval and creates a persistent refund_pending item. The owner records the bank refund reference before the payment becomes refunded.
6. Completing a visit explicitly records collection of its remaining cash balance. Completion is restricted to the assigned barber, the shop owner, or an administrator, and cannot be performed twice.
7. remaining_balance is the original second-half amount, preserved for audit. Current unpaid balances are computed from booking/payment state. Display codes such as BK-000123 are derived from booking.id and are not stored.
8. Minimum advance notice is 135 minutes, allowing the full 10-minute payment hold and 120-minute approval window before the appointment. Schedules are same-day shifts with a single optional break, matching the supplied schema. Public bank details are only returned to authorized users during checkout.

The scheduler executes bookings:reconcile every minute and prunes expired Sanctum tokens daily. Reconciliation is safe to repeat and also runs before availability queries. Keep one scheduler running and monitor queue/scheduler health. The refund queue is a database-backed work list for owners; it does not transfer funds automatically.

The refund work list includes all pending refunds within the authorized shop scope, independent of the chart date range, so an older or future appointment cannot hide a refund obligation.

## Tests

PostgreSQL tests use a separate chair_test database, never the seeded development database.

```bash
docker compose exec postgres createdb -U chair chair_test
docker compose exec api php artisan test
cd frontend
npx playwright install chromium
npm test
npm run build
```

Browser tests require the seeded API and Vite server. They verify mobile/desktop rendering, loaded photographs, multi-service booking, checkout/receipt submission, barber approval, CRM, charts, and schedule editing. Backend tests exercise money rounding, interval exclusion, buffer/break handling, expiry, duplicate references, refund recording, private receipts, authorization, CRM notes, and one-time cash collection.

## Deployment boundary

The production JavaScript dependency audit also reports two moderate advisories in the explicitly requested React Router v6 dependency tree. Its suggested patched upgrade is React Router v7. This app uses fixed internal navigation targets and no SSR hydration, reducing exposure to the reported paths, but the audit is not clean. Upgrade and re-audit both PHP and JavaScript dependencies before production.

Laravel 11 was explicitly requested and is pinned here, with PHP 8.3 dependency resolution. At implementation time Composer reports security advisories against the latest Laravel 11 release. This version is a production deployment blocker: upgrade to a supported Laravel release and resolve composer audit before accepting real customer data or money. Dependencies were installed locally with the explicit advisory override to implement and test the requested stack; the advisory check has not been disabled in configuration.

Docker Compose and artisan serve are development tooling. For production use PHP-FPM behind an HTTPS reverse proxy and serve frontend/dist as static files, routing SPA paths to index.html and /api to Laravel. Keep the API, Redis, and PostgreSQL on private networks. Use APP_DEBUG=false, a secret APP_KEY, strong database credentials, restrictive CORS, durable public/private storage, backups, TLS, process supervision, and an upload limit matching php.ini. Do not expose private receipts under /storage.

This is a manual bank-transfer deposit implementation, not an integrated payment processor. No bank API, payout provider, Google OAuth credentials, email/SMS delivery provider, tax engine, or commission rules were supplied. The google_id schema field is present, but Google OAuth and messaging integrations are not implemented. Refund records attest to an external transfer; they do not execute it. Reports use appointment dates, not settlement dates, and are not an accounting general ledger. Confirm cancellation/refund eligibility policies before launch; the supplied default queues deposits for refund on cancellation.

No destructive shop/account deletion API is exposed. Use inactive status to preserve history. The requested cascade foreign keys remain in the schema; direct SQL deletion of a shop would still cascade its bookings and payments and should be restricted operationally. For very large datasets, replace current report/CRM collection aggregation with paginated SQL aggregates and dedicated per-client history endpoints.
