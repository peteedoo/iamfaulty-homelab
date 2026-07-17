# DealScout 🌿

Tiny self-hosted web page that finds the best cannabis deals near you —
tuned for **Denver disposable vapes** out of the box. It pulls nearby
dispensary menus from Weedmaps' public consumer API (the same
unauthenticated endpoints weedmaps.com itself calls), filters to vape
products, detects sale pricing, and shows the cheapest options first.

No dependencies — one Python file (stdlib only) + one HTML file.

## Quick start

```bash
cd dealscout
python3 server.py
# → http://localhost:8420
```

or with Docker:

```bash
cd dealscout
docker compose up -d --build
```

First load scans up to 20 nearby menus (~30–60s), then everything is
served from a local cache (default 30 min TTL). Hit **↻ Refresh** in the
UI to force a re-scan.

### Try it without network

```bash
DEALSCOUT_MOCK=1 python3 server.py
```

serves fictional sample data — useful to preview the UI or test changes.

### Check the upstream API works from your network

```bash
python3 server.py --probe
```

Prints JSON telling you whether the listings search and a sample menu
fetch succeed from your machine, and the exact URLs used.

## Configuration (env vars)

| Var | Default | Meaning |
|-----|---------|---------|
| `DEALSCOUT_LAT` / `DEALSCOUT_LNG` | `39.7392` / `-104.9903` | Search center (default: downtown Denver) |
| `DEALSCOUT_RADIUS_MI` | `10` | Search radius, miles |
| `DEALSCOUT_MAX_LISTINGS` | `20` | Max menus scanned per refresh |
| `DEALSCOUT_LISTING_TYPES` | `dispensary,delivery` | Listing types to include |
| `DEALSCOUT_MENU_PAGES` | `2` | Menu pages per store (150 items/page) |
| `DEALSCOUT_CACHE_TTL` | `1800` | Cache lifetime, seconds |
| `DEALSCOUT_CACHE_DIR` | `./cache` | On-disk cache location |
| `DEALSCOUT_PORT` / `DEALSCOUT_BIND` | `8420` / `0.0.0.0` | Listen address |
| `DEALSCOUT_WORKERS` | `4` | Concurrent menu fetches |
| `DEALSCOUT_MOCK` | `0` | `1` = serve bundled fictional sample data |

For "near me" anywhere else, just change `DEALSCOUT_LAT`/`LNG`.

## UI filters

- **Disposables only** (default on) — disposable / all-in-one / dispo /
  AIO products; toggle off to see all vapes incl. carts and pods.
- **On sale only** — items with detected discount pricing.
- Search box, max price, sort by price / % off / distance.

## How it works

```
browser ── /api/deals ──► server.py ──► Weedmaps discovery API
                             │              (listings near lat/lng,
                             ▼               then each store's menu)
                        ./cache/*.json
```

The server proxies and caches upstream calls (which also sidesteps CORS),
then normalizes menu items defensively — Weedmaps' internal schema has
shifted over the years, so price extraction handles several shapes
(`prices.price` + `original_price`, `weight_prices[]`, `sale_price` /
`discounted_price`, `price_*` keys) and classification is keyword-based
on name + category. If the upstream changes or blocks, the UI shows a
per-source error banner instead of breaking, and stale cache is served
when a refresh fails.

## Caveats

- **Unofficial API.** These are Weedmaps' internal consumer endpoints —
  no key needed, but no stability guarantee either. Keep usage personal
  and low-volume (the defaults: ≤ ~40 requests per refresh, 30 min
  cache, request jitter). Their official partner API requires a
  business account.
- Prices/stock can lag the store's real menu — confirm before driving.
- Sale detection depends on the store publishing discount data to
  Weedmaps; some stores only post deals on their own site/Leafly/Dutchie.
  The footer links out to Weedmaps Denver and Leafly deals for
  cross-checking. Adding more sources (Leafly, Jane/Dutchie menus) means
  adding another fetch+normalize pair in `server.py`.
- 21+. Colorado rules apply.
