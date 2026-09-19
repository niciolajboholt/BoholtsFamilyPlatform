#!/usr/bin/env python3
"""PreToolUse hook: blocks direct `git push` to main/develop.

Boholts Family Platform ships changes via branch + pull request only
(main/develop are GitHub-protected). This is a defense-in-depth guard so
Claude itself never attempts a direct push, rather than relying solely on
GitHub rejecting it after the fact.
"""
import json
import re
import subprocess
import sys

PROTECTED = {"main", "develop"}

HEREDOC_RE = re.compile(r"<<-?\s*(['\"]?)(\w+)\1")
QUOTED_RE = re.compile(r"'[^']*'|\"[^\"]*\"")


def strip_noise(command: str) -> str:
    """Strip heredoc bodies and quoted strings so prose (e.g. a commit
    message that merely *mentions* "git push") doesn't trigger a false
    match on an actual, unquoted `git push` invocation."""
    lines = command.split("\n")
    without_heredocs: list[str] = []
    i = 0
    while i < len(lines):
        line = lines[i]
        match = HEREDOC_RE.search(line)
        if match:
            delimiter = match.group(2)
            without_heredocs.append(line[: match.start()])
            i += 1
            while i < len(lines) and lines[i].strip() != delimiter:
                i += 1
            i += 1  # skip the closing delimiter line itself
            continue
        without_heredocs.append(line)
        i += 1
    return QUOTED_RE.sub("", "\n".join(without_heredocs))


def current_branch(cwd: str) -> str | None:
    try:
        result = subprocess.run(
            ["git", "-C", cwd, "branch", "--show-current"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        branch = result.stdout.strip()
        return branch or None
    except Exception:
        return None


def push_targets(command: str) -> set[str]:
    """Best-effort extraction of branch names a `git push` targets."""
    targets: set[str] = set()
    for segment in re.split(r"&&|;|\|", command):
        if not re.search(r"\bgit\s+push\b", segment):
            continue
        # Explicit refspec: origin HEAD:main / origin foo:develop
        for match in re.finditer(r"[:\s](?:refs/heads/)?(main|develop)\b", segment):
            targets.add(match.group(1))
        # `git push` with no explicit branch at all -> pushes current branch
        tokens = segment.split()
        push_idx = next((i for i, t in enumerate(tokens) if t == "push"), None)
        if push_idx is not None:
            rest = tokens[push_idx + 1 :]
            positional = [t for t in rest if not t.startswith("-")]
            # drop a leading remote name (origin, upstream, ...)
            if positional and ":" not in positional[0] and positional[0] not in PROTECTED:
                positional = positional[1:]
            if not positional:
                targets.add("__current_branch__")
    return targets


def main() -> int:
    payload = json.load(sys.stdin)
    if payload.get("tool_name") != "Bash":
        return 0

    raw_command = payload.get("tool_input", {}).get("command", "")
    command = strip_noise(raw_command)
    if not re.search(r"\bgit\s+push\b", command):
        return 0

    targets = push_targets(command)
    if "__current_branch__" in targets:
        targets.discard("__current_branch__")
        branch = current_branch(payload.get("cwd", "."))
        if branch in PROTECTED:
            targets.add(branch)

    blocked = targets & PROTECTED
    if blocked:
        branch = next(iter(blocked))
        print(
            f"Direkte push til '{branch}' er blokeret. main/develop er "
            "beskyttede branches i Boholts Family Platform — lever ændringen "
            "via en branch + pull request i stedet (se README's "
            "'Repository-strategi' og 06_Claude_Playbook.md).",
            file=sys.stderr,
        )
        return 2

    return 0


if __name__ == "__main__":
    sys.exit(main())
