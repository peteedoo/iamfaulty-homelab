#!/usr/bin/env python3
"""DealScout — self-hosted cannabis deal finder (Denver / disposable vapes).

Zero-dependency (stdlib only) local server that:
  * pulls dispensary listings near a configurable point from Weedmaps'
    public consumer discovery API (the same unauthenticated endpoints the
    weedmaps.com site uses),
  * pulls each nearby menu, filters to vape products, detects sale pricing,
  * caches everything on disk so refreshes are cheap and polite,
  * serves a single-page UI at http://localhost:8420

These endpoints are unofficial and can change without notice — every fetch
is wrapped so failures degrade to an error banner in the UI instead of a
crash. Run `python3 server.py --probe` to test the upstream endpoints from
your network.
"""

import json
import os
import random
import re
import sys
import time
import hashlib
import tempfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib import request as urlrequest
from urllib.parse import urlsplit, parse_qs, quote
from urllib.error import HTTPError, URLError

ROOT = Path(__file__).resolve().parent

WM_API = "https://api-g.weedmaps.com/discovery/v1"
WM_WEB = "https://weedmaps.com"
USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0"
)

# Denver: 39.7392, -104.9903. Override via env for "near me" anywhere.
def _env(name, default, cast=str):
    raw = os.environ.get(name)
    if raw is None or raw == "":
        return default
    try:
        return cast(raw)
    except (TypeError, ValueError):
        print(f"[dealscout] bad value for {name}={raw!r}, using {default!r}")
        return default


CONFIG = {
    "port": _env("DEALSCOUT_PORT", 8420, int),
    "bind": _env("DEALSCOUT_BIND", "0.0.0.0"),
    "lat": _env("DEALSCOUT_LAT", 39.7392, float),
    "lng": _env("DEALSCOUT_LNG", -104.9903, float),
    "radius_mi": _env("DEALSCOUT_RADIUS_MI", 10.0, float),
    # how many nearby menus to scan per refresh (each is 1-2 requests)
    "max_listings": _env("DEALSCOUT_MAX_LISTINGS", 20, int),
    "listing_types": _env("DEALSCOUT_LISTING_TYPES", "dispensary,delivery"),
    "menu_pages": _env("DEALSCOUT_MENU_PAGES", 2, int),  # 150 items per page
    "cache_ttl": _env("DEALSCOUT_CACHE_TTL", 1800, int),  # seconds
    "cache_dir": _env("DEALSCOUT_CACHE_DIR", str(ROOT / "cache")),
    "workers": _env("DEALSCOUT_WORKERS", 4, int),
    "mock": _env("DEALSCOUT_MOCK", "0").lower() in ("1", "true", "yes"),
}

VAPE_RE = re.compile(
    r"\b(vape|vapes|vaporizer|cartridge|cartridges|cart|carts|pod|pods|"
    r"disposable|disposables|dispo|aio|all-in-one)\b|all in one",
    re.I,
)
DISPOSABLE_RE = re.compile(
    r"\b(disposable|disposables|dispo|aio|all-in-one)\b|all in one", re.I
)


# --------------------------------------------------------------------------
# fetching + cache
# --------------------------------------------------------------------------

def _cache_path(url):
    return Path(CONFIG["cache_dir"]) / (hashlib.sha1(url.encode()).hexdigest() + ".json")


def _cache_read(url, max_age):
    try:
        p = _cache_path(url)
        entry = json.loads(p.read_text())
        if max_age is None or time.time() - entry["fetched_at"] <= max_age:
            return entry
    except (OSError, ValueError, KeyError):
        pass
    return None


def _cache_write(url, data):
    try:
        d = Path(CONFIG["cache_dir"])
        d.mkdir(parents=True, exist_ok=True)
        fd, tmp = tempfile.mkstemp(dir=d, suffix=".tmp")
        with os.fdopen(fd, "w") as f:
            json.dump({"fetched_at": time.time(), "url": url, "data": data}, f)
        os.replace(tmp, _cache_path(url))
    except OSError as e:
        print(f"[dealscout] cache write failed: {e}")


def fetch_json(url, refresh=False):
    """GET a JSON url with disk caching. Returns (data, error, from_cache_ts)."""
    if not refresh:
        hit = _cache_read(url, CONFIG["cache_ttl"])
        if hit:
            return hit["data"], None, hit["fetched_at"]

    time.sleep(random.uniform(0.15, 0.4))  # stay polite to the upstream
    req = urlrequest.Request(url, headers={
        "User-Agent": USER_AGENT,
        "Accept": "application/json",
        "Accept-Encoding": "identity",
    })
    try:
        with urlrequest.urlopen(req, timeout=25) as resp:
            data = json.loads(resp.read().decode("utf-8", "replace"))
        _cache_write(url, data)
        return data, None, None
    except HTTPError as e:
        err = f"HTTP {e.code} from {urlsplit(url).netloc}"
    except URLError as e:
        err = f"network error: {getattr(e, 'reason', e)}"
    except (ValueError, OSError) as e:
        err = f"{type(e).__name__}: {e}"

    # stale-while-error: an old cache entry beats nothing
    stale = _cache_read(url, None)
    if stale:
        return stale["data"], f"{err} (showing cached copy)", stale["fetched_at"]
    return None, err, None


# --------------------------------------------------------------------------
# weedmaps parsing (defensive: schema is unofficial and drifts)
# --------------------------------------------------------------------------

def _plural(listing_type):
    if listing_type.endswith("y"):
        return listing_type[:-1] + "ies"
    return listing_type + "s"


def _find_list(payload, *key_paths):
    """Pull the first list found at any of the given key paths."""
    for path in key_paths:
        node = payload
        ok = True
        for key in path:
            if isinstance(node, dict) and key in node:
                node = node[key]
            else:
                ok = False
                break
        if ok and isinstance(node, list):
            return node
    return []


def listings_url(page=1, page_size=100):
    c = CONFIG
    latlng = f"{c['lat']},{c['lng']}"
    return (
        f"{WM_API}/listings?sort_by=position_distance"
        f"&filter{quote('[bounding_radius]')}={c['radius_mi']}mi"
        f"&filter{quote('[bounding_latlng]')}={quote(latlng)}"
        f"&latlng={quote(latlng)}&page_size={page_size}&page={page}"
    )


def menu_url(listing, page=1, page_size=150):
    return (
        f"{WM_API}/listings/{_plural(listing['type'])}/{listing['slug']}"
        f"/menu_items?page={page}&page_size={page_size}"
    )


def normalize_listing(raw):
    if not isinstance(raw, dict) or not raw.get("slug"):
        return None
    ltype = raw.get("type") or "dispensary"
    web_url = raw.get("web_url") or f"{WM_WEB}/{_plural(ltype)}/{raw['slug']}"
    return {
        "name": raw.get("name") or raw["slug"],
        "slug": raw["slug"],
        "type": ltype,
        "web_url": web_url,
        "distance_mi": raw.get("distance"),
        "city": raw.get("city"),
        "rating": raw.get("rating"),
        "license_type": raw.get("license_type"),
    }


def _walk_category_text(raw):
    """Collect name/slug strings from anything category-ish in the item."""
    out = []

    def walk(node, hint=False):
        if isinstance(node, dict):
            for k, v in node.items():
                k_l = str(k).lower()
                if "category" in k_l or "tag" in k_l:
                    walk(v, hint=True)
                elif hint and k_l in ("name", "slug", "label") and isinstance(v, str):
                    out.append(v)
                elif isinstance(v, (dict, list)):
                    walk(v, hint=hint)
        elif isinstance(node, list):
            for v in node:
                walk(v, hint=hint)
        elif hint and isinstance(node, str):
            out.append(node)

    walk(raw)
    return " ".join(out)


def _as_price(v):
    try:
        f = float(v)
        return f if 0 < f < 10000 else None
    except (TypeError, ValueError):
        return None


def _collect_price_candidates(node, label=None, out=None):
    """Recursively gather (label, final_price, original_price) tuples from
    any dict that carries price-like keys, across the schema variants
    weedmaps has used (flat price, price_gram-style keys, weight_prices
    arrays with label/price/original_price, sale_price/discounted_price)."""
    if out is None:
        out = []
    if isinstance(node, list):
        for v in node:
            _collect_price_candidates(v, label, out)
        return out
    if not isinstance(node, dict):
        return out

    node_label = None
    for lk in ("label", "unit", "weight"):
        val = node.get(lk)
        if isinstance(val, (str, int, float)) and 0 < len(str(val).strip()) <= 16:
            node_label = str(val).strip()
            break

    base = _as_price(node.get("price"))
    sale = _as_price(node.get("sale_price")) or _as_price(node.get("discounted_price"))
    orig = (_as_price(node.get("original_price")) or _as_price(node.get("list_price"))
            or _as_price(node.get("regular_price")))

    final = sale if sale is not None else base
    if final is not None:
        if orig is None and sale is not None and base is not None and base > sale:
            orig = base
        if orig is not None and orig <= final:
            orig = None
        out.append((node_label or label, final, orig))

    # price_gram / price_half_gram / price_unit style flat keys
    for k, v in node.items():
        k_l = str(k).lower()
        if k_l.startswith("price_") and _as_price(v) is not None:
            out.append((k_l.replace("price_", "").replace("_", " "), _as_price(v), None))
        elif isinstance(v, (dict, list)) and k_l not in ("listing",):
            _collect_price_candidates(v, node_label or label, out)
    return out


def normalize_item(listing, raw):
    if not isinstance(raw, dict):
        return None
    name = raw.get("name") or ""
    if not name:
        return None

    brand = None
    b = raw.get("brand")
    if isinstance(b, dict):
        brand = b.get("name")
    elif isinstance(b, str):
        brand = b
    brand = brand or raw.get("brand_name")

    cat_text = _walk_category_text(raw)
    hay = f"{name} {brand or ''} {cat_text}"
    is_vape = bool(VAPE_RE.search(hay))
    is_disposable = bool(DISPOSABLE_RE.search(hay))

    candidates = _collect_price_candidates(raw)
    candidates = [c for c in candidates if c[1] is not None]
    price = original = unit_label = None
    if candidates:
        unit_label, price, original = min(
            ((lab, p, o) for (lab, p, o) in candidates), key=lambda t: t[1]
        )

    on_sale = bool(
        raw.get("on_sale") or raw.get("is_on_sale")
        or (original is not None and price is not None and original > price)
    )
    pct_off = None
    if on_sale and original and price and original > price:
        pct_off = round(100 * (1 - price / original))

    url = raw.get("url") or raw.get("web_url")
    if url and url.startswith("/"):
        url = WM_WEB + url
    if not url:
        url = listing["web_url"]

    pic = raw.get("picture_url") or raw.get("avatar_url") or raw.get("image_url")

    return {
        "name": name,
        "brand": brand,
        "category": (cat_text.split() and cat_text) or None,
        "is_vape": is_vape,
        "is_disposable": is_disposable,
        "price": price,
        "original_price": original,
        "percent_off": pct_off,
        "on_sale": on_sale,
        "unit_label": unit_label,
        "url": url,
        "picture_url": pic,
        "dispensary": {
            "name": listing["name"],
            "slug": listing["slug"],
            "type": listing["type"],
            "distance_mi": listing["distance_mi"],
            "license_type": listing["license_type"],
            "url": listing["web_url"],
        },
    }


# --------------------------------------------------------------------------
# pipeline
# --------------------------------------------------------------------------

_MOCK = None


def _mock_data():
    global _MOCK
    if _MOCK is None:
        _MOCK = json.loads((ROOT / "mock_data.json").read_text())
    return _MOCK


def get_listings(refresh, errors):
    if CONFIG["mock"]:
        payload = _mock_data()["listings_response"]
        err = ts = None
    else:
        payload, err, ts = fetch_json(listings_url(), refresh)
    if err:
        errors.append({"where": "listings search", "error": err})
    if payload is None:
        return [], ts

    raw_listings = _find_list(
        payload, ("data", "listings"), ("listings",), ("data",)
    )
    wanted = {t.strip() for t in CONFIG["listing_types"].split(",") if t.strip()}
    out = []
    for r in raw_listings:
        n = normalize_listing(r)
        if n and (not wanted or n["type"] in wanted):
            out.append(n)
    return out[: CONFIG["max_listings"]], ts


def get_menu_items(listing, refresh, errors):
    if CONFIG["mock"]:
        payload = _mock_data()["menus"].get(listing["slug"], {})
        raw_items = _find_list(payload, ("data", "menu_items"), ("menu_items",))
        return [normalize_item(listing, r) for r in raw_items]

    items = []
    for page in range(1, CONFIG["menu_pages"] + 1):
        payload, err, _ts = fetch_json(menu_url(listing, page), refresh)
        if err:
            errors.append({"where": f"menu: {listing['name']}", "error": err})
        if payload is None:
            break
        raw_items = _find_list(payload, ("data", "menu_items"), ("menu_items",), ("data",))
        items.extend(normalize_item(listing, r) for r in raw_items)
        if len(raw_items) < 150:
            break
    return items


def build_deals(refresh=False):
    errors = []
    started = time.time()
    listings, cache_ts = get_listings(refresh, errors)

    all_items = []
    if listings:
        with ThreadPoolExecutor(max_workers=CONFIG["workers"]) as pool:
            futures = {
                pool.submit(get_menu_items, l, refresh, errors): l for l in listings
            }
            for fut in as_completed(futures):
                try:
                    all_items.extend(i for i in fut.result() if i)
                except Exception as e:  # noqa: BLE001 - surface, don't crash
                    errors.append({
                        "where": f"menu: {futures[fut]['name']}",
                        "error": f"{type(e).__name__}: {e}",
                    })

    vape_items = [i for i in all_items if i["is_vape"]]
    vape_items.sort(key=lambda i: (i["price"] is None, i["price"] or 0))

    return {
        "generated_at": time.time(),
        "took_s": round(time.time() - started, 2),
        "mock": CONFIG["mock"],
        "location": {"lat": CONFIG["lat"], "lng": CONFIG["lng"],
                     "radius_mi": CONFIG["radius_mi"]},
        "listings_scanned": len(listings),
        "listings": [
            {k: l[k] for k in ("name", "slug", "distance_mi", "web_url", "license_type")}
            for l in listings
        ],
        "items_total": len(all_items),
        "items": vape_items,
        "errors": errors,
    }


def probe():
    """Hit each upstream endpoint once and report what works from here."""
    report = {"listings_url": listings_url(page_size=5)}
    payload, err, _ = fetch_json(listings_url(page_size=5), refresh=True)
    report["listings_ok"] = err is None and payload is not None
    report["listings_error"] = err
    listing = None
    if payload:
        raw = _find_list(payload, ("data", "listings"), ("listings",), ("data",))
        listing = next((normalize_listing(r) for r in raw if normalize_listing(r)), None)
        report["sample_listing"] = listing and listing["name"]
    if listing:
        report["menu_url"] = menu_url(listing, page_size=5)
        mpayload, merr, _ = fetch_json(menu_url(listing, page_size=5), refresh=True)
        raw_items = _find_list(mpayload or {}, ("data", "menu_items"), ("menu_items",))
        report["menu_ok"] = merr is None and bool(raw_items)
        report["menu_error"] = merr
        report["sample_item"] = raw_items[0].get("name") if raw_items else None
    return report


# --------------------------------------------------------------------------
# http server
# --------------------------------------------------------------------------

class Handler(BaseHTTPRequestHandler):
    server_version = "DealScout/1.0"

    def _send(self, code, body, ctype="application/json; charset=utf-8"):
        payload = body if isinstance(body, bytes) else json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):  # noqa: N802 - http.server API
        parts = urlsplit(self.path)
        query = parse_qs(parts.query)
        try:
            if parts.path in ("/", "/index.html"):
                html = (ROOT / "static" / "index.html").read_bytes()
                self._send(200, html, "text/html; charset=utf-8")
            elif parts.path == "/api/config":
                cfg = {k: v for k, v in CONFIG.items() if k not in ("cache_dir",)}
                self._send(200, cfg)
            elif parts.path == "/api/deals":
                refresh = query.get("refresh", ["0"])[0] in ("1", "true")
                self._send(200, build_deals(refresh))
            elif parts.path == "/api/probe":
                self._send(200, probe())
            else:
                self._send(404, {"error": "not found"})
        except BrokenPipeError:
            pass
        except Exception as e:  # noqa: BLE001 - keep the server up
            self._send(500, {"error": f"{type(e).__name__}: {e}"})

    def log_message(self, fmt, *args):
        sys.stderr.write("[dealscout] %s\n" % (fmt % args))


def main():
    if "--probe" in sys.argv:
        result = probe()
        print(json.dumps(result, indent=2))
        sys.exit(0 if result.get("listings_ok") else 1)

    addr = (CONFIG["bind"], CONFIG["port"])
    srv = ThreadingHTTPServer(addr, Handler)
    mode = " (MOCK DATA)" if CONFIG["mock"] else ""
    print(f"[dealscout] serving on http://{addr[0]}:{addr[1]}{mode}")
    print(f"[dealscout] location {CONFIG['lat']},{CONFIG['lng']} "
          f"r={CONFIG['radius_mi']}mi, scanning up to {CONFIG['max_listings']} menus")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\n[dealscout] bye")


if __name__ == "__main__":
    main()
