#!/usr/bin/env bash
# Vercel "Ignored Build Step" gate — set as the Ignored Build Step command in
# Project Settings -> Git:  bash scripts/vercel-ignore-build.sh
#
# Vercel semantics are inverted on purpose:
#   exit 0        -> the build is SKIPPED (no deploy)
#   exit non-zero -> the build PROCEEDS (deploy)
# So we let the build through only when the same checks CI runs all pass;
# if any fails, we exit 0 and Vercel skips the deploy.

set -o pipefail

echo "Running pre-deploy checks (lint, typecheck, test)..."

# pnpm is provided via corepack in the Vercel build image; ignore if already on.
corepack enable >/dev/null 2>&1 || true

if pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm test; then
	echo "✓ Checks passed — allowing Vercel build."
	exit 1
else
	echo "✗ Checks failed — skipping deploy."
	exit 0
fi
