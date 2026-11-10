#!/usr/bin/env sh
# Serverda yangilash: GitHub'dagi main → qayta qurish → ishga tushirish.
# Baza `tg-code-gateway_gateway-data` volume'ida turadi va yangilashda saqlanadi.
#   sh /opt/tg-code-gateway/app/deploy.sh
set -e
cd "$(dirname "$0")"
git pull --ff-only
docker compose up -d --build
sleep 5
docker ps --filter name=tg-code-gateway --format '{{.Names}} {{.Status}}'
docker logs --tail 5 tg-code-gateway
