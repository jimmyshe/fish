---
name: release
description: Release a new client (v*) or server (server-v*) version of Fish Pet, including version bump, README sync, git tagging, and publishing GitHub Release changelog notes via gh CLI. Use when the user asks to release, bump version, tag, or publish a new version.
---

# Fish Pet 发版流程

按以下顺序执行发版，每一步需满足完成条件后再进入下一步。

## 客户端发版（`vX.Y.Z`）

### 步骤 1：发版前检查与功能提交

1. 确认所有待发版的功能、修复与文档已按 Conventional Commits（`feat(...)` / `fix(...)`）提交，工作区干净。
2. 运行静态检查与单元测试：
   ```bash
   npm run check && npm test
   ```
3. 记录 `npm test` 输出的总单元测试数量，供下一步同步 `README.md`。

**完成条件**：`git status -s` 为空，`npm run check` 与 `npm test` 全部通过且退出码为 `0`。

### 步骤 2：升级版本号并同步 `README.md`

1. 更新以下文件中的版本号为 `X.Y.Z`：
   - `package.json`：`"version": "X.Y.Z"`
   - `package-lock.json`：根对象 `"version"` 与 `packages[""].version` 均改为 `"X.Y.Z"`
   - `README.md`：
     - 标题行：``# Fish Pet 🐟 `vX.Y.Z` ``
     - 技术栈测试数：`- **测试**: Vitest（<N> 个单元测试）+ pytest（后端 15 个）`
     - 若本版本新增了面向用户的特性或模块，同步补充「功能特性」与「项目结构」
2. 再次验证检查与测试通过：
   ```bash
   npm run check && npm test
   ```
3. 提交版本升级：
   ```bash
   git add package.json package-lock.json README.md
   git commit -m "chore: bump version to X.Y.Z"
   ```

**完成条件**：`git show HEAD --stat` 仅包含上述变更文件且提交信息为 `chore: bump version to X.Y.Z`。

### 步骤 3：打标签并推送

```bash
git tag vX.Y.Z
git push origin master && git push origin vX.Y.Z
```

**完成条件**：`master` 分支与 `vX.Y.Z` 标签已推送到 `origin`，GitHub Actions `Build and Release` 工作流已触发。

### 步骤 4：编写 Changelog 并发布 GitHub Release

`electron-builder` 在 CI 中默认创建并上传构建产物到 **Draft** 状态的 Release（且正文为空）。需补全中文 Changelog 并正式发布（`draft: false`）：

1. 查看上个标签以来的提交记录并对照历史 Release 风格：
   ```bash
   git log <prev-tag>..vX.Y.Z --oneline
   gh release view <prev-tag>
   ```
2. 按统一格式编写中文 Changelog（每条以 `- **模块/特性名**：具体说明` 概括面向用户的变更）：
   ```markdown
   - **特性或修复标题**：面向用户的变化说明（涉及配置/持久化文件/ADR 可简明标注）
   ```
3. 发布或编辑 Release：
   - 若 CI 构建已完成并生成了 Draft Release，用 `gh release edit` 写入正文并取消草稿状态；
   - 若需在 CI 传完产物前先创建（`electron-builder` 会自动把产物追加到已存在的同 tag Release），用 `gh release create`。
   - **Windows PowerShell UTF-8 规则**：在 PowerShell 中向 `gh` 管道传中文之前，必须显式设置 UTF-8 编码，避免中文乱码：
     ```powershell
     $OutputEncoding = [System.Text.UTF8Encoding]::new($false)
     [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

     $notes = @'
     - **...**：...
     '@

     # 编辑 CI 已创建的 Draft Release 并正式发布
     $notes | gh release edit vX.Y.Z --title "X.Y.Z" --draft=false -F -
     ```
4. 验证 Release 状态与产物：
   ```powershell
   [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
   gh release view vX.Y.Z
   ```

**完成条件**：`gh release view vX.Y.Z` 显示 `draft: false`、中文 Changelog 编码清晰无乱码，且构建产物（`.exe` / `.zip` / `.AppImage` / `.deb` / `latest*.yml`）已附带。

---

## 后端发版（`server-vX.Y.Z`）

1. 修改 `server/pyproject.toml` 中的 `version = "X.Y.Z"`（CI 会在构建前校验 tag 与该字段一致）。
2. 运行后端单元测试：
   ```bash
   cd server && uv run pytest
   ```
3. 提交、打标签并推送（触发 `server-image` job 构建并推送至 `ghcr.io/<owner>/fish-server`）：
   ```bash
   git add server/pyproject.toml
   git commit -m "chore(server): bump version to X.Y.Z"
   git tag server-vX.Y.Z
   git push origin master && git push origin server-vX.Y.Z
   ```

**完成条件**：`server/pyproject.toml` 版本与 `server-vX.Y.Z` 一致，`uv run pytest` 全部通过，且提交与标签已推送到 `origin`。
