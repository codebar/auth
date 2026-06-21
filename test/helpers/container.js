import { execSync } from "child_process";
import net from "net";
import { Pool } from "pg";

const PORT = parseInt(process.env.AUTH_TEST_PG_PORT || "5433");
const HOST = process.env.AUTH_TEST_PG_HOST || "localhost";
const USER = process.env.AUTH_TEST_PG_USER || "auth";
const PASSWORD = process.env.AUTH_TEST_PG_PASSWORD || "auth";
const DATABASE = process.env.AUTH_TEST_PG_DB || "test";

function log(message) {
  console.log(`[container] ${message}`);
}

function error(message) {
  console.error(`[container] ERROR: ${message}`);
}

function checkContainerCommand() {
  try {
    execSync("command -v container", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function checkContainerService() {
  try {
    const output = execSync("container system status", {
      encoding: "utf8",
    });
    return output.includes("running");
  } catch {
    return false;
  }
}

function checkPort(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);
    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("error", () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

async function waitForPostgres(maxRetries = 30) {
  for (let i = 0; i < maxRetries; i++) {
    if (await checkPort(PORT)) {
      return true;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

async function verifyPostgresConnection() {
  try {
    const pool = new Pool({
      host: HOST,
      port: PORT,
      database: DATABASE,
      user: USER,
      password: PASSWORD,
      connectionTimeoutMillis: 5000,
    });
    await pool.query("SELECT 1");
    await pool.end();
    return true;
  } catch {
    return false;
  }
}

export async function ensurePostgres() {
  // Skip container checks in CI — Postgres is provided as a service
  if (process.env.CI) {
    log("CI detected — skipping container checks");
    return;
  }

  log("Checking prerequisites...");

  if (!checkContainerCommand()) {
    error("apple/container is not installed.");
    error("Install from: https://github.com/apple/container");
    process.exit(1);
  }
  log("container CLI found");

  if (!checkContainerService()) {
    error("container service is not running.");
    error("Start it with: container system start");
    process.exit(1);
  }
  log("container service is running");

  const portOpen = await checkPort(PORT);
  if (!portOpen) {
    log("Postgres not reachable. Starting container...");
    try {
      execSync("scripts/container.sh ensure", { stdio: "inherit" });
    } catch {
      error("Failed to start Postgres container");
      process.exit(1);
    }

    const ready = await waitForPostgres();
    if (!ready) {
      error("Postgres did not become reachable");
      process.exit(1);
    }
  }

  log("Postgres port is reachable");

  const connected = await verifyPostgresConnection();
  if (!connected) {
    error("Cannot authenticate to Postgres");
    process.exit(1);
  }

  log("Postgres connection verified — ready");
}

// Run directly: node test/helpers/container.js
ensurePostgres()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
