"""Create an Open Wearables API key and store it in backend/.env.

Open Wearables seeds an admin developer from ADMIN_EMAIL / ADMIN_PASSWORD (see its
backend/config/.env). We log in as that admin once, mint a key via
POST /api/v1/developer/api-keys (the key is shown only once) and write it to
OPEN_WEARABLES_API_KEY. The admin password is never stored by us.

    OW_ADMIN_EMAIL=admin@admin.com OW_ADMIN_PASSWORD=... \
        .venv/bin/python scripts/ow_bootstrap.py [--url http://localhost:8000] [--force]
"""
import argparse
import os
import re
import sys
from pathlib import Path

import httpx

ENV_FILE = Path(__file__).resolve().parent.parent / ".env"
KEY_NAME = "hackyeah-backend"


def read_env_key() -> str:
    if not ENV_FILE.exists():
        return ""
    m = re.search(r"^OPEN_WEARABLES_API_KEY=(.*)$", ENV_FILE.read_text(), re.M)
    return m.group(1).strip() if m else ""


def write_env(url: str, key: str) -> None:
    lines = ENV_FILE.read_text().splitlines() if ENV_FILE.exists() else []
    values = {"OPEN_WEARABLES_URL": url, "OPEN_WEARABLES_API_KEY": key}
    seen = set()
    for i, line in enumerate(lines):
        name = line.split("=", 1)[0]
        if name in values:
            lines[i] = f"{name}={values[name]}"
            seen.add(name)
    lines += [f"{k}={v}" for k, v in values.items() if k not in seen]
    ENV_FILE.write_text("\n".join(lines) + "\n")
    ENV_FILE.chmod(0o600)


def key_works(url: str, key: str) -> bool:
    if not key:
        return False
    r = httpx.get(f"{url}/api/v1/users", headers={"X-Open-Wearables-API-Key": key}, timeout=10)
    return r.status_code == 200


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default=os.getenv("OPEN_WEARABLES_URL", "http://localhost:8000"))
    ap.add_argument("--force", action="store_true", help="mint a new key even if the current one works")
    args = ap.parse_args()
    url = args.url.rstrip("/")

    try:
        if not args.force and key_works(url, read_env_key()):
            print("Existing OPEN_WEARABLES_API_KEY works, nothing to do.")
            return 0
        email = os.environ.get("OW_ADMIN_EMAIL")
        password = os.environ.get("OW_ADMIN_PASSWORD")
        if not email or not password:
            print("Set OW_ADMIN_EMAIL and OW_ADMIN_PASSWORD (Open Wearables ADMIN_EMAIL/ADMIN_PASSWORD).")
            return 2
        login = httpx.post(
            f"{url}/api/v1/auth/login", data={"username": email, "password": password}, timeout=15
        )
        if login.status_code != 200:
            print(f"Login failed ({login.status_code}): {login.text[:200]}")
            return 1
        bearer = {"Authorization": f"Bearer {login.json()['access_token']}"}
        created = httpx.post(
            f"{url}/api/v1/developer/api-keys", headers=bearer, json={"name": KEY_NAME}, timeout=15
        )
        created.raise_for_status()
        key = created.json()["key"]
    except httpx.TransportError as e:
        print(f"Cannot reach Open Wearables at {url}: {e}")
        return 1

    write_env(url, key)
    print(f"Created API key '{KEY_NAME}' (prefix {key[:8]}...) and saved it to {ENV_FILE.name}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
