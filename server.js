const http = require("http");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");

const HOST = "127.0.0.1";
const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const PARAMS_FILE = path.join(ROOT, "params.json");
const IMAGES_DIR = path.join(ROOT, "images");
const MAPS_DIR = path.join(ROOT, "maps");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const IMAGE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".bmp",
]);

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(data));
}

async function readParamsFile() {
  try {
    const raw = await fsp.readFile(PARAMS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return parsed;
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

async function writeParamsFile(params) {
  const payload = JSON.stringify(params, null, 2) + "\n";
  await fsp.writeFile(PARAMS_FILE, payload, "utf8");
}

function stripExtension(fileName) {
  return fileName.replace(/\.[^/.]+$/, "");
}

function normalizePairKey(fileName) {
  return stripExtension(fileName)
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/-(map|depth|disp|displacement|z|dm)$/i, "");
}

async function readImageFiles(dirPath) {
  try {
    const names = await fsp.readdir(dirPath);
    return names.filter((name) =>
      IMAGE_EXTENSIONS.has(path.extname(name).toLowerCase()),
    );
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function buildImageDepthPairs() {
  const [imageFiles, mapFiles] = await Promise.all([
    readImageFiles(IMAGES_DIR),
    readImageFiles(MAPS_DIR),
  ]);

  const mapByNormalizedKey = new Map();
  mapFiles.forEach((name) => {
    const key = normalizePairKey(name);
    if (!mapByNormalizedKey.has(key)) {
      mapByNormalizedKey.set(key, []);
    }
    mapByNormalizedKey.get(key).push(name);
  });

  const pairs = [];
  imageFiles.forEach((imageName) => {
    const key = normalizePairKey(imageName);
    const maps = mapByNormalizedKey.get(key) || [];
    if (maps.length === 0) {
      return;
    }

    const mapName = maps[0];
    pairs.push({
      id: key || stripExtension(imageName).toLowerCase(),
      label: stripExtension(imageName),
      colorPath: `./images/${imageName}`,
      depthPath: `./maps/${mapName}`,
    });
  });

  return pairs.sort((a, b) => a.label.localeCompare(b.label, "en"));
}

function isSafeSubPath(root, target) {
  const relative = path.relative(root, target);
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative);
}

async function serveStaticFile(reqPath, res) {
  const normalizedPath = reqPath === "/" ? "/point-cloud.html" : reqPath;
  const requestedFile = decodeURIComponent(normalizedPath.split("?")[0]);
  const absolutePath = path.join(ROOT, requestedFile);

  if (!isSafeSubPath(ROOT, absolutePath)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  try {
    const stat = await fsp.stat(absolutePath);
    if (!stat.isFile()) {
      sendJson(res, 404, { error: "Not Found" });
      return;
    }

    const ext = path.extname(absolutePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    res.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "no-cache",
    });

    fs.createReadStream(absolutePath).pipe(res);
  } catch (error) {
    sendJson(res, 404, { error: "Not Found" });
  }
}

function collectRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        req.destroy();
        reject(new Error("Payload too large"));
      }
    });

    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const method = req.method || "GET";
    const url = req.url || "/";

    if (method === "GET" && url === "/api/params") {
      const params = await readParamsFile();
      sendJson(res, 200, params);
      return;
    }

    if (method === "POST" && url === "/api/params") {
      const body = await collectRequestBody(req);
      let payload = {};
      try {
        payload = body ? JSON.parse(body) : {};
      } catch {
        sendJson(res, 400, { error: "Invalid JSON" });
        return;
      }

      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        sendJson(res, 400, { error: "Payload must be an object" });
        return;
      }

      await writeParamsFile(payload);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (method === "GET" && url === "/api/pairs") {
      const pairs = await buildImageDepthPairs();
      sendJson(res, 200, { pairs });
      return;
    }

    await serveStaticFile(url, res);
  } catch (error) {
    sendJson(res, 500, { error: String(error.message || error) });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
});
