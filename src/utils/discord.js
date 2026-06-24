// ==========================================
// Discord 共通ユーティリティ
// （状態はサーバーごとに異なるため game を引数で受け取る）
// ==========================================
const { CHANNELS, ONI_ROLE_NAME, RUNNER_ROLE_NAME } = require('../config');

// このサーバーのカテゴリ内のチャンネルを名前で検索
function findGameChannel(guild, game, name) {
  return guild.channels.cache.find(
    (c) => c.name === name && c.parentId === game.categoryChannelId
  );
}

// 全体連絡チャンネルを取得
function getControlChannel(guild, game) {
  return findGameChannel(guild, game, CHANNELS.CONTROL);
}

// 役職を取得、無ければ作成（役職はサーバーごとに独立）
async function getOrCreateRole(guild, roleName, color) {
  let role = guild.roles.cache.find((r) => r.name === roleName);
  if (!role) role = await guild.roles.create({ name: roleName, color, reason: '鬼ごっこ用' });
  return role;
}

// 参加者全員から鬼/逃走者ロールを剥がす
async function stripAllRoles(guild, game) {
  const oniRole = guild.roles.cache.find((r) => r.name === ONI_ROLE_NAME);
  const runnerRole = guild.roles.cache.find((r) => r.name === RUNNER_ROLE_NAME);
  for (const dId of game.participants.keys()) {
    const m = await guild.members.fetch(dId).catch(() => null);
    if (!m) continue;
    if (oniRole) await m.roles.remove(oniRole).catch(() => {});
    if (runnerRole) await m.roles.remove(runnerRole).catch(() => {});
  }
}

// 作成したチャンネルとカテゴリを削除
async function cleanupChannels(guild, game) {
  for (const chId of game.createdChannelIds) {
    const ch = guild.channels.cache.get(chId);
    if (ch) await ch.delete().catch(() => {});
  }
  if (game.categoryChannelId) {
    const cat = guild.channels.cache.get(game.categoryChannelId);
    if (cat) await cat.delete().catch(() => {});
  }
  game.createdChannelIds = [];
  game.categoryChannelId = null;
}

module.exports = {
  findGameChannel,
  getControlChannel,
  getOrCreateRole,
  stripAllRoles,
  cleanupChannels,
};
