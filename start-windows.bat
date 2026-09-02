@echo off
chcp 65001 >nul
setlocal

rem ==========================================
rem リアル隠れ鬼ごっこ Discord Bot - Windows用起動スクリプト
rem ダブルクリックで実行されます。
rem ==========================================

cd /d "%~dp0"

echo ========================================
echo   リアル隠れ鬼ごっこ Discord Bot
echo ========================================
echo.

rem --- Node.js の確認 ---
where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js が見つかりません。
    echo.
    echo Node.jsをインストールしてから再度実行してください。
    echo https://nodejs.org/
    echo.
    pause
    exit /b 1
)
echo [OK] Node.js

rem --- npm の確認 ---
where npm >nul 2>nul
if errorlevel 1 (
    echo [ERROR] npm が見つかりません。
    echo.
    echo Node.jsをインストールしてください（npmはNode.jsに同梱されています）。
    echo https://nodejs.org/
    echo.
    pause
    exit /b 1
)
echo [OK] npm

rem --- .env の確認 ---
if not exist ".env" (
    echo [ERROR] .env が見つかりません。
    echo.
    echo .env を作成し、以下を設定してください。
    echo.
    echo DISCORD_TOKEN=...
    echo DISCORD_CLIENT_ID=...
    echo.
    pause
    exit /b 1
)
echo [OK] .env

rem --- 依存関係の確認（node_modules が無い、または package-lock.json/package.json の方が新しければ再インストール） ---
set "LOCK_FILE=package-lock.json"
if not exist "%LOCK_FILE%" set "LOCK_FILE=package.json"

set "NEED_INSTALL=0"
if not exist "node_modules" goto :need_install_yes

set "DEPCHECK=OK"
for /f "usebackq delims=" %%R in (`powershell -NoProfile -Command "if ((Get-Item -LiteralPath '%LOCK_FILE%').LastWriteTime -gt (Get-Item -LiteralPath 'node_modules').LastWriteTime) { 'STALE' } else { 'OK' }" 2^>nul`) do set "DEPCHECK=%%R"
if "%DEPCHECK%"=="STALE" goto :need_install_yes
goto :need_install_done

:need_install_yes
set "NEED_INSTALL=1"

:need_install_done
if "%NEED_INSTALL%"=="1" (
    echo 依存関係をインストールしています ^(npm install^)...
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo [ERROR] npm install に失敗しました。
        echo.
        pause
        exit /b 1
    )
)
echo [OK] dependencies

echo.
echo Botを起動します...
echo.
echo ----------------------------------------
echo このウィンドウを閉じるか Ctrl+C で終了します。
echo ----------------------------------------
echo.

call npm start
set "STATUS=%ERRORLEVEL%"

if not "%STATUS%"=="0" (
    echo.
    echo [ERROR] Botが予期せず終了しました。 ^(exit code: %STATUS%^)
    echo.
    pause
)

exit /b %STATUS%
