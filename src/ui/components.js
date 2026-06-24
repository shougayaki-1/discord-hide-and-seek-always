// ==========================================
// ボタン/コンポーネント生成
// ==========================================
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { state } = require('../state');
const { COLORS } = require('../config');

// 募集パネルのボタン
function generateRecruitButtons() {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('btn_join_leave').setLabel('👍 参加/取消').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('btn_add_guest').setLabel('👤 ゲスト追加').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('btn_pair').setLabel('🤝 ペアを組む').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('btn_host_menu').setLabel('👑 ホストメニュー').setStyle(ButtonStyle.Danger)
  );
  return [row1];
}

// ホスト専用メニューのボタン
function generateHostMenuButtons() {
  const enabled = state.game.mission.enabled;
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('btn_setup_basic').setLabel('⚙️ 時間/人数設定').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('btn_setup_mission').setLabel('⚙️ 通知/間隔設定').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('btn_toggle_mission')
      .setLabel(`🔄 ミッション: ${enabled ? 'ON' : 'OFF'}`)
      .setStyle(enabled ? ButtonStyle.Success : ButtonStyle.Danger)
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('btn_close_recruit').setLabel('✅ 募集終了＆チーム分け').setStyle(ButtonStyle.Success)
  );
  return [row1, row2];
}

// 準備中コントロールパネルを送信し、メッセージIDを保存
async function sendControlPanel(channel) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.PANEL)
    .setTitle('🎮 ゲームコントロールパネル (準備中)')
    .setDescription('チームが気に入らない場合は再抽選できます。\n準備ができたら開始を押してください。');
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('start_game_button').setLabel('▶️ ゲーム開始').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('btn_reshuffle').setLabel('🔀 チーム再抽選').setStyle(ButtonStyle.Secondary)
  );
  const sentMessage = await channel.send({ embeds: [embed], components: [row1] });
  state.game.controlPanelMessageId = sentMessage.id;
}

// ゲーム進行中パネル（embed + ボタン行）
function buildPlayingPanel() {
  const embed = new EmbedBuilder()
    .setColor(COLORS.PLAYING)
    .setTitle('🎮 ゲーム進行中パネル')
    .setDescription('捕獲報告やポイント操作、ミッション追加ができます。');
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('btn_catch').setLabel('🤚 捕獲報告').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('btn_give_point').setLabel('🪙 ポイント操作(ホスト用)').setStyle(ButtonStyle.Success)
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('btn_add_mission').setLabel('📝 ミッション追加(ホスト用)').setStyle(ButtonStyle.Secondary)
  );
  return { embeds: [embed], components: [row1, row2] };
}

module.exports = {
  generateRecruitButtons,
  generateHostMenuButtons,
  sendControlPanel,
  buildPlayingPanel,
};
