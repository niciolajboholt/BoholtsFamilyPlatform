#!/usr/bin/env python3
"""PostToolUse hook: reminds about D1 migration verification.

Several costly incidents (see 09_Lessons_Learned.md) came from a new
migration file being assumed "applied" without being checked against the
actual database schema. This fires after any edit under
05_App/web/server/migrations/ to keep that check front of mind.
"""
import json
import sys

MIGRATIONS_MARKER = "server/migrations/"


def main() -> int:
    payload = json.load(sys.stdin)
    if payload.get("tool_name") not in {"Edit", "Write"}:
        return 0

    file_path = payload.get("tool_input", {}).get("file_path", "")
    if MIGRATIONS_MARKER not in file_path or not file_path.endswith(".sql"):
        return 0

    print(
        "Migrationsfil ændret: "
        f"{file_path}\n"
        "Husk (09_Lessons_Learned.md): en migration er ikke 'anvendt' bare "
        "fordi filen findes eller CI er grøn. Bekræft direkte mod begge "
        "miljøer efter deploy — enten /api/health's migrations.ok, eller en "
        "sqlite_master-forespørgsel (`SELECT type, name, sql FROM "
        "sqlite_master ...`) mod både beta og produktion. En brugers "
        "'kørt'/'bekræftet' uden denne verifikation er en påstand, ikke en "
        "verifikation."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
