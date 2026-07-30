import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, join, normalize, relative, resolve } from "node:path";
import { createGzip } from "node:zlib";

const mimeTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8"
};

const compressibleTypes = new Set([".css", ".html", ".js", ".json", ".txt", ".webmanifest", ".xml"]);

function parseArguments(argv: string[]) {
  const options = {
    directory: "out",
    hostname: "127.0.0.1",
    port: 3000
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--hostname" || value === "--host") {
      options.hostname = argv[index + 1] ?? options.hostname;
      index += 1;
      continue;
    }

    if (value === "--port") {
      options.port = Number(argv[index + 1] ?? options.port);
      index += 1;
      continue;
    }

    if (value === "--listen") {
      const listen = argv[index + 1] ?? "";
      const match = /^tcp:\/\/([^:]+):(\d+)$/u.exec(listen);
      if (match) {
        options.hostname = match[1];
        options.port = Number(match[2]);
      } else if (/^\d+$/u.test(listen)) {
        options.port = Number(listen);
      }
      index += 1;
      continue;
    }

    if (!value.startsWith("-")) {
      options.directory = value;
    }
  }

  return options;
}

async function fileExists(path: string) {
  try {
    const result = await stat(path);
    return result.isFile() ? path : null;
  } catch {
    return null;
  }
}

async function resolveRequestPath(root: string, requestUrl = "/") {
  const url = new URL(requestUrl, "http://localhost");
  const decodedPath = decodeURIComponent(url.pathname);
  const safePath = normalize(decodedPath).replace(/^(\.\.(\/|\\|$))+/u, "");
  const withoutLeadingSlash = safePath.replace(/^\/+/u, "");
  const basePath = resolve(root, withoutLeadingSlash);

  if (relative(root, basePath).startsWith("..")) {
    return null;
  }

  const candidates = decodedPath.endsWith("/")
    ? [join(basePath, "index.html")]
    : [basePath, `${basePath}.html`, join(basePath, "index.html")];

  for (const candidate of candidates) {
    const existing = await fileExists(candidate);
    if (existing) {
      return existing;
    }
  }

  return fileExists(join(root, "404.html"));
}

const options = parseArguments(process.argv.slice(2));
const root = resolve(options.directory);

const server = createServer(async (request, response) => {
  const path = await resolveRequestPath(root, request.url);
  if (!path) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }

  const isNotFound = path.endsWith("404.html");
  const extension = extname(path);
  const shouldCompress = compressibleTypes.has(extension) && request.headers["accept-encoding"]?.includes("gzip");
  const headers: Record<string, string> = {
    "Cache-Control": path.includes(`${resolve(root, "_next", "static")}`) ? "public, max-age=31536000, immutable" : "public, max-age=0, must-revalidate",
    "Content-Type": mimeTypes[extension] ?? "application/octet-stream",
    ...(shouldCompress ? { "Content-Encoding": "gzip", Vary: "Accept-Encoding" } : {})
  };

  response.writeHead(isNotFound ? 404 : 200, headers);

  if (request.method === "HEAD") {
    response.end();
    return;
  }

  const stream = createReadStream(path);
  if (shouldCompress) {
    stream.pipe(createGzip()).pipe(response);
    return;
  }

  stream.pipe(response);
});

server.listen(options.port, options.hostname, () => {
  console.log(`Serving ${root} at http://${options.hostname}:${options.port}`);
});
