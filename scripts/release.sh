#!/usr/bin/env bash
# Usage: scripts/release.sh 0.2.0
# Builds macOS and Linux binaries, publishes a GitHub release, and bumps the Homebrew tap formula.
set -euo pipefail
VERSION="${1:?usage: scripts/release.sh <version>}"
REPO=m0hdrar/kanban_tui
TAP=m0hdrar/homebrew-tap
BIN=kanban-tui

bun install --os="*" --cpu="*"  # native OpenTUI libs for every target
bun test
bun run typecheck
rm -rf dist && mkdir dist
for OS in darwin linux; do
  for ARCH in arm64 x64; do
    bun build --compile --minify --target="bun-$OS-$ARCH" index.ts --outfile "dist/$BIN"
    tar --no-xattrs --no-mac-metadata -czf "dist/$BIN-$OS-$ARCH.tar.gz" -C dist "$BIN"
    rm "dist/$BIN"
  done
done
sha() { shasum -a 256 "dist/$BIN-$1.tar.gz" | cut -d' ' -f1; }

git tag "v$VERSION" && git push origin "v$VERSION"
gh release create "v$VERSION" dist/*.tar.gz --repo "$REPO" --title "v$VERSION" --generate-notes

TMP=$(mktemp -d)
gh repo clone "$TAP" "$TMP" -- -q
mkdir -p "$TMP/Formula"
cat > "$TMP/Formula/$BIN.rb" <<RUBY
class KanbanTui < Formula
  desc "Keyboard-first kanban board for the terminal"
  homepage "https://github.com/$REPO"
  version "$VERSION"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/$REPO/releases/download/v$VERSION/$BIN-darwin-arm64.tar.gz"
      sha256 "$(sha darwin-arm64)"
    end
    on_intel do
      url "https://github.com/$REPO/releases/download/v$VERSION/$BIN-darwin-x64.tar.gz"
      sha256 "$(sha darwin-x64)"
    end
  end
  on_linux do
    on_arm do
      url "https://github.com/$REPO/releases/download/v$VERSION/$BIN-linux-arm64.tar.gz"
      sha256 "$(sha linux-arm64)"
    end
    on_intel do
      url "https://github.com/$REPO/releases/download/v$VERSION/$BIN-linux-x64.tar.gz"
      sha256 "$(sha linux-x64)"
    end
  end

  def install
    bin.install "$BIN"
  end

  test do
    assert_predicate bin/"$BIN", :executable?
  end
end
RUBY
git -C "$TMP" rm -q --ignore-unmatch Formula/kanban.rb  # old formula name from v0.1.0
git -C "$TMP" add "Formula/$BIN.rb"
git -C "$TMP" commit -qm "$BIN $VERSION"
git -C "$TMP" push -q
echo "Released v$VERSION"
