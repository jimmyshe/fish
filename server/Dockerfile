# 铲屎计数后端镜像（ADR 0004：CI 构建推 GHCR，手动部署）
FROM python:3.13-slim

# uv 官方二进制（distroless 拷贝，免 pip 安装层）
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev
COPY app ./app

# SQLite 落盘目录：部署时挂卷持久化，如 docker run -v fish-data:/app/data ...
ENV FISH_DB_PATH=/app/data/fish.db
RUN mkdir -p /app/data

EXPOSE 8000
# 运行所需环境变量见 server/.env.example：
# 必填 FISH_POCKETID_ISSUER / FISH_API_RESOURCE；
# 可选 FISH_JWKS_URL / FISH_USERINFO_URL / FISH_REQUIRED_SCOPE / FISH_RATE_LIMIT_PER_MINUTE
CMD ["uv", "run", "--no-sync", "uvicorn", "app.main:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000"]
