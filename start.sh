#!/bin/sh

# 環境変数からBase64エンコードされた認証情報をファイルに書き出す
# まず、保存先のディレクトリを作成
mkdir -p /usr/src/app/secrets

# 環境変数から受け取った文字列をデコードしてファイルに保存
echo "$GOOGLE_CREDENTIALS_BASE64" | base64 -d > /usr/src/app/secrets/google-credentials.json

# ファイルの準備ができたら、Botを起動する
# exec を使うことで、シェルプロセスがNodeプロセスに置き換わる
exec node index.js