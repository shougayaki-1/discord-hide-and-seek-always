#!/bin/sh
# ==========================================
# リアル隠れ鬼ごっこ Discord Bot - 起動スクリプト (Linux/共通)
# macOS用の start-mac.command からもこのスクリプトが呼び出されます。
# ==========================================

cd "$(dirname "$0")" || exit 1

echo "========================================"
echo "  リアル隠れ鬼ごっこ Discord Bot"
echo "========================================"
echo ""

# --- Node.js の確認 ---
if ! command -v node >/dev/null 2>&1; then
  echo "[ERROR] Node.js が見つかりません。"
  echo ""
  echo "Node.jsをインストールしてから再度実行してください。"
  echo "https://nodejs.org/"
  exit 1
fi
echo "[OK] Node.js"

# --- npm の確認 ---
if ! command -v npm >/dev/null 2>&1; then
  echo "[ERROR] npm が見つかりません。"
  echo ""
  echo "Node.jsをインストールしてください（npmはNode.jsに同梱されています）。"
  echo "https://nodejs.org/"
  exit 1
fi
echo "[OK] npm"

# --- .env の確認 ---
if [ ! -f ".env" ]; then
  echo "[ERROR] .env が見つかりません。"
  echo ""
  echo ".env を作成し、以下を設定してください。"
  echo ""
  echo "DISCORD_TOKEN=..."
  echo "DISCORD_CLIENT_ID=..."
  exit 1
fi
echo "[OK] .env"

# --- 依存関係の確認（node_modules が無い、または package-lock.json/package.json の方が新しければ再インストール） ---
LOCK_FILE="package-lock.json"
[ -f "$LOCK_FILE" ] || LOCK_FILE="package.json"

NEED_INSTALL=0
if [ ! -d "node_modules" ]; then
  NEED_INSTALL=1
elif [ "$LOCK_FILE" -nt "node_modules" ]; then
  NEED_INSTALL=1
fi

if [ "$NEED_INSTALL" -eq 1 ]; then
  echo "依存関係をインストールしています (npm install)..."
  echo ""
  npm install
  if [ $? -ne 0 ]; then
    echo ""
    echo "[ERROR] npm install に失敗しました。"
    exit 1
  fi
fi
echo "[OK] dependencies"

echo ""
echo "Botを起動します..."
echo ""
echo "----------------------------------------"
echo "このウィンドウを閉じるか Ctrl+C で終了します。"
echo "----------------------------------------"
echo ""

npm start
STATUS=$?

# 130 = Ctrl+C (SIGINT), 143 = SIGTERM。ユーザーによる意図的な終了として扱う。
if [ "$STATUS" -ne 0 ] && [ "$STATUS" -ne 130 ] && [ "$STATUS" -ne 143 ]; then
  echo ""
  echo "[ERROR] Botが予期せず終了しました。(exit code: $STATUS)"
fi

exit "$STATUS"
