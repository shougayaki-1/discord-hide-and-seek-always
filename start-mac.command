#!/bin/bash
# ==========================================
# リアル隠れ鬼ごっこ Discord Bot - macOS用起動スクリプト
# Finderでダブルクリックすると実行されます。
# ==========================================

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR" || exit 1

sh "$DIR/start.sh"
STATUS=$?

# 130 = Ctrl+C (SIGINT), 143 = SIGTERM。ユーザーによる意図的な終了として扱う。
if [ "$STATUS" -ne 0 ] && [ "$STATUS" -ne 130 ] && [ "$STATUS" -ne 143 ]; then
  echo ""
  echo "上記のエラー内容を確認してください。"
  echo ""
  read -n 1 -s -r -p "何かキーを押すとこのウィンドウを閉じます..."
  echo ""
fi

exit "$STATUS"
