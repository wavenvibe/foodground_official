#\!/usr/bin/env python3
"""probe_report.py — 식품안전나라 C002 probe (http + https 모두 시도)."""
from __future__ import annotations
import json, os, socket, sys
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent.parent / ".env")
except ImportError:
    pass

KEY = os.getenv("MFDS_REPORT_KEY", "").strip()
UA  = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
       "AppleWebKit/537.36 (KHTML, like Gecko) "
       "Chrome/126.0.0.0 Safari/537.36")


def fetch(url, timeout=20):
    req = Request(url, headers={"User-Agent": UA})
    try:
        with urlopen(req, timeout=timeout) as r:
            return r.status, r.read().decode("utf-8", errors="replace")
    except HTTPError as e:
        b = e.read().decode("utf-8", errors="replace") if e.fp else ""
        return e.code, b
    except (URLError, socket.timeout, TimeoutError) as e:
        reason = getattr(e, "reason", str(e))
        return 0, f"CONNECT_FAIL: {reason}"
    except Exception as e:
        return -1, f"EXC {type(e).__name__}: {e}"


def resolve(host):
    try:
        return socket.gethostbyname(host)
    except Exception as e:
        return f"DNS 실패: {e}"


def main():
    if not KEY:
        print("MFDS_REPORT_KEY 비어있음.", file=sys.stderr)
        return 1

    host = "openapi.foodsafetykorea.go.kr"
    print(f"KEY : {KEY[:6]}...{KEY[-4:]} (len={len(KEY)})")
    print(f"DNS : {host} → {resolve(host)}")
    print()

    for scheme in ("http", "https"):
        url = f"{scheme}://{host}/api/{KEY}/C002/json/1/5"
        print(f"[{scheme:5}]  {url.replace(KEY, '***')}")
        status, body = fetch(url)
        print(f"  status={status}")
        if body.startswith("CONNECT_FAIL") or body.startswith("EXC"):
            print(f"  {body}")
            continue
        if body.strip().startswith("{"):
            try:
                data = json.loads(body)
                root = data.get("C002", data)
                result = root.get("RESULT", {})
                total  = root.get("total_count")
                rows   = root.get("row", [])
                print(f"  RESULT: {result}")
                print(f"  total_count: {total}")
                print(f"  rows: {len(rows)}")
                if rows:
                    print(f"  keys: {list(rows[0].keys())}")
                    print(f"  sample[0]: {json.dumps(rows[0], ensure_ascii=False)[:400]}")
                return 0
            except json.JSONDecodeError:
                print("  JSON 파싱 실패")
                print(body[:400])
        else:
            print(body[:400])
        print()
    return 2


if __name__ == "__main__":
    sys.exit(main())
