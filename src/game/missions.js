// ==========================================
// ミッション・写真リマインドのタイマー
// ==========================================
const { EmbedBuilder } = require('discord.js');
const { state } = require('../state');
const { RUNNER_ROLE_NAME, COLORS } = require('../config');
const { getControlChannel } = require('../utils/discord');

// ミッションタイマー開始（既に稼働中なら何もしない＝多重起動防止）
function startMissionTimer(guild) {
  if (state.game.mission.timer) return;
  scheduleNextMission(guild);
}

function scheduleNextMission(guild) {
  const m = state.game.mission;
  const intervalMs =
    (Math.floor(Math.random() * (m.intervalMax - m.intervalMin + 1)) + m.intervalMin) * 60 * 1000;

  m.timer = setTimeout(async () => {
    m.timer = null;
    if (state.game.phase !== 'playing') return;
    // 発令タイミングで enabled を判定（途中ON/OFFに追従）
    if (m.enabled) await issueMission(guild);
    scheduleNextMission(guild);
  }, intervalMs);
}

async function issueMission(guild) {
  const m = state.game.mission;
  let missionContent;
  if (m.customMissions.length > 0) {
    missionContent = m.customMissions.shift();
  } else {
    missionContent = m.defaultMissions[Math.floor(Math.random() * m.defaultMissions.length)];
  }

  const controlCh = getControlChannel(guild);
  if (!controlCh) return;
  const runnerRole = guild.roles.cache.find((r) => r.name === RUNNER_ROLE_NAME);
  const embed = new EmbedBuilder()
    .setColor(COLORS.MISSION)
    .setTitle('🚨 緊急ミッション発令！ 🚨')
    .setDescription(missionContent)
    .setFooter({ text: '達成できたら写真共有チャンネルに投稿しよう！' });
  await controlCh.send({ content: runnerRole ? `<@&${runnerRole.id}>` : '@逃走者', embeds: [embed] });
}

function startPhotoRemindTimer(guild) {
  if (state.game.photoRemind.timer) return;
  state.game.photoRemind.timer = setInterval(async () => {
    if (state.game.phase !== 'playing') return;
    const controlCh = getControlChannel(guild);
    if (!controlCh) return;
    const runnerRole = guild.roles.cache.find((r) => r.name === RUNNER_ROLE_NAME);
    const embed = new EmbedBuilder()
      .setColor(COLORS.PHOTO)
      .setTitle('📸 写真提出リマインド')
      .setDescription('現在地のヒントとなる写真を「📸写真共有」チャンネルに投稿してください！');
    await controlCh.send({
      content: runnerRole ? `<@&${runnerRole.id}>` : '@逃走者',
      embeds: [embed],
    });
  }, state.game.photoRemind.interval * 60 * 1000);
}

module.exports = { startMissionTimer, issueMission, startPhotoRemindTimer };
