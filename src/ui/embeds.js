// ==========================================
// Embed 生成
// ==========================================
const { EmbedBuilder } = require('discord.js');
const { COLORS } = require('../config');

// 募集パネルの Embed（game はサーバーごとの状態）
function generateRecruitEmbed(game) {
  let pList = '';
  let totalCount = 0;
  if (game.participants.size === 0) {
    pList = 'まだいません';
  } else {
    game.participants.forEach((d) => {
      pList += `・<@${d.discordId}>`;
      if (d.guests.length > 0) pList += ` (ゲスト: ${d.guests.join(', ')})`;
      if (d.pairedWith.size > 0) pList += ' 🤝ペア固定';
      pList += '\n';
      totalCount += 1 + d.guests.length;
    });
  }

  let settingText = `⏰ 制限時間: **${game.settings.timeLimit}分**\n`;
  settingText += `👹 鬼チーム数: **${game.settings.oniTeamCount}班**\n`;
  settingText += `👥 1チーム人数: **約${game.settings.teamSize}人**\n`;
  settingText += `📸 写真通知: **${game.photoRemind.interval}分ごと**\n`;
  settingText += `🚨 ミッション: **${
    game.mission.enabled ? `ON (${game.mission.intervalMin}〜${game.mission.intervalMax}分)` : 'OFF'
  }**`;

  return new EmbedBuilder()
    .setColor(COLORS.RECRUIT)
    .setTitle('🏃 リアル隠れ鬼ごっこ 参加者募集 👹')
    .setDescription('下のボタンから参加、ゲスト追加、ペア設定を行ってください！')
    .addFields(
      { name: `現在の参加者（計 ${totalCount} 人）`, value: pList },
      { name: '⚙️ 現在のゲーム設定', value: settingText }
    );
}

// /welcome の説明 Embed
function buildWelcomeEmbed() {
  return new EmbedBuilder()
    .setColor(COLORS.WELCOME)
    .setTitle('👹 リアル隠れ鬼ごっこ Bot 取扱説明書')
    .setDescription('このBotは、現実世界での鬼ごっこをDiscordで楽しく管理するためのツールです。')
    .addFields(
      {
        name: 'Step 1: 募集を開始する',
        value: 'ホストが `/game-recruit` を実行します。表示されたパネルで参加者を集めます。',
      },
      {
        name: 'Step 2: 参加・設定',
        value:
          '参加者は「👍参加」を押し、必要なら「👤ゲスト」「🤝ペア」を設定します。\nホストは「👑ホストメニュー」から制限時間や人数を設定し、「✅募集終了」を押します。',
      },
      {
        name: 'Step 3: 準備と開始',
        value:
          '自動作成された専用チャンネルで班ごとに作戦会議をします。\n準備ができたら、ホストが全体連絡チャンネルのパネルから「▶️ゲーム開始」を押します。',
      },
      {
        name: 'Step 4: ゲーム中',
        value:
          '鬼は逃走者を捕まえたら「🤚捕獲報告」をします（チームごと鬼に移動します）。\n定期的にミッションが届くので、クリアしてポイントを稼ぎましょう！',
      },
      {
        name: 'Step 5: ゲーム終了',
        value:
          '時間切れ、または逃走者全滅で終了し、ランキングが発表されます。\n最後にコンティニュー（再戦）か終了を選んで完了です。',
      }
    )
    .setFooter({ text: '困ったときはサーバー管理者に相談してください。' });
}

module.exports = { generateRecruitEmbed, buildWelcomeEmbed };
