import { Hono } from "hono";
import { getConnInfo } from "@hono/node-server/conninfo";
import { devMagicLinks } from "../../dev/magic-links.js";

function isLocal(c) {
  try {
    const info = getConnInfo(c);
    const addr = info.remote.address;
    return (
      addr === "127.0.0.1" || addr === "::1" || addr === "::ffff:127.0.0.1"
    );
  } catch {
    return false;
  }
}

export default new Hono()
  .get("/api/test/magic-links", (c) => {
    if (!isLocal(c)) return c.json({ error: "not available" }, 403);
    return c.json(devMagicLinks);
  })
  .delete("/api/test/magic-links", (c) => {
    if (!isLocal(c)) return c.json({ error: "not available" }, 403);
    devMagicLinks.length = 0;
    return c.json({ cleared: true });
  });
