import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { writeFrontendCredentials } from "./export_bdl_credentials.js";

const DEFAULT_PORT = 4173;
const ROOT_DIR = path.join(process.cwd(), "public");

const MIME_TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
};

function resolvePath(urlPath: string): string {
  const withoutQuery = urlPath.split("?")[0]?.split("#")[0] ?? "/";
  let relative = decodeURIComponent(withoutQuery);
  if (relative.endsWith("/")) {
    relative = `${relative}index.html`;
  }
  if (relative === "/") {
    relative = "/index.html";
  }

  const normalized = path
    .normalize(relative)
    .replace(/^\/+/, "")
    .replace(/\\+/g, "/");

  if (normalized.includes("..")) {
    throw new Error("Invalid path");
  }

  return path.join(ROOT_DIR, normalized);
}

function contentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] ?? "application/octet-stream";
}

async function sendFile(res: http.ServerResponse, filePath: string): Promise<void> {
  const data = await fs.readFile(filePath);
  res.statusCode = 200;
  res.setHeader("Content-Type", contentType(filePath));
  if (filePath.endsWith("bdl.json")) {
    res.setHeader("Cache-Control", "no-store");
  } else {
    res.setHeader("Cache-Control", "no-cache");
  }
  res.end(data);
}

async function exists(filePath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(filePath);
    return stats.isFile();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

async function requestListener(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  if (!req.url) {
    res.statusCode = 400;
    res.end("Bad request");
    return;
  }

  try {
    const filePath = resolvePath(req.url);
    if (!filePath.startsWith(ROOT_DIR)) {
      res.statusCode = 403;
      res.end("Forbidden");
      return;
    }

    if (filePath.endsWith(path.join("data", "credentials", "bdl.json"))) {
      await writeFrontendCredentials({ silent: true });
    }

    if (!(await exists(filePath))) {
      // Try HTML fallback when extensionless path requested.
      const withHtml = `${filePath}.html`;
      if (await exists(withHtml)) {
        await sendFile(res, withHtml);
        return;
      }

      res.statusCode = 404;
      res.end("Not found");
      return;
    }

    await sendFile(res, filePath);
  } catch (error) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end(`Server error: ${String(error)}`);
  }
}

async function main(): Promise<void> {
  await writeFrontendCredentials();

  const port = Number.parseInt(process.env.PORT ?? "", 10) || DEFAULT_PORT;
  const server = http.createServer((req, res) => {
    requestListener(req, res).catch((error) => {
      console.error("Failed to handle request", error);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end("Internal server error");
      } else {
        res.destroy();
      }
    });
  });

  server.listen(port, () => {
    console.log(`Dev server running at http://localhost:${port}`);
  });
}

const entryFile = process.argv[1] ? path.resolve(process.argv[1]) : null;
const currentFile = fileURLToPath(import.meta.url);

if (entryFile && entryFile === currentFile) {
  main().catch((error) => {
    console.error("Failed to start dev server:", error);
    process.exitCode = 1;
  });
}
