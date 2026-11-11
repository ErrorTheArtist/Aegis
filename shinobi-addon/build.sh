#!/usr/bin/env bash
# Packages the add-on into dist/WayOfTheShinobi.mcaddon (double-click / open it to import into Minecraft).
# IMPORTANT: bump the version in BOTH manifest.json files for every release, or Minecraft keeps the old copy.
set -euo pipefail
cd "$(dirname "$0")"
rm -rf dist && mkdir -p dist/tmp
cp -r behavior_pack "dist/tmp/Way of The Shinobi BP"
cp -r resource_pack "dist/tmp/Way of The Shinobi RP"
(cd dist/tmp && zip -qr ../WayOfTheShinobi.mcaddon "Way of The Shinobi BP" "Way of The Shinobi RP")
rm -rf dist/tmp
echo "Built dist/WayOfTheShinobi.mcaddon"
