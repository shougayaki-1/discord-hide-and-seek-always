# -------------------------
# 1. ビルド環境のステージ
# -------------------------
FROM node:22 AS builder
WORKDIR /app

# ルートの package.json をコピー
COPY package*.json ./
RUN npm ci

# ルートのファイルをすべてコピー
COPY . .

# -------------------------
# 2. 実行環境のステージ
# -------------------------
FROM node:22-alpine
WORKDIR /app

# ビルドステージから必要なファイルをコピー
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/index.js ./index.js
COPY --from=builder /app/package.json ./package.json
COPY start.sh ./start.sh

RUN chmod +x ./start.sh
EXPOSE 8000
CMD ["./start.sh"]