# 代码与构建沙箱镜像（docs/06 §5.3、docs/07 §4）。
# 阶段 1（准备，联网）和阶段 2（执行，--network=none）用同一个镜像，保证依赖的原生二进制和运行平台一致。
FROM node:24.15.0-bookworm-slim

ARG PNPM_VERSION=12.23.0
ARG AST_GREP_VERSION=0.51.2

# 定位工具：git（查 log / blame）、ripgrep、ast-grep（06 §5.3「容器里预装定位工具」）
RUN apt-get update \
 && apt-get install -y --no-install-recommends git ripgrep ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && npm install -g --no-fund --no-audit "pnpm@${PNPM_VERSION}" "@ast-grep/cli@${AST_GREP_VERSION}" \
 && npm cache clean --force

# 非 root 运行；node 镜像自带 uid 1000 的 node 用户
USER node
ENV HOME=/home/node \
    CI=true \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    PNPM_CONFIG_MANAGE_PACKAGE_MANAGER_VERSIONS=false
WORKDIR /work
