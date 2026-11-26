const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 5500;
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml"
};

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);

  if ((req.method === "PUT" || req.method === "POST") && /^\/data\.json$/i.test(urlPath)) {
    const chunks = [];
    let size = 0;
    const MAX_BYTES = 10 * 1024 * 1024;

    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BYTES) {
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      if (size > MAX_BYTES) {
        sendJson(res, 413, { ok: false, error: "Payload too large" });
        return;
      }
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.products)) {
          sendJson(res, 400, { ok: false, error: "Invalid Data.json payload" });
          return;
        }
        const target = path.join(ROOT, "Data.json");
        fs.writeFile(target, JSON.stringify(parsed, null, 2) + "\n", "utf8", (err) => {
          if (err) {
            sendJson(res, 500, { ok: false, error: "Could not write Data.json" });
            return;
          }
          sendJson(res, 200, { ok: true });
        });
      } catch (err) {
        sendJson(res, 400, { ok: false, error: "Malformed JSON" });
      }
    });
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405);
    res.end("Method not allowed");
    return;
  }

  const rel = (urlPath === "/" ? "index.html" : urlPath).replace(/^\/+/, "");
  const file = path.resolve(ROOT, rel);
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": types[path.extname(file).toLowerCase()] || "application/octet-stream",
      "Cache-Control": path.extname(file).toLowerCase() === ".json" ? "no-store" : "no-cache"
    });
    res.end(req.method === "HEAD" ? undefined : data);
  });
}).listen(PORT, "127.0.0.1", () => {
  console.log("M.H Chocolate Shop server listening at http://127.0.0.1:" + PORT);
});
