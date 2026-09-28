#!/usr/bin/env bash
# Usage: scripts/release.sh 0.2.0
# Builds macOS binaries, publishes a GitHub release, and bumps the Homebrew tap formula.
set -euo pipefail
VERSION="${1:?usage: scripts/release.sh <version>}"
REPO=m0hdrar/kanban_tui
TAP=m0hdrar/homebrew-tap

bun install --os=darwin --cpu="*"  # native OpenTUI libs for both archs
bun run typecheck
rm -rf dist && mkdir dist
for ARCH in arm64 x64; do
  bun build --compile --minify --target="bun-darwin-$ARCH" index.ts --outfile dist/kanban
  tar -czf "dist/kanban-darwin-$ARCH.tar.gz" -C dist kanban
  rm dist/kanban
done
SHA_ARM=$(shasum -a 256 dist/kanban-darwin-arm64.tar.gz | cut -d' ' -f1)
SHA_X64=$(shasum -a 256 dist/kanban-darwin-x64.tar.gz | cut -d' ' -f1)

git tag "v$VERSION" && git push origin "v$VERSION"
gh release create "v$VERSION" dist/*.tar.gz --repo "$REPO" --title "v$VERSION" --generate-notes

TMP=$(mktemp -d)
gh repo clone "$TAP" "$TMP" -- -q
mkdir -p "$TMP/Formula"
cat > "$TMP/Formula/kanban.rb" <<RUBY
class Kanban < Formula
  desc "Keyboard-first kanban board for the terminal"
  homepage "https://github.com/$REPO"
  version "$VERSION"
  license "MIT"

  depends_on :macos

  on_arm do
    url "https://github.com/$REPO/releases/download/v$VERSION/kanban-darwin-arm64.tar.gz"
    sha256 "$SHA_ARM"
  end
  on_intel do
    url "https://github.com/$REPO/releases/download/v$VERSION/kanban-darwin-x64.tar.gz"
    sha256 "$SHA_X64"
  end

  def install
    bin.install "kanban"
  end

  test do
    assert_predicate bin/"kanban", :executable?
  end
end
RUBY
git -C "$TMP" add Formula/kanban.rb
git -C "$TMP" commit -qm "kanban $VERSION"
git -C "$TMP" push -q
echo "Released v$VERSION"
