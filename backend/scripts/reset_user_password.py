"""Backward-compatible wrapper for the TaskFlow administration CLI."""

import argparse

from app.cli import main as cli_main


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Reset one existing TaskFlow account password."
    )
    parser.add_argument("--email", required=True, help="Exact existing account email")
    args = parser.parse_args()
    return cli_main(["reset-password", args.email])


if __name__ == "__main__":
    raise SystemExit(main())
