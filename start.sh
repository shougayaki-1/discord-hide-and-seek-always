#!/bin/sh

echo "--- start.shスクリプトを開始します ---"

# 1. 環境変数が設定されているか確認
echo "環境変数 GOOGLE_CREDENTIALS_BASE64 を確認中..."
if [ -z "$GOOGLE_CREDENTIALS_BASE64" ]; then
  echo "ERROR: GOOGLE_CREDENTIALS_BASE64 環境変数が空か、設定されていません！"
  echo "KoyebのService設定 -> Environment variables を確認してください。"
  exit 1 # ここでスクリプトをエラー終了させる
else
  echo "GOOGLE_CREDENTIALS_BASE64 は設定されています。長さ: ${#GOOGLE_CREDENTIALS_BASE64} 文字"
fi

# 2. 秘密のファイルを保存するディレクトリを作成
echo "秘密ファイル用のディレクトリを作成中: /app/secrets"
mkdir -p /app/secrets

# ディレクトリが正常に作成されたか確認
if [ -d "/app/secrets" ]; then
  echo "ディレクトリ /app/secrets は正常に作成されました。"
else
  echo "ERROR: ディレクトリ /app/secrets の作成に失敗しました。"
  exit 1
fi

# 3. Base64文字列をデコードしてファイルに書き出す
FILE_PATH="/app/secrets/google-credentials.json"
echo "Base64文字列をデコードし、ファイルに書き込み中: $FILE_PATH"

# デコード処理を実行
echo "$GOOGLE_CREDENTIALS_BASE64" | base64 -d > "$FILE_PATH"

# 4. ファイルが正常に作成されたか確認
if [ -f "$FILE_PATH" ]; then
  echo "ファイル $FILE_PATH は正常に作成されました。"
  echo "ファイルの権限と詳細情報:"
  ls -l "$FILE_PATH" # ファイルの詳細情報を表示

  echo "ファイルの先頭数行の内容:"
  head -n 5 "$FILE_PATH" # ファイルの最初の5行を表示 (内容が正しいか確認)
else
  echo "ERROR: ファイル $FILE_PATH の作成に失敗しました。"
  exit 1
fi

echo "--- start.shスクリプト完了。Node.jsアプリを起動します ---"

# 準備が整ったらBotを起動する
exec node index.js