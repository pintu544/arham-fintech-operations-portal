# Stock Broking Internal Operations Portal

Arham Fintech coding assignment: a slow and unreliable mock BSE feed plus a fast internal portal backed by the last complete SQLite snapshot.

## What is included

- Mock BSE clients and trades with pagination, filters, configurable delay, and random failures
- Reliable employee and employee-client mapping endpoints
- Clients, Trades, My Clients, Employees, Incentives, and Overview screens
- Retry with request timeouts and exponential backoff
- Duplicate, count, page, role, and reference validation before an atomic cache update
- Socket.IO updates after successful commits
- Server-validated demo identities for relationship-manager and management views
- Automated API, database, sync, authorization, performance, and React tests
- Two-service Docker Compose production setup

See [the one-page architecture document](docs/architecture.md) for the data flow and design reasoning.

## Prerequisites

- Node.js `^20.19.0` or `>=22.12.0`
- npm 10+
- Docker with Compose, only for the containerized setup

## Local development

From the repository root:

```bash
npm run install:all
```

Create the local configuration file:

```powershell
Copy-Item .env.example .env
```

On macOS or Linux, use `cp .env.example .env` instead. Then start three terminals:

```bash
# Terminal 1: mock exchange, http://localhost:3001
npm run dev:bse

# Terminal 2: portal API and Socket.IO, http://localhost:3000
npm run dev:server

# Terminal 3: Vite client, http://localhost:5173
npm run dev:client
```

Open <http://localhost:5173>. The portal serves an existing SQLite snapshot immediately. On a fresh database, the role selector fills after the initial synchronization completes.

## Production with Docker Compose

```bash
docker compose up --build
```

- Dashboard and portal API: <http://localhost:3000>
- Mock BSE API: <http://localhost:3001>
- Portal health: <http://localhost:3000/api/health>
- Mock API health: <http://localhost:3001/api/health>

The production portal container builds React and serves it from the portal server. SQLite is stored in the named `portal-data` volume and survives container replacement.

Stop the services with `docker compose down`. Add `-v` only when you intentionally want to remove the cached database volume.

## Demo identity and authorization

The header selector is intentionally an assessment-only identity simulation; it is not password authentication. It loads minimal identities from `GET /api/demo/users` and sends the selected ID as `X-Employee-Id`. The server loads the employee from SQLite and derives the role.

- Relationship managers can open only their own `/api/my-clients` and incentive result.
- Management can view all relationship-manager incentives and trigger synchronization.
- Missing or unknown identities return `401`; insufficient roles return `403`.
- Production authentication would replace the demo header with a trusted session while retaining the same server-side authorization rules.

Example:

```bash
curl -H "X-Employee-Id: EMP004" http://localhost:3000/api/my-clients
curl -H "X-Employee-Id: EMP001" http://localhost:3000/api/incentives
curl -X POST -H "X-Employee-Id: EMP001" http://localhost:3000/api/sync/trigger
```

## API summary

### Mock BSE API

| Endpoint | Behavior |
| --- | --- |
| `GET /api/bse/clients?page=&pageSize=` | Delayed, failure-prone, paginated clients |
| `GET /api/bse/trades?page=&pageSize=&clientId=&startDate=&endDate=` | Delayed, failure-prone, filterable trades |
| `GET /api/internal/employees` | Immediate and reliable |
| `GET /api/internal/mappings` | Immediate and reliable |
| `GET /api/health` | Service and seed counts |

### Portal API

| Endpoint | Identity | Behavior |
| --- | --- | --- |
| `GET /api/health` | Public | Cache counts and service state |
| `GET /api/sync/status` | Public | Current, latest attempt, and latest successful sync |
| `GET /api/demo/users` | Public | Minimal identities for the assessment selector |
| `GET /api/clients` | Employee | Cached clients |
| `GET /api/trades?clientId=&startDate=&endDate=` | Employee | Cached, filtered trades |
| `GET /api/employees` | Employee | Employee directory |
| `GET /api/my-clients` | Relationship manager | Selected employee's mapped clients |
| `GET /api/incentives` | Employee | Own result for an RM; all RM results for management |
| `POST /api/sync/trigger` | Management | `202` when accepted; `409` if a sync is active |

Socket.IO emits `sync-status` during a pull and `data-updated` only after a successful database commit.

## Configuration

| Variable | Default | Purpose |
| --- | ---: | --- |
| `BSE_API_PORT` | `3001` | Mock API port; `PORT` is also accepted |
| `BSE_PAGE_DELAY_MS` | `500` | Delay applied to each BSE page |
| `BSE_FAILURE_RATE` | `0.20` | Failure probability for each BSE page request, from `0` to `1` |
| `PORTAL_PORT` | `3000` | Portal port; `PORT` is also accepted |
| `BSE_API_URL` | `http://localhost:3001` | Upstream mock API URL |
| `BSE_REQUEST_TIMEOUT_MS` | `25000` | Per-request timeout below the 30-second network limit |
| `BSE_MAX_RETRIES` | `5` | Page attempts, including the first request |
| `SYNC_INTERVAL_MS` | `60000` | Scheduled synchronization interval |
| `INCENTIVE_RATE` | `0.10` | Share of mapped-client brokerage paid as incentive |
| `DATABASE_PATH` | `portal/server/portal.db` | SQLite cache path; relative paths use the server working directory |
| `CORS_ORIGIN` | `*` | Allowed browser origin for local/demo deployment |
| `VITE_API_URL` | same origin | Public portal API URL embedded in the frontend build |
| `VITE_SOCKET_URL` | `VITE_API_URL` | Public Socket.IO server URL embedded in the frontend build |

There are 4 client pages and 50 trade pages with the seeded data. Setting `BSE_PAGE_DELAY_MS=11000` produces approximately `54 × 11 seconds = 594 seconds`, or 9.9 minutes, before retry backoff. Each individual page still finishes below the 25-second portal timeout.

## Verification

```bash
# All backend and React tests, then the production client build
npm run verify

# Individual groups
npm run test:backend
npm run test:client
npm run build:client
```

The verification suite covers filters and validation, deterministic failures, timeout cleanup, retries, incomplete pulls, duplicate/reference rejection, foreign-key rollback, overlapping syncs, cached reads while BSE is down, role scoping, live-update refetching, table pagination reset, and a 5,000-trade response under one second. GitHub Actions runs the same verification on Node 20 and 22.

## Failure demonstration

1. Complete one synchronization with both services running.
2. Stop only the mock BSE API.
3. Continue opening portal screens; they read the last successful SQLite snapshot.
4. As a management identity, trigger sync. Status changes to an error/stale state after retries.
5. Confirm cached counts remain unchanged and no `data-updated` event is emitted.
6. Restart the mock API and trigger sync again; open screens refresh after the successful commit.

## Submission links

| Deliverable | URL |
| --- | --- |
| Git repository | <https://github.com/pintu544/arham-fintech-operations-portal> |
| Mock BSE API | <https://mock-bse-api-production.up.railway.app/api/health> |
| Portal API | <https://portal-api-production-0ba6.up.railway.app/api/health> |
| Internal dashboard | <https://arham-fintech-operations-portal.vercel.app> |
| Video walkthrough | <https://www.loom.com/share/a060541bba25473297c18831c592a50b> |

Final submission checklist:

- [x] `npm run verify` passes from a clean install
- [ ] `docker compose up --build` makes both health checks pass
- [x] Public deployment uses a persistent portal database volume
- [x] Public API and dashboard URLs are inserted above
- [ ] Video demonstrates slow/failing BSE, cached screens, role scoping, and live refresh
- [ ] Repository excludes `.env`, SQLite, WAL/SHM, logs, `node_modules`, and build output

## Scaling to 100×

At roughly 20,000 clients and 500,000 trades, move the cache to PostgreSQL, ingest incrementally through a durable queue and distributed lock, use versioned staging tables with a short promotion transaction, add cursor pagination and aggregate endpoints, virtualize frontend tables, and broadcast updates through a shared event bus. The full reasoning is in [the architecture document](docs/architecture.md#at-100-volume).
