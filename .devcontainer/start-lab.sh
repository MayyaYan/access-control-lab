#!/usr/bin/env bash
set -eu
for port in 3000 3001; do
  if curl --silent --fail "http://127.0.0.1:${port}/api/health" >/dev/null; then
    echo "Стенд на порту ${port} уже работает"
    continue
  fi
  mode=vulnerable
  if [ "$port" = 3001 ]; then mode=fixed; fi
  nohup env LAB_MODE="$mode" PORT="$port" node server.mjs >"/tmp/access-control-lab-${port}.log" 2>&1 </dev/null &
  echo "Запущен ${mode} на порту ${port}; журнал /tmp/access-control-lab-${port}.log"
done
  
