# FastAPI 服务端入驻 monorepo，客户端构建期注入服务器信息

联网后端采用 FastAPI + SQLite + uv，作为 `server/` 子目录放在本 Electron 仓库内，CI 构建 Docker 镜像推 GHCR，手动部署（预计 https://api.fishpet.ddoo.tech，与 PocketID 不同机）。客户端所需的服务器信息（`POCKET_ID_ISSUER`、`FISH_API_BASE_URL`、`FISH_OIDC_CLIENT_ID`、`FISH_API_RESOURCE`）在 CI 打包时从 GitHub variables 注入构建产物。

## Considered Options

- **TypeScript 后端**：与客户端同栈，但作者选择了 FastAPI；后端复杂度极低（五个端点），异构栈的成本可接受。
- **BFF 机密客户端模式**（后端持有 client secret、中转登录）：Electron 安装包可被解包，打进包里的 secret 不构成机密性；BFF 要求后端自建 session 机制，复杂度收益为负。按 RFC 8252 采用公共客户端 + PKCE，客户端不含任何 secret。
- **运行时配置服务器地址**：桌面宠物没有运营环境切换需求，构建期注入最简单；这些 URL 与 client ID 本身不是秘密，公开无碍。

## Consequences

- CI 需要为 server 增加 Docker 镜像构建任务，并在客户端打包 job 中注入上述环境变量。
- 开发模式下客户端从 `.env.local` 读取同一组变量。
