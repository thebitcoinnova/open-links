import { createReadStream, existsSync } from "node:fs";
import { type ServerResponse, createServer } from "node:http";
import path from "node:path";
import {
  getCacheControlForArtifactPath,
  getS3ContentEncoding,
  getS3ContentType,
} from "../lib/deploy-artifact";
import { parseArgs } from "./shared";

const args = parseArgs(process.argv.slice(2));
const rootDirectory = path.resolve(args.root ?? ".artifacts/deploy/railway");
const port = Number(args.port ?? process.env.PORT ?? "3000");

if (!Number.isFinite(port) || port <= 0) {
  throw new Error(`Invalid port '${args.port ?? process.env.PORT ?? ""}'.`);
}

const server = createServer((request, response) => {
  const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
  const relativePath = resolveRequestPath(requestUrl.pathname);
  const absolutePath = path.join(rootDirectory, relativePath);

  if (existsSync(absolutePath)) {
    streamFile(response, absolutePath, relativePath, 200);
    return;
  }

  if (requestUrl.pathname.includes(".")) {
    const maybeNotFoundPath = path.join(rootDirectory, "404.html");
    if (existsSync(maybeNotFoundPath)) {
      streamFile(response, maybeNotFoundPath, "404.html", 404);
      return;
    }

    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not Found");
    return;
  }

  streamFile(response, path.join(rootDirectory, "index.html"), "index.html", 200);
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Serving ${rootDirectory} on http://0.0.0.0:${port}`);
});

function resolveRequestPath(pathname: string) {
  const normalizedPath = pathname.replace(/^\/+/u, "").replace(/\.\.+/gu, "");

  if (normalizedPath.length === 0) {
    return "index.html";
  }

  if (normalizedPath.endsWith("/")) {
    return `${normalizedPath}index.html`;
  }

  if (path.extname(normalizedPath).length === 0) {
    return `${normalizedPath}/index.html`;
  }

  return normalizedPath;
}

function streamFile(
  response: ServerResponse,
  absolutePath: string,
  relativePath: string,
  status: number,
) {
  const headers: Record<string, string> = {
    "cache-control": getCacheControlForArtifactPath(relativePath),
    "content-type": getS3ContentType(relativePath),
  };
  const maybeContentEncoding = getS3ContentEncoding(relativePath);
  if (maybeContentEncoding) {
    headers["content-encoding"] = maybeContentEncoding;
  }

  response.writeHead(status, headers);
  createReadStream(absolutePath).pipe(response);
}
