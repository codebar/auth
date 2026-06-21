#!/bin/bash
# ponytail: nginx reverse proxy in front of Node.js app
# nginx takes $PORT, app takes $((PORT + 1))
set -e

APP_PORT=$((PORT + 1))

# Render nginx config with the real PORT
erb config/nginx.conf.erb > config/nginx.conf

# Start nginx in background (daemon off so it stays in foreground but bg'd for our script)
nginx -p . -c config/nginx.conf &

# Start Node app with its own port
PORT=$APP_PORT exec npm start
