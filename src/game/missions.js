// ==========================================
// ミッション・写真リマインドのタイマー
// （game はサーバーごとの状態。タイマー中もこの参照を保持する）
// ==========================================
const { EmbedBuilder } = require('discord.js');
const { RUNNER_ROLE_NAME, COLORS } = require('../config');
const { getControlChannel } = require('../utils/discord');

// ミッションタイマー開始（既に稼働中なら何もしない＝多重起動防止）
function startMissionTimer(guild, game) {
  if (game.mission.timer) return;
  scheduleNextMission(guild, game);
}

function scheduleNextMission(guild, game) {
  const m = game.mission;
  const intervalMs =
    (Math.floor(Math.random() * (m.intervalMax - m.intervalMin + 1)) + m.intervalMin) * 60 * 1000;

  m.timer = setTimeout(async () => {
    m.timer = null;
    if (game.phase !== 'playing') return;
    // 発令タイミングで enabled を判定（途中ON/OFFに追従）
    if (m.enabled) await issueMission(guild, game);
    scheduleNextMission(guild, game);
  }, intervalMs);
}

async function issueMission(guild, game) {
  const m = game.mission;
  let missionContent;
  if (m.customMissions.length > 0) {
    missionContent = m.customMissions.shift();
  } else {
    missionContent = m.defaultMissions[Math.floor(Math.random() * m.defaultMissions.length)];
  }

  const controlCh = getControlChannel(guild, game);
  if (!controlCh) return;
  const runnerRole = guild.roles.cache.find((r) => r.name === RUNNER_ROLE_NAME);
  const albumHint = game.photoThreadId
    ? `達成できたら <#${game.photoThreadId}> に投稿しよう！`
    : '達成できたら写真アルバムスレッドに投稿しよう！';
  const embed = new EmbedBuilder()
    .setColor(COLORS.MISSION)
    .setTitle('🚨 緊急ミッション発令！ 🚨')
    .setDescription(missionContent)
    .setFooter({ text: albumHint });
  await controlCh.send({ content: runnerRole ? `<@&${runnerRole.id}>` : '@逃走者', embeds: [embed] });
}

function startPhotoRemindTimer(guild, game) {
  if (game.photoRemind.timer) return;
  game.photoRemind.timer = setInterval(async () => {
    if (game.phase !== 'playing') return;
    if (!game.photoThreadId) return;
    const photoThread = await guild.channels.fetch(game.photoThreadId).catch(() => null);
    if (!photoThread) return;
    const runnerRole = guild.roles.cache.find((r) => r.name === RUNNER_ROLE_NAME);
    const embed = new EmbedBuilder()
      .setColor(COLORS.PHOTO)
      .setTitle('📸 写真提出リマインド')
      .setDescription('現在地のヒントとなる写真をこのスレッドに投稿してください！');
    await photoThread.send({
      content: runnerRole ? `<@&${runnerRole.id}>` : '@逃走者',
      embeds: [embed],
    });

    // 1分後、まだ写真を出していないチームだけに個別リマインド
    const t = setTimeout(async () => {
      game.photoRemind.unsubmittedTimers = game.photoRemind.unsubmittedTimers.filter((x) => x !== t);
      await remindUnsubmittedTeams(guild, game, photoThread);
    }, 60 * 1000);
    game.photoRemind.unsubmittedTimers.push(t);
  }, game.photoRemind.interval * 60 * 1000);
}

// 写真アルバムスレッドの投稿履歴（画像添付）を見て、まだ提出していないチームだけに呼びかける
async function remindUnsubmittedTeams(guild, game, photoThread) {
  if (game.phase !== 'playing') return;

  const submittedIds = new Set();
  let before;
  // スレッド作成〜現在までの全メッセージを遡って、画像を投稿した人を集計
  for (let i = 0; i < 10; i++) {
    const batch = await photoThread.messages.fetch({ limit: 100, before }).catch(() => null);
    if (!batch || batch.size === 0) break;
    batch.forEach((msg) => {
      if (msg.attachments.size > 0) submittedIds.add(msg.author.id);
    });
    if (batch.size < 100) break;
    before = batch.last().id;
  }

  const unsubmittedTeams = game.teams.runner.filter(
    (team) => !team.discordIds.some((id) => submittedIds.has(id))
  );
  if (unsubmittedTeams.length === 0) return;

  const mentions = unsubmittedTeams
    .flatMap((team) => team.discordIds.map((id) => `<@${id}>`))
    .join(' ');
  if (!mentions) return;

  const embed = new EmbedBuilder()
    .setColor(COLORS.PHOTO)
    .setTitle('📸 写真未提出リマインド')
    .setDescription('まだ写真が届いていません！まだの人は今すぐ投稿してください！');
  await photoThread.send({ content: mentions, embeds: [embed] });
}

module.exports = { startMissionTimer, issueMission, startPhotoRemindTimer };
