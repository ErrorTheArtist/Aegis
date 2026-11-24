#!/usr/bin/env bash
# Packages the add-on into dist/JujutsuLegacy.mcaddon (open it to import into Minecraft).
# IMPORTANT: bump the version in BOTH manifest.json files for every release, or Minecraft keeps the old copy.
# Never change the pack UUIDs: players' data depends on them.
set -euo pipefail
cd "$(dirname "$0")"
rm -rf dist && mkdir -p dist/tmp
cp -r behavior_pack "dist/tmp/Jujutsu Legacy BP"
cp -r resource_pack "dist/tmp/Jujutsu Legacy RP"
(cd dist/tmp && zip -qr ../JujutsuLegacy.mcaddon "Jujutsu Legacy BP" "Jujutsu Legacy RP")
rm -rf dist/tmp
echo "Built dist/JujutsuLegacy.mcaddon"
