// ==========================================
// ボタン処理
// ==========================================
const {
  PermissionsBitField,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
} = require('discord.js');
const { getGame, setGame, getInitialGameStatus } = require('../state');
const { ONI_ROLE_NAME, RUNNER_ROLE_NAME } = require('../config');
const { generateRecruitEmbed } = require('../ui/embeds');
const {
  generateRecruitButtons,
  generateHostMenuButtons,
  sendControlPanel,
  buildPlayingPanel,
} = require('../ui/components');
const { setupTeamsAndChannels, performTeamShuffle, announceTeams } = require('../game/teams');
const {
  getControlChannel,
  getOrCreateRole,
  stripAllRoles,
  cleanupChannels,
} = require('../utils/discord');
const { startMissionTimer, startPhotoRemindTimer } = require('../game/missions');
const { endGame, clearAllTimers } = require('../game/lifecycle');

const isHost = (interaction, game) => interaction.user.id === game.hostId;
const hostOnly = (interaction) =>
  interaction.reply({ content: 'ホスト専用です。', ephemeral: true });

async function handleButton(interaction) {
  if (!interaction.guild) {
    return interaction.reply({ content: 'このボタンはサーバー内でのみ使用できます。', ephemeral: true });
  }
  const { customId } = interaction;
  const guildId = interaction.guild.id;
  const game = getGame(guildId);

  // ▼ 参加/取消
  if (customId === 'btn_join_leave') {
    if (game.phase !== 'recruiting') {
      return interaction.reply({ content: '現在は募集フェーズではありません。', ephemeral: true });
    }
    if (game.participants.has(interaction.user.id)) {
      game.participants.delete(interaction.user.id);
    } else {
      game.participants.set(interaction.user.id, {
        discordId: interaction.user.id,
        guests: [],
        pairedWith: new Set(),
      });
    }
    return interaction.update({
      embeds: [generateRecruitEmbed(game)],
      components: generateRecruitButtons(),
    });
  }

  // ▼ ゲスト追加
  if (customId === 'btn_add_guest') {
    if (!game.participants.has(interaction.user.id)) {
      return interaction.reply({ content: '先に「参加」してください！', ephemeral: true });
    }
    const modal = new ModalBuilder().setCustomId('modal_guest').setTitle('ゲストの追加');
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('guest_name')
          .setLabel('追加するゲスト名（カンマ区切り）')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      )
    );
    return interaction.showModal(modal);
  }

  // ▼ ペアを組む
  if (customId === 'btn_pair') {
    if (!game.participants.has(interaction.user.id)) {
      return interaction.reply({ content: '先に「参加」してください！', ephemeral: true });
    }
    const others = [...game.participants.keys()].filter((id) => id !== interaction.user.id);
    if (others.length === 0) {
      return interaction.reply({ content: 'ペアを組む相手がまだ参加していません。', ephemeral: true });
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('select_pair')
      .setPlaceholder('絶対に同じチームになりたい相手を選択');

    for (const dId of others) {
      let member = interaction.guild.members.cache.get(dId);
      if (!member) member = await interaction.guild.members.fetch(dId).catch(() => null);
      selectMenu.addOptions({
        label: member ? member.displayName : `ユーザー(${dId})`,
        value: dId,
      });
    }
    return interaction.reply({
      content: 'ペア相手を選んでください。\n※選んだ相手とは必ず同じチームになります。',
      components: [new ActionRowBuilder().addComponents(selectMenu)],
      ephemeral: true,
    });
  }

  // ▼ ホスト専用メニューの展開
  if (customId === 'btn_host_menu') {
    if (!isHost(interaction, game)) {
      return interaction.reply({
        content: 'このメニューはホスト（募集開始者）専用です！',
        ephemeral: true,
      });
    }
    return interaction.reply({
      content: '👑 **ホスト専用設定メニュー**\nここでゲームの設定や募集の締め切りを行えます。',
      components: generateHostMenuButtons(game),
      ephemeral: true,
    });
  }

  // ▼ 基本設定モーダル
  if (customId === 'btn_setup_basic') {
    if (!isHost(interaction, game)) return hostOnly(interaction);
    const modal = new ModalBuilder().setCustomId('modal_setup_basic').setTitle('基本設定（時間・人数）');
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('input_time')
          .setLabel('制限時間（分）')
          .setStyle(TextInputStyle.Short)
          .setValue(String(game.settings.timeLimit))
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('input_oni')
          .setLabel('鬼チームの数')
          .setStyle(TextInputStyle.Short)
          .setValue(String(game.settings.oniTeamCount))
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('input_teamsize')
          .setLabel('1チームの人数目安')
          .setStyle(TextInputStyle.Short)
          .setValue(String(game.settings.teamSize))
          .setRequired(true)
      )
    );
    return interaction.showModal(modal);
  }

  // ▼ 通知/ミッション設定モーダル
  if (customId === 'btn_setup_mission') {
    if (!isHost(interaction, game)) return hostOnly(interaction);
    const modal = new ModalBuilder().setCustomId('modal_setup_mission').setTitle('通知・ミッション設定');
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('input_photo')
          .setLabel('写真通知の間隔（分）')
          .setStyle(TextInputStyle.Short)
          .setValue(String(game.photoRemind.interval))
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('input_min')
          .setLabel('ミッション発令 最小間隔（分）')
          .setStyle(TextInputStyle.Short)
          .setValue(String(game.mission.intervalMin))
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('input_max')
          .setLabel('ミッション発令 最大間隔（分）')
          .setStyle(TextInputStyle.Short)
          .setValue(String(game.mission.intervalMax))
          .setRequired(true)
      )
    );
    return interaction.showModal(modal);
  }

  // ▼ ミッション ON/OFF 切替
  if (customId === 'btn_toggle_mission') {
    if (!isHost(interaction, game)) return hostOnly(interaction);
    game.mission.enabled = !game.mission.enabled;
    await interaction.update({ components: generateHostMenuButtons(game) });
    // ゲーム中に ON にした場合はタイマーチェーンを起動（多重起動は内部で防止）
    if (game.mission.enabled && game.phase === 'playing') {
      startMissionTimer(interaction.guild, game);
    }
    if (game.recruitmentMessageId) {
      const msg = await interaction.channel.messages
        .fetch(game.recruitmentMessageId)
        .catch(() => null);
      if (msg) await msg.edit({ embeds: [generateRecruitEmbed(game)] });
    }
    return;
  }

  // ▼ 募集終了＆チーム分け
  if (customId === 'btn_close_recruit') {
    if (!isHost(interaction, game)) return hostOnly(interaction);
    if (game.participants.size < 2) {
      return interaction.reply({ content: '参加者が少なすぎます（最低2人必要）。', ephemeral: true });
    }

    await interaction.update({ content: 'チーム分け・チャンネル設定中...', components: [] });
    const result = await setupTeamsAndChannels(interaction.guild, game);
    if (!result.success) {
      return interaction.editReply({ content: `⚠️ エラー: ${result.message}` });
    }

    await interaction.editReply({ content: '✅ 準備完了！各チャンネルで作戦会議をしてください。' });
    const controlCh = getControlChannel(interaction.guild, game);
    if (controlCh) await sendControlPanel(controlCh, game);
    return;
  }

  // ▼ チーム再抽選
  if (customId === 'btn_reshuffle') {
    if (!isHost(interaction, game)) return hostOnly(interaction);
    if (game.phase !== 'ready') {
      return interaction.reply({ content: '準備完了フェーズでのみ可能です。', ephemeral: true });
    }
    await interaction.deferReply();
    await stripAllRoles(interaction.guild, game);
    const result = await performTeamShuffle(interaction.guild, game);
    if (!result.success) return interaction.editReply(`⚠️ エラー: ${result.message}`);

    const controlCh = getControlChannel(interaction.guild, game);
    if (controlCh) await announceTeams(controlCh, game);

    return interaction.editReply(
      '🔀 **チームを再抽選しました！** 各陣営チャンネルのメンションを確認してください。'
    );
  }

  // ▼ ゲーム開始
  if (customId === 'start_game_button') {
    if (!isHost(interaction, game)) return hostOnly(interaction);
    if (game.phase !== 'ready') {
      return interaction.reply({ content: '準備完了していません。', ephemeral: true });
    }

    game.phase = 'playing';
    await interaction.reply(
      `▶️ **ゲームスタート！** 制限時間は **${game.settings.timeLimit}分** です！`
    );

    const panelMsg = await interaction.channel.messages
      .fetch(game.controlPanelMessageId)
      .catch(() => null);
    if (panelMsg) await panelMsg.edit(buildPlayingPanel());

    // 多重起動防止のため既存タイマーを破棄してから張り直す
    clearAllTimers(game);
    game.gameTimer = setTimeout(() => {
      endGame(interaction.guild, interaction.channel, '⏰ 時間切れ！ゲーム終了です！', game);
    }, game.settings.timeLimit * 60 * 1000);

    startMissionTimer(interaction.guild, game);
    startPhotoRemindTimer(interaction.guild, game);
    return;
  }

  // ▼ 捕獲報告
  if (customId === 'btn_catch') {
    if (game.phase !== 'playing') {
      return interaction.reply({ content: 'ゲーム中のみ有効です。', ephemeral: true });
    }
    const isOni = game.teams.oni.some((t) => t.discordIds.includes(interaction.user.id));
    if (!isOni && !isHost(interaction, game)) {
      return interaction.reply({ content: '鬼陣営のみ報告できます。', ephemeral: true });
    }
    if (game.teams.runner.length === 0) {
      return interaction.reply({ content: '逃走者がいません。', ephemeral: true });
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('catch_select_menu')
      .setPlaceholder('捕獲したチームを選択');
    game.teams.runner.forEach((team, index) => {
      selectMenu.addOptions({
        label: `逃走者 ${index + 1}班`,
        description: `メンバー: ${(team.nameMembers || team.displayMembers).join(', ').substring(0, 50)}`,
        value: team.id,
      });
    });
    return interaction.reply({
      content: 'どのチームを捕まえましたか？',
      components: [new ActionRowBuilder().addComponents(selectMenu)],
      ephemeral: true,
    });
  }

  // ▼ ポイント操作
  if (customId === 'btn_give_point') {
    if (!isHost(interaction, game)) return hostOnly(interaction);
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('select_point_team')
      .setPlaceholder('ポイントを与えるチームを選択');
    game.teams.oni.forEach((t, i) =>
      selectMenu.addOptions({
        label: `👹鬼 ${i + 1}班`,
        description: `メンバー: ${(t.nameMembers || t.displayMembers).join(', ').substring(0, 50)}`,
        value: t.id,
      })
    );
    game.teams.runner.forEach((t, i) =>
      selectMenu.addOptions({
        label: `🏃逃走者 ${i + 1}班`,
        description: `メンバー: ${(t.nameMembers || t.displayMembers).join(', ').substring(0, 50)}`,
        value: t.id,
      })
    );
    return interaction.reply({
      content: 'どのチームにポイントを与えますか？',
      components: [new ActionRowBuilder().addComponents(selectMenu)],
      ephemeral: true,
    });
  }

  // ▼ ミッション手動追加
  if (customId === 'btn_add_mission') {
    if (!isHost(interaction, game)) return hostOnly(interaction);
    const modal = new ModalBuilder().setCustomId('modal_add_mission').setTitle('ミッション手動追加');
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('mission_content')
          .setLabel('ミッション内容')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
      )
    );
    return interaction.showModal(modal);
  }

  // ▼ コンティニュー・終了操作
  if (['btn_cont_same', 'btn_cont_shuffle', 'btn_end_keep', 'btn_end_cleanup'].includes(customId)) {
    const isAdmin = interaction.member?.permissions?.has(PermissionsBitField.Flags.Administrator);
    if (!isHost(interaction, game) && !isAdmin) {
      return interaction.reply({ content: 'ホストまたは管理者専用です。', ephemeral: true });
    }
    return handleContinue(interaction, customId, game, guildId);
  }
}

// コンティニュー・終了の各分岐
async function handleContinue(interaction, customId, game, guildId) {
  if (customId === 'btn_cont_same') {
    await interaction.deferReply();
    game.teams = {
      oni: game.initialTeams.oni.map((t) => ({ ...t })),
      runner: game.initialTeams.runner.map((t) => ({ ...t })),
    };
    await stripAllRoles(interaction.guild, game);

    const oniRole = await getOrCreateRole(interaction.guild, ONI_ROLE_NAME, 'Red');
    const runnerRole = await getOrCreateRole(interaction.guild, RUNNER_ROLE_NAME, 'Blue');
    for (const t of game.teams.oni) {
      for (const id of t.discordIds) {
        const m = await interaction.guild.members.fetch(id).catch(() => null);
        if (m) await m.roles.add(oniRole).catch(() => {});
      }
    }
    for (const t of game.teams.runner) {
      for (const id of t.discordIds) {
        const m = await interaction.guild.members.fetch(id).catch(() => null);
        if (m) await m.roles.add(runnerRole).catch(() => {});
      }
    }

    game.phase = 'ready';
    await interaction.editReply(
      '🔄 **同じチームでコンティニューします！** 各陣営のチャンネルで作戦会議をしてください。'
    );
    const controlCh = getControlChannel(interaction.guild, game);
    if (controlCh) {
      await announceTeams(controlCh, game);
      await sendControlPanel(controlCh, game);
    }
    return;
  }

  if (customId === 'btn_cont_shuffle') {
    await interaction.deferReply();
    await stripAllRoles(interaction.guild, game);
    const oldPoints = game.points;
    const newGame = setGame(guildId, getInitialGameStatus(true, game));
    newGame.points = oldPoints; // ポイントを引き継ぐ場合はこの行を残す
    newGame.phase = 'recruiting';
    newGame.hostId = interaction.user.id;
    newGame.participants.set(interaction.user.id, {
      discordId: interaction.user.id,
      guests: [],
      pairedWith: new Set(),
    });
    const msg = await interaction.channel.send({
      embeds: [generateRecruitEmbed(newGame)],
      components: generateRecruitButtons(),
    });
    newGame.recruitmentMessageId = msg.id;
    newGame.gameChannelId = interaction.channelId;
    return interaction.editReply('🔀 **チームとポイントをリセットしました！再度募集を行います。**');
  }

  if (customId === 'btn_end_keep') {
    await interaction.deferReply();
    await stripAllRoles(interaction.guild, game);
    setGame(guildId, getInitialGameStatus(true, game));
    return interaction.editReply(
      '♻️ **ゲームを終了しました。チャンネルは次回のために残しておきます。**'
    );
  }

  if (customId === 'btn_end_cleanup') {
    await interaction.deferReply();
    await stripAllRoles(interaction.guild, game);
    await cleanupChannels(interaction.guild, game);
    setGame(guildId, getInitialGameStatus(false));
    return interaction.editReply('🗑️ **クリーンアップ完了！お疲れ様でした。**');
  }
}

module.exports = { handleButton };
