# -------------------------
# 1. ビルド環境のステージ (依存関係のインストール用)
# -------------------------
# Node.jsのバージョンを指定
FROM node:22 AS builder

# 作業ディレクトリを /app に設定
WORKDIR /app

# app/ 内の package.json をコピーして依存をインストール
# リポジトリのルートではなく app ディレクトリ配下に package.json がある構成に対応
COPY app/package*.json ./

# 依存関係をクリーンインストール
RUN npm ci

# app ディレクトリ以下のソースを /app にコピー
COPY app/ ./

# -------------------------
# 2. 実行環境のステージ (実際に動かす用)
# -------------------------

FROM node:22-alpine

# 作業ディレクトリを /app に設定
WORKDIR /app

# ビルドステージから、インストール済み node_modules と必要ファイルをコピー
# 注意: セキュリティ上の理由で secrets（例: config.json / google-credentials.json）は .dockerignore により除外される想定です。
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/index.js ./index.js
COPY --from=builder /app/package.json ./package.json
COPY start.sh ./start.sh

# start.shに実行権限を付与
RUN chmod +x ./start.sh

# KoyebがPORT環境変数で指定するポートを開放する
EXPOSE 8000

# start.sh を実行してコンテナを起動
CMD ["./start.sh"]