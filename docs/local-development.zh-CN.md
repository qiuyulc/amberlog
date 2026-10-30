# 本地源码构建与启动

默认的 `examples/quickstart/compose.yaml` 使用远程的 `ghcr.io/visdata-com/amberlog:latest` 镜像。它适合直接试用，但不会读取当前工作树里的 Rust 或前端改动。

前端的构建结果会写入 `crates/server/src/ui/index.html`，随后由 Rust 服务通过 `include_str!` 编进可执行文件。因此只在 `ui/` 下运行 `pnpm build`，再执行 `docker compose up -d --wait`，容器仍然会使用远程镜像，界面不会变化。

## 使用当前源码启动

在仓库根目录执行：

```sh
cd examples/quickstart
docker compose -f compose.yaml -f compose.local.yaml up -d --build --wait
```

这里的 `compose.local.yaml` 会把 `amberlog` 服务切换为本地构建。`Dockerfile.local` 在镜像构建过程中完成两步：

1. 使用 Node 24 和 pnpm 10.34.7 构建 `ui/`，生成内嵌页面。
2. 使用项目要求的 Rust 1.98.1 编译 `amberlog-server`，把页面编进最终二进制。

第一次构建会下载 Node、Rust、Cargo 和 npm 依赖，耗时取决于网络和电脑性能；后续构建会复用 Docker 缓存。修改前端或 Rust 代码后，仍使用同一条命令，`--build` 会重新构建需要更新的层。

启动后打开：

- 本机：<http://127.0.0.1:8800/ui>
- 同一网络的其他设备：`http://<本机局域网 IP>:8800/ui`
- 快速试用令牌：`quickstart-token`

现有 MinIO 与 Amberlog 数据卷会沿用，不会因为重新构建镜像而清空。

## 修改前端后的验证

Docker 构建会自动执行前端打包。若要在本机先做类型检查、测试或查看生成文件，可以在 `ui/` 下执行：

```sh
source "$HOME/.nvm/nvm.sh"
nvm use 24.11.1
pnpm typecheck
pnpm test
pnpm build
pnpm check
```

本机执行 `pnpm build` 只会更新工作树里的内嵌 HTML；要让运行中的容器使用它，仍需回到 `examples/quickstart` 执行：

```sh
docker compose -f compose.yaml -f compose.local.yaml up -d --build --wait
```

可以用响应内容确认容器确实加载了当前版本：

```sh
curl -fsS http://127.0.0.1:8800/ui | rg 'detail-backdrop|实际读取量'
```

如果命令能匹配到当前改动中的标记，说明容器已经不是远程旧镜像。浏览器仍显示旧样式时，再做一次强制刷新（macOS：`Command + Shift + R`）。

## 前端快速开发模式

如果只修改 `ui/src`，不需要每次重新构建 Docker 镜像。先按上一节启动一次 Amberlog 容器，然后另开终端：

```sh
cd ui
source "$HOME/.nvm/nvm.sh"
nvm use 24.11.1
pnpm dev
```

开发服务器会监听 `ui/src`，自动运行前端构建，并把页面请求之外的 API 请求代理到 `http://127.0.0.1:8800`。打开：

```text
http://127.0.0.1:5173/ui
```

修改 `.tsx` 或 `.css` 后，页面会自动刷新；Rust 服务和 Docker 容器不需要重建。局域网内的其他设备要访问时，使用：

```sh
AMBERLOG_UI_DEV_HOST=0.0.0.0 pnpm dev
```

然后打开 `http://<本机局域网 IP>:5173/ui`。如果修改了 Rust 接口或配置，仍需回到 Compose 命令重新构建 `amberlog` 镜像。

## 默认镜像与本地镜像的区别

```sh
# 远程发布镜像：不会编译当前工作树
docker compose up -d --wait

# 当前源码：会构建 Dockerfile.local 并替换 amberlog 服务
docker compose -f compose.yaml -f compose.local.yaml up -d --build --wait
```

`docker compose up -d --wait` 只负责启动已有镜像；只有增加 `--build`，并且使用包含 `build:` 的本地覆盖文件，才会把当前代码编进镜像。

## 停止、重启与清理

```sh
# 停止容器，保留数据
docker compose -f compose.yaml -f compose.local.yaml stop

# 删除容器和网络，保留数据卷
docker compose -f compose.yaml -f compose.local.yaml down

# 删除容器、网络和数据卷；会清空本地试用数据，谨慎执行
docker compose -f compose.yaml -f compose.local.yaml down -v
```

重新启动时再次执行带 `--build --wait` 的命令即可。`down -v` 会删除 MinIO 数据和 Amberlog WAL，只有确定不再需要现有数据时才使用。
