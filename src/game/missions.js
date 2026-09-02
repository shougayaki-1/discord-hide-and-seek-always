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

function formatTimeLabel() {
  return new Date().toLocaleTimeString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function startPhotoRemindTimer(guild, game) {
  if (game.photoRemind.timer) return;
  game.photoRemind.timer = setInterval(async () => {
    if (game.phase !== 'playing') return;
    if (!game.photoThreadId) return;
    const photoThread = await guild.channels.fetch(game.photoThreadId).catch(() => null);
    if (!photoThread) return;

    game.photoRemind.round += 1;
    const round = game.photoRemind.round;
    const timeLabel = formatTimeLabel();

    const runnerRole = guild.roles.cache.find((r) => r.name === RUNNER_ROLE_NAME);
    const embed = new EmbedBuilder()
      .setColor(COLORS.PHOTO)
      .setTitle(`📸 写真提出リマインド（第${round}回 ${timeLabel}）`)
      .setDescription('現在地のヒントとなる写真をこのスレッドに投稿してください！');
    await photoThread.send({
      content: runnerRole ? `<@&${runnerRole.id}>` : '@逃走者',
      embeds: [embed],
    });

    // 1分後、まだ写真を出していないチームだけに個別リマインド
    const t = setTimeout(async () => {
      game.photoRemind.unsubmittedTimers = game.photoRemind.unsubmittedTimers.filter((x) => x !== t);
      await remindUnsubmittedTeams(guild, game, photoThread, round, timeLabel);
    }, 60 * 1000);
    game.photoRemind.unsubmittedTimers.push(t);
  }, game.photoRemind.interval * 60 * 1000);
}

// 写真アルバムスレッドの投稿履歴（画像添付）を見て、まだ提出していないチームだけに呼びかける
// （誰か1人でも写真を出したチームは、以降ずっと対象から外れる）
async function remindUnsubmittedTeams(guild, game, photoThread, round, timeLabel) {
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

  const totalTeams = game.teams.runner;
  const unsubmittedTeams = totalTeams.filter(
    (team) => !team.discordIds.some((id) => submittedIds.has(id))
  );
  if (unsubmittedTeams.length === 0) return;

  const teamLines = unsubmittedTeams.map((team) => {
    const index = totalTeams.indexOf(team) + 1;
    const mentions = team.discordIds.map((id) => `<@${id}>`).join(' ');
    return `🏃 **逃走者 ${index}班**: ${mentions || '(メンバーなし)'}`;
  });
  const missingMemberCount = unsubmittedTeams.reduce((sum, t) => sum + t.discordIds.length, 0);

  const allMentions = unsubmittedTeams.flatMap((team) => team.discordIds.map((id) => `<@${id}>`)).join(' ');

  const embed = new EmbedBuilder()
    .setColor(COLORS.PHOTO)
    .setTitle(`📸 写真未提出リマインド（${timeLabel} 第${round}回分）`)
    .setDescription(
      `**${totalTeams.length}班中 ${unsubmittedTeams.length}班（${missingMemberCount}人）が未提出です**\n\n${teamLines.join(
        '\n'
      )}\n\nまだの人は今すぐ投稿してください！`
    );
  await photoThread.send({ content: allMentions, embeds: [embed] });
}

module.exports = { startMissionTimer, issueMission, startPhotoRemindTimer };
