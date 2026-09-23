"""Interactively verify login and JWT continuity without printing the token."""

import argparse
import getpass
import json
import urllib.error
import urllib.request


def request_json(url: str, *, data=None, token: str | None = None):
    headers = {"Accept": "application/json"}
    if data is not None:
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = urllib.request.Request(
        url,
        data=json.dumps(data).encode("utf-8") if data is not None else None,
        headers=headers,
        method="POST" if data is not None else "GET",
    )
    with urllib.request.urlopen(request, timeout=15) as response:
        return response.status, json.load(response)


def main() -> int:
    parser = argparse.ArgumentParser(description="Smoke-test TaskFlow authentication.")
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument("--email", required=True)
    args = parser.parse_args()
    password = getpass.getpass("Password: ")
    base_url = args.base_url.rstrip("/")
    try:
        login_status, login = request_json(
            f"{base_url}/api/auth/login",
            data={"email": args.email.strip(), "password": password},
        )
        token = login.get("accessToken", "")
        me_status, me = request_json(f"{base_url}/api/auth/me", token=token)
    except urllib.error.HTTPError as error:
        print(f"HTTP status: {error.code}")
        print(error.read().decode("utf-8", errors="replace"))
        return 1

    print(f"Login HTTP status: {login_status}")
    print(f"JWT returned: {bool(token)}")
    print(f"JWT segments: {len(token.split('.')) if token else 0}")
    print(f"Profile returned: {bool(login.get('user'))}")
    print(f"Session HTTP status: {me_status}")
    print(f"Session user matches: {me.get('user', {}).get('id') == login.get('user', {}).get('id')}")
    return 0 if login_status == me_status == 200 and token else 1


if __name__ == "__main__":
    raise SystemExit(main())
