# -------------------------
# 1. ビルド環境のステージ (依存関係のインストール用)
# -------------------------
# Node.jsのバージョンを指定
FROM node:22 AS builder

# 作業ディレクトリを /app に設定
WORKDIR /app

# appフォルダ内のpackage.jsonとpackage-lock.jsonを先にコピー
COPY package*.json ./

# 依存関係をクリーンインストール
RUN npm ci

# appフォルダ内のすべてのソースコードをコピー
COPY . .

# -------------------------
# 2. 実行環境のステージ (実際に動かす用)
# -------------------------
FROM node:22-alpine

# 作業ディレクトリを /app に設定
WORKDIR /app

# ビルドステージから、インストール済みのnode_modulesとソースコードをコピー
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/index.js ./index.js
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/start.sh ./start.sh

# start.shに実行権限を付与
RUN chmod +x ./start.sh

# start.sh を実行してコンテナを起動
CMD ["./start.sh"]