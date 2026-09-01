#!/usr/bin/env python3
"""Launch the WSL recovery runner with a UTF-8 secret pipe.

The database password is read directly from the Windows console with getpass,
encoded in memory, and delivered to WSL through stdin.  It is never placed on
the command line, written to disk, or stored in an environment variable.
"""

from __future__ import annotations

import argparse
import base64
import getpass
import subprocess
import sys


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--distribution", default="Ubuntu")
    parser.add_argument("--wsl-script")
    parser.add_argument("--host")
    parser.add_argument("--port")
    parser.add_argument("--user")
    parser.add_argument("--database")
    parser.add_argument("--project-ref")
    parser.add_argument("--run-id")
    parser.add_argument("--verify-sql")
    parser.add_argument("--report")
    return parser


def run_self_test(distribution: str, wsl_script: str | None) -> int:
    token = "FoodGround-UTF8-pipe-test-Az09-_"
    encoded = base64.b64encode(token.encode("utf-8")) + b"\n"
    result = subprocess.run(
        ["wsl.exe", "-d", distribution, "-u", "root", "--", "cat"],
        input=encoded,
        capture_output=True,
        check=False,
    )
    if result.returncode == 0 and result.stdout == encoded:
        print("[PASS] Python UTF-8 secret pipe -> WSL self-test.")
    else:
        print(
            "ERROR: WSL byte-pipe mismatch: "
            f"exit={result.returncode}, expected={encoded.hex()}, actual={result.stdout.hex()}",
            file=sys.stderr,
        )
        return 23

    if wsl_script:
        decode_result = subprocess.run(
            [
                "wsl.exe",
                "-d",
                distribution,
                "-u",
                "root",
                "--",
                "bash",
                wsl_script,
                "--transport-self-test",
            ],
            input=encoded,
            check=False,
        )
        if decode_result.returncode != 0:
            return decode_result.returncode
        print("[PASS] Recovery Bash Base64 decode self-test.")
    return 0


def require_recovery_args(args: argparse.Namespace) -> None:
    required = (
        "wsl_script",
        "host",
        "port",
        "user",
        "database",
        "project_ref",
        "run_id",
        "verify_sql",
        "report",
    )
    missing = [name for name in required if not getattr(args, name)]
    if missing:
        raise SystemExit("Missing required recovery argument(s): " + ", ".join(missing))


def run_recovery(args: argparse.Namespace) -> int:
    require_recovery_args(args)
    password = getpass.getpass("Supabase DB password: ")
    if not password:
        print("ERROR: database password is empty", file=sys.stderr)
        return 2

    password_bytes = bytearray(password.encode("utf-8"))
    password = ""
    payload = bytearray(base64.b64encode(password_bytes))
    payload.append(0x0A)
    for index in range(len(password_bytes)):
        password_bytes[index] = 0

    command = [
        "wsl.exe",
        "-d",
        args.distribution,
        "-u",
        "root",
        "--",
        "bash",
        args.wsl_script,
        "--host",
        args.host,
        "--port",
        args.port,
        "--user",
        args.user,
        "--database",
        args.database,
        "--project-ref",
        args.project_ref,
        "--run-id",
        args.run_id,
        "--verify-sql",
        args.verify_sql,
        "--report",
        args.report,
    ]

    try:
        result = subprocess.run(command, input=bytes(payload), check=False)
        return result.returncode
    finally:
        for index in range(len(payload)):
            payload[index] = 0
        print(
            "[security] Password buffer released. No DB credential environment variable was created."
        )


def main() -> int:
    args = build_parser().parse_args()
    if args.self_test:
        return run_self_test(args.distribution, args.wsl_script)
    return run_recovery(args)


if __name__ == "__main__":
    raise SystemExit(main())
