// ==========================================
// 定数・コマンド定義
// ==========================================
const { GatewayIntentBits, Partials } = require('discord.js');

// ロール名
const ONI_ROLE_NAME = '鬼';
const RUNNER_ROLE_NAME = '逃走者';

// チャンネル/カテゴリ名（全箇所でこの定数を参照する）
const CHANNELS = {
  CATEGORY: '👹リアル鬼ごっこ',
  CONTROL: '📢全体連絡',
  PHOTO: '📸写真共有',
  ONI_TEXT: '👹鬼陣営-作戦室',
  ONI_VC: '🔊鬼陣営',
  RUN_TEXT: '🏃逃走者陣営-作戦室',
  RUN_VC: '🔊逃走者陣営',
};

// Embed カラー
const COLORS = {
  RECRUIT: 0x0099ff,
  WELCOME: 0x00ff00,
  PLAYING: 0xff0000,
  PANEL: 0x5865f2,
  MISSION: 0xffa500,
  PHOTO: 0xadd8e6,
  END: 0x808080,
};

// Discord Client のインテント設定
const INTENTS = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.MessageContent,
  GatewayIntentBits.GuildMembers,
];

const PARTIALS = [Partials.Message, Partials.Channel];

// スラッシュコマンド定義
const COMMANDS = [
  { name: 'ping', description: 'ボットの応答テスト' },
  { name: 'welcome', description: 'このボットの使い方・マニュアルを表示します。' },
  { name: 'game-recruit', description: 'リアル隠れ鬼ごっこの参加者募集パネルを表示します。' },
  { name: 'game-end', description: '現在のゲームや募集を強制終了します（ホスト/管理者用）' },
];

module.exports = {
  ONI_ROLE_NAME,
  RUNNER_ROLE_NAME,
  CHANNELS,
  COLORS,
  INTENTS,
  PARTIALS,
  COMMANDS,
};
