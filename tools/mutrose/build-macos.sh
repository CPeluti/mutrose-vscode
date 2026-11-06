#!/usr/bin/env bash
# Builds a native arm64/x86-64 MutRoSe binary on macOS using the Homebrew toolchain,
# since the bundled binaries/mutrose is a Linux x86-64 ELF and cannot run on macOS
# (and deadlocks under Docker/qemu emulation).
#
# Usage: tools/mutrose/build-macos.sh [install-path]
#   MUTROSE_INSTALL   overrides the install path (default: ~/.local/bin/mutrose)
#   MUTROSE_SRC_DIR   overrides the clone location (default: ~/src/MutRoSe-Mission-Decomposer)
#   MUTROSE_REF       pinned commit/tag to build (default: a known-good commit)
set -euo pipefail

SRC_DIR="${MUTROSE_SRC_DIR:-$HOME/src/MutRoSe-Mission-Decomposer}"
INSTALL_PATH="${1:-${MUTROSE_INSTALL:-$HOME/.local/bin/mutrose}}"
REF="${MUTROSE_REF:-9e91d93}"
REPO_URL="https://github.com/ericbg27/MutRoSe-Mission-Decomposer.git"

for dep in boost bison flex; do
  if ! brew list --versions "$dep" >/dev/null 2>&1; then
    echo "==> Installing $dep via Homebrew"
    brew install "$dep"
  fi
done

BISON_PREFIX="$(brew --prefix bison)"
FLEX_PREFIX="$(brew --prefix flex)"
BOOST_PREFIX="$(brew --prefix boost)"
export PATH="$BISON_PREFIX/bin:$FLEX_PREFIX/bin:$PATH"

if [ ! -d "$SRC_DIR" ]; then
  echo "==> Cloning MutRoSe-Mission-Decomposer into $SRC_DIR"
  git clone "$REPO_URL" "$SRC_DIR"
fi

cd "$SRC_DIR"
git fetch --quiet origin
git checkout --quiet "$REF"

# Upstream's makefile links -static (unsupported on macOS) and -lboost_system
# (removed from Boost since 1.69; filesystem is the only lib still needed).
sed -i '' 's/ -lboost_system//' makefile

echo "==> Building MutRoSe (native $(uname -m))"
bash clean-objects.sh >/dev/null 2>&1 || true
make -j4 CC=c++ \
  COMPILEFLAGS="-O3 -pipe -Wall -Wextra -pedantic -std=c++17 -Wno-unused-parameter -I${BOOST_PREFIX}/include" \
  LINKERFLAG="-O3 -L${BOOST_PREFIX}/lib"

mkdir -p "$(dirname "$INSTALL_PATH")"
cp MutroseMissionDecomposer "$INSTALL_PATH"
chmod +x "$INSTALL_PATH"

echo "==> Installed MutRoSe at $INSTALL_PATH"
echo "    Set \"mutrose.path\": \"$INSTALL_PATH\" in your workspace settings.json"
