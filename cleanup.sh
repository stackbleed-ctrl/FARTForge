#!/usr/bin/env bash
# FartForge repo cleanup + restructure script
# Run from the repo root AFTER cloning the fixed files from this zip into place.
#
# What this does:
#   1. Removes the accidental zip from git history (requires git-filter-repo or BFG)
#   2. Deletes the flat-root files that have been moved to proper directories
#   3. Moves fartforge-banner.jpg to ui/public/

set -e

echo "💨 FartForge Cleanup Script"
echo "==========================="
echo ""

# ── 1. Remove the zip from git history ───────────────────────────────────────
echo "→ Removing fartforge-1.zip from git history..."
if command -v git-filter-repo &>/dev/null; then
  git filter-repo --path fartforge-1.zip --invert-paths --force
  echo "  ✓ Removed via git-filter-repo"
elif command -v bfg &>/dev/null; then
  git clone --mirror . /tmp/fartforge-mirror
  bfg --delete-files fartforge-1.zip /tmp/fartforge-mirror
  cd /tmp/fartforge-mirror && git reflog expire --expire=now --all && git gc --prune=now --aggressive
  echo "  ✓ Removed via BFG. Push with: git push --force"
else
  echo "  ⚠ Neither git-filter-repo nor bfg found."
  echo "    Install git-filter-repo: pip install git-filter-repo"
  echo "    Then run: git filter-repo --path fartforge-1.zip --invert-paths"
fi

echo ""

# ── 2. Delete flat-root files replaced by proper directory structure ──────────
echo "→ Removing misplaced flat-root files..."

FILES_TO_DELETE=(
  "route.ts"
  "route (1).ts"
  "route (2).ts"
  "route (3).ts"
  "page.tsx"
  "layout.tsx"
  "globals.css"
  "AgentChat.tsx"
  "BattleMode.tsx"
  "FartArena3D.tsx"
  "FartHeader.tsx"
  "FartSettings.tsx"
  "FirehoseTicker.tsx"
  "Leaderboard.tsx"
  "OdorHUD.tsx"
  "ShakeToFart.tsx"
  "WalletProviders.tsx"
  "WaveformViz.tsx"
  "types.ts"
  "manifest.json"
  "__init__ (1).py"
  "fartforge-1.zip"
)

for f in "${FILES_TO_DELETE[@]}"; do
  if [ -f "$f" ]; then
    git rm -f "$f" 2>/dev/null || rm -f "$f"
    echo "  ✓ Removed: $f"
  fi
done

echo ""

# ── 3. Move banner image ──────────────────────────────────────────────────────
if [ -f "fartforge-banner.jpg" ]; then
  mkdir -p ui/public
  git mv "fartforge-banner.jpg" "ui/public/fartforge-banner.jpg" 2>/dev/null || \
    mv "fartforge-banner.jpg" "ui/public/fartforge-banner.jpg"
  echo "→ Moved fartforge-banner.jpg → ui/public/"
fi

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "Next steps:"
echo "  cd ui && npm install && npm run dev"
echo "  pip install -e '.[all]'"
echo ""
echo "May the smelliest agent win. 💨"
