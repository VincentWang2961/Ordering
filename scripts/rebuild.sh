#!/bin/bash
# Rebuild and redeploy the Docker app container
# Sources .env.local for NEXT_PUBLIC_ build args
set -euo pipefail

cd "$(dirname "$0")"

# Source NEXT_PUBLIC_ vars for Docker build
if [ -f .env.local ]; then
  export "$(grep '^NEXT_PUBLIC_' .env.local | xargs)"
fi

echo "Building with NEXT_PUBLIC_GOOGLE_MAPS_API_KEY..."
sudo docker compose build --build-arg "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=${NEXT_PUBLIC_GOOGLE_MAPS_API_KEY:-}"

echo "Restarting..."
sudo docker compose down
sudo docker compose up -d

echo "Done! $(curl -s -o /dev/null -w 'HTTP %{http_code}' http://localhost:3000/admin)"
