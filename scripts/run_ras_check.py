#!/usr/bin/env python3
"""
run_ras_check.py — KTCC Server RAS 자체 검증 스크립트

기준: 1초 간격 GET /healthz, 5일간 서버 중단 없음, 5분(300초) 연속 무응답 시 실패
내부 버퍼: 6시간 연속 감시 (기본)

사용법:
  python scripts/run_ras_check.py --url https://yoursite.com --duration 21600
  python scripts/run_ras_check.py --url http://localhost:3000 --duration 60  # 테스트

출력: data/ras_log.jsonl (KTCC 제출용)
"""
from __future__ import annotations
import argparse, json, os, sys, time
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError

DEFAULT_URL = os.getenv("RAS_URL", "http://localhost:3000")
LOG_PATH = Path(__file__).parent.parent / "data" / "ras_log.jsonl"

INTERVAL_S = 1          # 요청 간격 (초)
FAIL_THRESHOLD_S = 300  # 연속 실패 허용 한도 (5분)
DEFAULT_DURATION_S = 21600  # 기본 감시 시간 (6시간)


def check_healthz(url: str, timeout: float = 5.0) -> dict:
    ts = datetime.now(timezone.utc).isoformat()
    t0 = time.monotonic()
    try:
        req = Request(f"{url}/api/healthz", headers={"User-Agent": "FoodgroundRAS/1.0"})
        with urlopen(req, timeout=timeout) as resp:
            body = resp.read(256).decode("utf-8", errors="replace")
            elapsed_ms = round((time.monotonic() - t0) * 1000)
            return {
                "ts": ts,
                "status": resp.status,
                "ok": resp.status == 200,
                "ms": elapsed_ms,
                "body": body[:100],
            }
    except (HTTPError, URLError, OSError) as exc:
        elapsed_ms = round((time.monotonic() - t0) * 1000)
        return {
            "ts": ts,
            "status": 0,
            "ok": False,
            "ms": elapsed_ms,
            "error": str(exc),
        }


def main() -> int:
    ap = argparse.ArgumentParser(description="KTCC Server RAS 자체 검증")
    ap.add_argument("--url", default=DEFAULT_URL, help="서버 기본 URL")
    ap.add_argument(
        "--duration",
        type=int,
        default=DEFAULT_DURATION_S,
        help=f"감시 총 시간 (초, 기본 {DEFAULT_DURATION_S})",
    )
    ap.add_argument(
        "--fail-threshold",
        type=int,
        default=FAIL_THRESHOLD_S,
        help=f"연속 실패 허용 한도 (초, 기본 {FAIL_THRESHOLD_S})",
    )
    ap.add_argument("--log", default=str(LOG_PATH), help="JSONL 로그 경로")
    args = ap.parse_args()

    log_path = Path(args.log)
    log_path.parent.mkdir(parents=True, exist_ok=True)

    url = args.url.rstrip("/")
    duration = args.duration
    fail_threshold = args.fail_threshold

    print(f"[RAS] 대상: {url}/api/healthz")
    print(f"[RAS] 감시 시간: {duration}s ({duration/3600:.1f}h)")
    print(f"[RAS] 연속 실패 한도: {fail_threshold}s")
    print(f"[RAS] 로그: {log_path}")
    print("[RAS] Ctrl+C 로 중단\n")

    start_mono = time.monotonic()
    deadline = start_mono + duration

    total = 0
    ok_count = 0
    fail_count = 0
    consecutive_fail_s = 0.0
    max_consecutive_fail_s = 0.0
    final_status = "pass"

    with log_path.open("a", encoding="utf-8") as logf:
        while time.monotonic() < deadline:
            result = check_healthz(url)
            logf.write(json.dumps(result, ensure_ascii=False) + "\n")
            logf.flush()
            total += 1

            if result["ok"]:
                ok_count += 1
                if consecutive_fail_s > 0:
                    print(
                        f"  → 복구됨 (연속 실패 {consecutive_fail_s:.0f}s)",
                        flush=True,
                    )
                consecutive_fail_s = 0.0
            else:
                fail_count += 1
                consecutive_fail_s += INTERVAL_S
                max_consecutive_fail_s = max(max_consecutive_fail_s, consecutive_fail_s)
                err = result.get("error", f"HTTP {result['status']}")
                print(
                    f"  [FAIL] {result['ts']}  {err}  연속실패={consecutive_fail_s:.0f}s",
                    flush=True,
                )

                if consecutive_fail_s >= fail_threshold:
                    final_status = "fail"
                    print(
                        f"\n[RAS] ❌ 연속 실패 {consecutive_fail_s:.0f}s ≥ {fail_threshold}s 한도 초과 — FAIL",
                        file=sys.stderr,
                    )
                    break
            else:
                elapsed = time.monotonic() - start_mono
                remaining = duration - elapsed
                if total % 60 == 0:
                    print(
                        f"  [OK] 경과 {elapsed:.0f}s  남은 {remaining:.0f}s  "
                        f"성공률 {ok_count/total*100:.1f}%",
                        flush=True,
                    )

            # 다음 요청까지 대기 (처리 시간 고려)
            sleep_s = max(0.0, INTERVAL_S - (result["ms"] / 1000))
            if sleep_s > 0:
                time.sleep(sleep_s)

    summary = {
        "summary": True,
        "ts": datetime.now(timezone.utc).isoformat(),
        "url": url,
        "duration_s": duration,
        "total_requests": total,
        "ok": ok_count,
        "fail": fail_count,
        "max_consecutive_fail_s": max_consecutive_fail_s,
        "result": final_status,
    }
    with log_path.open("a", encoding="utf-8") as logf:
        logf.write(json.dumps(summary, ensure_ascii=False) + "\n")

    uptime_pct = ok_count / total * 100 if total else 0
    icon = "✅" if final_status == "pass" else "❌"
    print(f"\n{icon} 결과: {final_status.upper()}")
    print(f"   총 요청: {total}  성공: {ok_count}  실패: {fail_count}")
    print(f"   가동률: {uptime_pct:.3f}%")
    print(f"   최대 연속 실패: {max_consecutive_fail_s:.0f}s")
    print(f"   로그: {log_path}")

    return 0 if final_status == "pass" else 1


if __name__ == "__main__":
    sys.exit(main())
