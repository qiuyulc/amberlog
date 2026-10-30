// 本地前端开发服务器：监听 ui/src，自动重新生成内嵌页面，并把 API 请求代理到 Amberlog。
// 生产环境仍由 Rust 以 include_str! 提供页面；这个脚本只用于本地开发，避免每次改 UI 都重编 Rust。

import { readFile } from "node:fs/promises";
import { watch } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer, request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { spawn } from "node:child_process";

const uiDir = dirname(fileURLToPath(import.meta.url));
const pagePath = resolve(uiDir, "../crates/server/src/ui/index.html");
const sourcePath = resolve(uiDir, "src");
const host = process.env.AMBERLOG_UI_DEV_HOST ?? "127.0.0.1";
const port = Number(process.env.AMBERLOG_UI_DEV_PORT ?? "5173");
const apiOrigin = new URL(process.env.AMBERLOG_API_ORIGIN ?? "http://127.0.0.1:8800");

let buildRunning = false;
let buildQueued = false;
let buildTimer;
const liveClients = new Set();

function runBuild() {
  if (buildRunning) {
    buildQueued = true;
    return;
  }
  buildRunning = true;
  const child = spawn(process.execPath, ["build.mjs"], {
    cwd: uiDir,
    stdio: "inherit",
  });
  child.on("exit", (code, signal) => {
    buildRunning = false;
    if (code === 0) {
      for (const response of liveClients) response.write("data: reload\\n\\n");
    } else {
      console.error(`前端构建失败（退出码 ${code ?? "?"}${signal ? `，信号 ${signal}` : ""}）`);
    }
    if (buildQueued) {
      buildQueued = false;
      scheduleBuild();
    }
  });
}

function scheduleBuild() {
  clearTimeout(buildTimer);
  buildTimer = setTimeout(runBuild, 100);
}

function servePage(response) {
  readFile(pagePath, "utf8")
    .then((html) => {
      const liveReload =
        '<script>new EventSource("/__amberlog_live").onmessage=()=>location.reload();</script>';
      const body = html.includes("</body>") ? html.replace("</body>", `${liveReload}</body>`) : `${html}${liveReload}`;
      response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
      response.end(body);
    })
    .catch((error) => {
      response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      response.end(`无法读取前端页面：${error}`);
    });
}

function proxyRequest(request, response) {
  const target = new URL(request.url, apiOrigin);
  const headers = { ...request.headers, host: target.host };
  const transport = target.protocol === "https:" ? httpsRequest : httpRequest;
  const upstream = transport(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port,
      method: request.method,
      path: `${target.pathname}${target.search}`,
      headers,
    },
    (upstreamResponse) => {
      response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
      upstreamResponse.pipe(response);
    },
  );
  upstream.on("error", (error) => {
    if (!response.headersSent) response.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    response.end(`无法连接 Amberlog（${apiOrigin.origin}）：${error.message}`);
  });
  request.pipe(upstream);
}

await new Promise((resolveReady) => {
  const server = createServer((request, response) => {
    const pathname = new URL(request.url, `http://${request.headers.host ?? "localhost"}`).pathname;
    if (pathname === "/ui" || pathname === "/") {
      servePage(response);
      return;
    }
    if (pathname === "/__amberlog_live") {
      response.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive",
      });
      response.write("retry: 1000\\n\\n");
      liveClients.add(response);
      request.on("close", () => liveClients.delete(response));
      return;
    }
    proxyRequest(request, response);
  });

  server.listen(port, host, () => {
    console.log(`Amberlog 前端开发服务器：http://${host}:${port}/ui`);
    console.log(`API 代理：${apiOrigin.origin}`);
    console.log("监听 ui/src，修改后会自动构建并刷新浏览器");
    resolveReady();
  });

  const watcher = watch(sourcePath, { recursive: true }, () => scheduleBuild());
  const close = () => {
    watcher.close();
    server.close();
    for (const response of liveClients) response.end();
  };
  process.once("SIGINT", close);
  process.once("SIGTERM", close);
});

runBuild();
