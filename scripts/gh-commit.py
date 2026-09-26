#!/usr/bin/env python3
"""
gh-commit.py -- commit files directly to GitHub via REST API.
Usage: python3 gh-commit.py "commit message" file1 file2 ...
Reads PAT from bx-reservations-deploy_pat.txt in repo root.
"""
import sys, os, base64, json
from pathlib import Path
from urllib import request, error

REPO   = os.environ.get("GH_REPO",   "Brainerd-Baptist/BXReservations")
BRANCH = os.environ.get("GH_BRANCH", "main")

def get_pat(repo_root):
    pat = os.environ.get("GH_PAT")
    if pat:
        return pat.strip()
    for name in ["bx-reservations-deploy_pat.txt"]:
        p = repo_root / name
        if p.exists():
            return p.read_text().strip()
    raise RuntimeError("No PAT found -- set GH_PAT env var or place bx-reservations-deploy_pat.txt in repo root")

def api(method, path, body=None, pat=None):
    url = "https://api.github.com" + path
    data = json.dumps(body).encode() if body is not None else None
    req = request.Request(url, data=data, method=method, headers={
        "Authorization": "Bearer " + pat,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
        "User-Agent": "bx-gh-commit/1.0",
    })
    try:
        with request.urlopen(req) as r:
            return json.loads(r.read())
    except error.HTTPError as e:
        raise RuntimeError("GitHub API " + method + " " + path + " -> " + str(e.code) + ": " + e.read().decode()) from e

def commit(message, file_paths, repo_root):
    pat = get_pat(repo_root)
    ref = api("GET", "/repos/" + REPO + "/git/ref/heads/" + BRANCH, pat=pat)
    head_sha = ref["object"]["sha"]
    commit_data = api("GET", "/repos/" + REPO + "/git/commits/" + head_sha, pat=pat)
    base_tree_sha = commit_data["tree"]["sha"]
    tree_items = []
    for fp in file_paths:
        full = repo_root / fp
        if not full.exists():
            print("  skip (not found): " + fp, file=sys.stderr)
            continue
        raw = full.read_bytes()
        try:
            content = raw.decode("utf-8")
            encoding = "utf-8"
        except UnicodeDecodeError:
            content = base64.b64encode(raw).decode()
            encoding = "base64"
        blob = api("POST", "/repos/" + REPO + "/git/blobs", {"content": content, "encoding": encoding}, pat=pat)
        tree_items.append({"path": fp, "mode": "100644", "type": "blob", "sha": blob["sha"]})
        print("  blob: " + fp)
    if not tree_items:
        print("Nothing to commit.")
        return None
    tree = api("POST", "/repos/" + REPO + "/git/trees", {"base_tree": base_tree_sha, "tree": tree_items}, pat=pat)
    new_commit = api("POST", "/repos/" + REPO + "/git/commits", {"message": message, "tree": tree["sha"], "parents": [head_sha]}, pat=pat)
    api("PATCH", "/repos/" + REPO + "/git/refs/heads/" + BRANCH, {"sha": new_commit["sha"], "force": False}, pat=pat)
    sha7 = new_commit["sha"][:7]
    print("\n OK " + sha7 + " pushed to " + REPO + ":" + BRANCH)
    print("  https://github.com/" + REPO + "/commit/" + new_commit["sha"])
    return new_commit["sha"]

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: gh-commit.py 'message' file1 file2 ...", file=sys.stderr)
        sys.exit(1)
    msg = sys.argv[1]
    files = sys.argv[2:]
    repo_root = Path(__file__).parent.parent
    print("Committing " + str(len(files)) + " file(s) to " + REPO + ":" + BRANCH + "...")
    result = commit(msg, files, repo_root)
    sys.exit(0 if result else 1)
