// ==========================================
// チーム編成・チャンネル生成
// （game はサーバーごとの状態）
// ==========================================
const { PermissionsBitField, ChannelType } = require('discord.js');
const { CHANNELS, ONI_ROLE_NAME, RUNNER_ROLE_NAME } = require('../config');
const { getOrCreateRole, findGameChannel, findChannelByName } = require('../utils/discord');

// ペア固定を考慮してチームを抽選し、ロールを付与する
async function performTeamShuffle(guild, game) {
  const handled = new Set();
  const groups = [];

  // ペアで繋がった参加者を1グループにまとめる（連結成分）
  for (const [id] of game.participants.entries()) {
    if (handled.has(id)) continue;
    const queue = [id];
    const currentDiscordIds = [];
    const currentGuests = [];

    while (queue.length > 0) {
      const curr = queue.shift();
      if (handled.has(curr)) continue;
      handled.add(curr);

      const pData = game.participants.get(curr);
      if (!pData) continue;
      currentDiscordIds.push(curr);
      currentGuests.push(...pData.guests);

      for (const pairId of pData.pairedWith) {
        if (!handled.has(pairId)) queue.push(pairId);
      }
    }
    groups.push({ discordIds: currentDiscordIds, guests: currentGuests });
  }

  groups.sort(() => Math.random() - 0.5);

  const allTeams = [];
  let currentTeam = { discordIds: [], guests: [], displayMembers: [] };
  let currentSize = 0;
  const teamSizeLimit = game.settings.teamSize || 3;

  const flushTeam = () => {
    allTeams.push({
      id: `team-${Date.now()}-${allTeams.length}`,
      discordIds: [...currentTeam.discordIds],
      displayMembers: [...currentTeam.displayMembers],
    });
    currentTeam = { discordIds: [], guests: [], displayMembers: [] };
    currentSize = 0;
  };

  for (const g of groups) {
    const members = g.discordIds.map((id) => `<@${id}>`);
    g.guests.forEach((guest) => members.push(`(ゲスト)${guest}`));
    const gSize = g.discordIds.length + g.guests.length;

    currentTeam.discordIds.push(...g.discordIds);
    currentTeam.guests.push(...g.guests);
    currentTeam.displayMembers.push(...members);
    currentSize += gSize;

    if (currentSize >= teamSizeLimit) flushTeam();
  }
  if (currentSize > 0) flushTeam();

  const oniCount = game.settings.oniTeamCount;
  if (allTeams.length <= oniCount) {
    return {
      success: false,
      message: `作成された総チーム数(${allTeams.length}) に対して、鬼の指定数(${oniCount}) が多すぎます。人数設定や鬼の数を見直してください。`,
    };
  }

  game.teams.oni = allTeams.slice(0, oniCount);
  game.teams.runner = allTeams.slice(oniCount);

  const oniRole = await getOrCreateRole(guild, ONI_ROLE_NAME, 'Red');
  const runnerRole = await getOrCreateRole(guild, RUNNER_ROLE_NAME, 'Blue');

  // メンションではなく、サーバープロフィールの表示名（ニックネーム優先）を
  // セレクトメニュー等の選択肢表示用に組み立てる（メンション記法はコンポーネント上では解決されないため）
  const buildNameMembers = async (team) => {
    const guestNames = team.displayMembers.filter((m) => m.startsWith('(ゲスト)'));
    const names = [];
    for (const id of team.discordIds) {
      const m = await guild.members.fetch(id).catch(() => null);
      names.push(m ? m.displayName : '不明なユーザー');
    }
    return [...names, ...guestNames];
  };

  for (const team of game.teams.oni) {
    for (const dId of team.discordIds) {
      const m = await guild.members.fetch(dId).catch(() => null);
      if (m) await m.roles.add(oniRole).catch(() => {});
    }
    team.nameMembers = await buildNameMembers(team);
  }
  for (const team of game.teams.runner) {
    for (const dId of team.discordIds) {
      const m = await guild.members.fetch(dId).catch(() => null);
      if (m) await m.roles.add(runnerRole).catch(() => {});
    }
    team.nameMembers = await buildNameMembers(team);
  }

  // ディープコピーで初期編成を保存（nameMembers も含める。Map/Set を含まないので JSON で安全）
  game.initialTeams = JSON.parse(
    JSON.stringify({ oni: game.teams.oni, runner: game.teams.runner })
  );

  return { success: true, roles: { oniRole, runnerRole } };
}

// 各チャンネルの権限オーバーライトを構築
function buildOverwrites(guild, allowedRoleIds) {
  const overwrites = [
    { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
    { id: guild.client.user.id, allow: [PermissionsBitField.Flags.ViewChannel] },
  ];
  for (const roleId of allowedRoleIds) {
    overwrites.push({ id: roleId, allow: [PermissionsBitField.Flags.ViewChannel] });
  }
  return overwrites;
}

// チーム分け＋専用チャンネル一式を用意する
async function setupTeamsAndChannels(guild, game) {
  const shuffleResult = await performTeamShuffle(guild, game);
  if (!shuffleResult.success) return shuffleResult;

  const { oniRole, runnerRole } = shuffleResult.roles;
  game.phase = 'ready';

  let category = guild.channels.cache.get(game.categoryChannelId);
  if (!category) {
    category = await guild.channels.create({
      name: CHANNELS.CATEGORY,
      type: ChannelType.GuildCategory,
    });
    game.categoryChannelId = category.id;
  }

  // 全体連絡（全員閲覧可）
  let controlCh = findGameChannel(guild, game, CHANNELS.CONTROL);
  if (!controlCh) {
    controlCh = await guild.channels.create({
      name: CHANNELS.CONTROL,
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
        },
      ],
    });
  }

  // 写真アルバム（フォーラム / 鬼・逃走者のみ閲覧可）
  // カテゴリの外に独立して作成し、片付け（クリーンアップ）の対象外にすることで
  // 試合ごとのスレッドが写真の記録として永続的に残るようにする
  let photoForum = findChannelByName(guild, CHANNELS.PHOTO);
  if (!photoForum) {
    photoForum = await guild.channels.create({
      name: CHANNELS.PHOTO,
      type: ChannelType.GuildForum,
      permissionOverwrites: buildOverwrites(guild, [oniRole.id, runnerRole.id]),
    });
  } else {
    await photoForum.permissionOverwrites
      .set(buildOverwrites(guild, [oniRole.id, runnerRole.id]))
      .catch(() => {});
  }

  const matchLabel = new Date().toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  const photoThread = await photoForum.threads.create({
    name: `📸 ${matchLabel} の試合`,
    message: { content: '今回の試合の写真・ミッション達成報告はこのスレッドに投稿してください！' },
  });
  game.photoThreadId = photoThread.id;

  // 鬼陣営チャンネル
  let oniText = findGameChannel(guild, game, CHANNELS.ONI_TEXT);
  let oniVC = findGameChannel(guild, game, CHANNELS.ONI_VC);
  if (!oniText) {
    oniText = await guild.channels.create({
      name: CHANNELS.ONI_TEXT,
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites: buildOverwrites(guild, [oniRole.id]),
    });
  }
  if (!oniVC) {
    oniVC = await guild.channels.create({
      name: CHANNELS.ONI_VC,
      type: ChannelType.GuildVoice,
      parent: category.id,
      permissionOverwrites: buildOverwrites(guild, [oniRole.id]),
    });
  }

  // 逃走者陣営チャンネル
  let runText = findGameChannel(guild, game, CHANNELS.RUN_TEXT);
  let runVC = findGameChannel(guild, game, CHANNELS.RUN_VC);
  if (!runText) {
    runText = await guild.channels.create({
      name: CHANNELS.RUN_TEXT,
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites: buildOverwrites(guild, [runnerRole.id]),
    });
  }
  if (!runVC) {
    runVC = await guild.channels.create({
      name: CHANNELS.RUN_VC,
      type: ChannelType.GuildVoice,
      parent: category.id,
      permissionOverwrites: buildOverwrites(guild, [runnerRole.id]),
    });
  }

  game.createdChannelIds = [oniText.id, oniVC.id, runText.id, runVC.id];

  await announceTeams(controlCh, game);
  await controlCh.send(
    `📸 今回の試合の写真アルバムスレッドはこちら → <#${photoThread.id}>`
  );
  await oniText.send(`<@&${oniRole.id}> チーム分けが完了しました！作戦会議を始めてください。`);
  await runText.send(`<@&${runnerRole.id}> チーム分けが完了しました！作戦会議を始めてください。`);

  return { success: true };
}

// チーム編成をメンション付きで全体連絡へ投稿
async function announceTeams(channel, game) {
  const lines = ['📋 **チーム編成が決まりました！**\n'];
  const formatGuests = (team) =>
    team.displayMembers.filter((m) => m.startsWith('(ゲスト)')).join(', ');

  game.teams.oni.forEach((team, i) => {
    const mentions = team.discordIds.map((id) => `<@${id}>`).join(' ');
    const guests = formatGuests(team);
    lines.push(`👹 **鬼 ${i + 1}班**: ${mentions}${guests ? ` / ゲスト: ${guests}` : ''}`);
  });

  game.teams.runner.forEach((team, i) => {
    const mentions = team.discordIds.map((id) => `<@${id}>`).join(' ');
    const guests = formatGuests(team);
    lines.push(`🏃 **逃走者 ${i + 1}班**: ${mentions}${guests ? ` / ゲスト: ${guests}` : ''}`);
  });

  await channel.send(lines.join('\n'));
}

module.exports = { performTeamShuffle, setupTeamsAndChannels, announceTeams };
