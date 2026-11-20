#!/usr/bin/env bash
# Métricas de visitas a partir de los logs de acceso de Caddy.
# Uso:  ./visitas.sh            -> resumen últimos 60 min
#       ./visitas.sh 24h        -> resumen de las últimas 24h
set -uo pipefail
RANGE="${1:-60m}"

# Solo logs de acceso (http.log.access), con IP real (client_ip)
acc() {
  docker logs --since "$RANGE" ticketve-caddy-1 2>&1 | grep '"http.log.access"'
}

echo "############ VISITAS (últimos $RANGE) ############"
echo "requests:                 $(acc | wc -l)"
echo "IPs únicas (visitas):     $(acc | grep -oE '"client_ip":"[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+"' | cut -d'"' -f4 | sort -u | wc -l)"
echo "páginas distintas:        $(acc | grep -oE '"uri":"[^"]+"' | cut -d'"' -f4 | grep -vE '^/(_next|uploads)' | sort -u | wc -l)"

echo
echo "--- top visitantes (requests por IP) ---"
acc | grep -oE '"client_ip":"[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+"' | cut -d'"' -f4 \
  | grep -vE '^(127\.|172\.1[6-9]\.|172\.2[0-9]\.|172\.3[01]\.|10\.|192\.168\.)' \
  | sort | uniq -c | sort -rn | head -12

echo
echo "--- top páginas (excluyendo assets y API interna) ---"
acc | grep -oE '"uri":"[^"]+"' | cut -d'"' -f4 \
  | grep -vE '^/(_next|uploads|api/)' \
  | sort | uniq -c | sort -rn | head -15

echo
echo "--- códigos de respuesta ---"
acc | grep -oE '"status":[0-9]+' | cut -d: -f2 | sort | uniq -c | sort -rn

echo
echo "--- por hora (UTC) ---"
acc | grep -oE '"ts":[0-9]+\.' | cut -d: -f2 | tr -d '.' \
  | awk '{print strftime("%Y-%m-%d %H:00", $1)}' | sort | uniq -c
