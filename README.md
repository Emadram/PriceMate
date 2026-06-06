# PriceMate

Graduation project — supermarket price comparison (Turkey).

## Applications

| App | Path | README |
|-----|------|--------|
| **User app** (mobile + web) | [`user-app/`](user-app/) | [user-app/README.md](user-app/README.md) |
| **Admin panel** | [`admin-panel/`](admin-panel/) | [admin-panel/README.md](admin-panel/README.md) |

## Scripts and tooling

| Path | Description |
|------|-------------|
| [`scripts/`](scripts/) | Appwrite schema, seed, backfill |
| [`tools/`](tools/) | Auxiliary tooling |
| [`docs/`](docs/) | Project documentation |

## Appwrite read verification

Both apps include step-by-step guides to limit excessive Appwrite **read** requests.

### User app (mobile + web)

1. **[user-app/README.md — Mobile read verification](user-app/README.md#mobile-read-verification-appwrite-read-budget)**
2. [docs/mobile-read-verification-results.md](docs/mobile-read-verification-results.md)

```bash
cd user-app
npm test && npm run lint
npm run dev
```

### Admin panel

1. **[admin-panel/README.md — Admin read verification](admin-panel/README.md#admin-read-verification-appwrite-read-budget)**
2. [docs/admin-read-verification-results.md](docs/admin-read-verification-results.md)

```bash
cd admin-panel
npm test && npm run lint
npm run dev
```

## Development

Each app is independent (`npm install` inside each folder).

```bash
cd user-app && npm run dev
cd admin-panel && npm run dev
```
