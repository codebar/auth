#!/bin/bash
set -e

CONTAINER_NAME="auth-dev-pg"
VOLUME_NAME="auth-dev-pg-data"

# Env vars with defaults
AUTH_TEST_PG_PORT="${AUTH_TEST_PG_PORT:-5433}"
AUTH_TEST_PG_USER="${AUTH_TEST_PG_USER:-auth}"
AUTH_TEST_PG_PASSWORD="${AUTH_TEST_PG_PASSWORD:-auth}"
AUTH_TEST_PG_DB="${AUTH_TEST_PG_DB:-test}"

if ! command -v container >/dev/null 2>&1; then
    echo "apple/container not installed — skipping container management"
    case "${1:-}" in
        start|stop|restart|logs|destroy) exit 1 ;;
        ensure|status) exit 0 ;;
        *) exit 1 ;;
    esac
fi

container_exists() {
    local output
    output=$(container inspect "$CONTAINER_NAME" 2>/dev/null)
    [ -n "$output" ] && [ "$output" != "[]" ]
}

container_is_running() {
    container inspect "$CONTAINER_NAME" 2>/dev/null | grep -q '"Running": true'
}

wait_for_port() {
    local port="$1"
    for _ in $(seq 1 30); do
        if nc -z 127.0.0.1 "$port" 2>/dev/null; then
            return 0
        fi
        sleep 1
    done
    return 1
}

start() {
    if container_is_running; then
        echo "$CONTAINER_NAME is already running (port $AUTH_TEST_PG_PORT -> 5432)"
        exit 0
    fi

    if container_exists; then
        echo "Starting existing $CONTAINER_NAME..."
        container start "$CONTAINER_NAME"
    else
        echo "Creating and starting Postgres on port $AUTH_TEST_PG_PORT..."
        container run -d \
            --name "$CONTAINER_NAME" \
            -p "${AUTH_TEST_PG_PORT}:5432" \
            -e POSTGRES_USER="$AUTH_TEST_PG_USER" \
            -e POSTGRES_PASSWORD="$AUTH_TEST_PG_PASSWORD" \
            -e POSTGRES_DB="$AUTH_TEST_PG_DB" \
            -v "${VOLUME_NAME}:/var/lib/postgresql/data" \
            postgres:16-alpine
    fi

    echo "Waiting for Postgres on port $AUTH_TEST_PG_PORT..."
    if wait_for_port "$AUTH_TEST_PG_PORT"; then
        echo "$CONTAINER_NAME is running (port $AUTH_TEST_PG_PORT -> 5432)"
    else
        echo "ERROR: Postgres failed to start"
        container logs "$CONTAINER_NAME"
        exit 1
    fi
}

stop() {
    if container_is_running; then
        echo "Stopping $CONTAINER_NAME..."
        container stop "$CONTAINER_NAME" 2>/dev/null || true
        echo "Stopped"
    else
        echo "$CONTAINER_NAME is not running"
    fi
}

destroy() {
    echo "Destroying $CONTAINER_NAME and its data..."
    container stop "$CONTAINER_NAME" 2>/dev/null || true
    container delete "$CONTAINER_NAME" 2>/dev/null || true
    container volume delete "$VOLUME_NAME" 2>/dev/null || true
    echo "Destroyed"
}

status() {
    if container_is_running; then
        echo "$CONTAINER_NAME: running (port ${AUTH_TEST_PG_PORT} -> 5432)"
    elif container_exists; then
        echo "$CONTAINER_NAME: stopped"
    else
        echo "$CONTAINER_NAME: not created"
    fi
}

logs() {
    container logs "$CONTAINER_NAME" 2>/dev/null || echo "Container not found"
}

ensure() {
    if container_is_running; then
        if nc -z 127.0.0.1 "$AUTH_TEST_PG_PORT" 2>/dev/null; then
            exit 0
        fi
        echo "Container running but port not reachable, restarting..."
        stop
        start
    elif container_exists; then
        start
    else
        start
    fi
}

case "$1" in
    start) start ;;
    stop) stop ;;
    destroy) destroy ;;
    status) status ;;
    logs) logs ;;
    ensure) ensure ;;
    restart) stop; start ;;
    *)
        echo "Usage: $0 {start|stop|status|logs|ensure|restart|destroy}"
        echo ""
        echo "Commands:"
        echo "  start    Create/start the container (data persists across restarts)"
        echo "  stop     Stop the container (data is preserved)"
        echo "  destroy  Stop, delete container, and wipe all data"
        echo "  restart  Stop then start"
        echo "  status   Show container state"
        echo "  logs     Show container logs"
        echo "  ensure   Start if not running, restart if unhealthy"
        echo ""
        echo "Environment variables (with defaults):"
        echo "  AUTH_TEST_PG_PORT      Host port (5433)"
        echo "  AUTH_TEST_PG_USER      Postgres user (auth)"
        echo "  AUTH_TEST_PG_PASSWORD  Postgres password (auth)"
        echo "  AUTH_TEST_PG_DB        Database name (test)"
        exit 1
        ;;
esac
