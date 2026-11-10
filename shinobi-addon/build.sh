#!/usr/bin/env bash
# Packages the add-on into dist/ShinobiWay.mcaddon (double-click / open it to import into Minecraft).
set -euo pipefail
cd "$(dirname "$0")"
rm -rf dist && mkdir -p dist/tmp
cp -r behavior_pack "dist/tmp/Shinobi Way BP"
cp -r resource_pack "dist/tmp/Shinobi Way RP"
(cd dist/tmp && zip -qr ../ShinobiWay.mcaddon "Shinobi Way BP" "Shinobi Way RP")
rm -rf dist/tmp
echo "Built dist/ShinobiWay.mcaddon"
