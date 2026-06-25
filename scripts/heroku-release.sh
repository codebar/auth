#!/bin/sh
# Release phase script - runs after build, before new dynos start.
# Using a script file (vs inline in Procfile) allows:
# - Explicit error handling with set -e (fails release if migrations fail)
# - Clear logging of release phase progress
# - Easy extension for future release tasks (seeding, cache warming, etc.)
set -e

echo "Running database migrations and seeding..."
node scripts/migrate.js

echo "Release phase complete!"
