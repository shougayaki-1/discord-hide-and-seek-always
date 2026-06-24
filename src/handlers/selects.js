// ==========================================
// 選択メニュー処理
// ==========================================
const {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const { getGame } = require('../state');
const { ONI_ROLE_NAME, RUNNER_ROLE_NAME } = require('../config');
const { generateRecruitEmbed } = require('../ui/embeds');
const { getControlChannel } = require('../utils/discord');
const { endGame } = require('../game/lifecycle');

async function handleSelectMenu(interaction) {
  if (!interaction.guild) {
    return interaction.reply({ content: 'このメニューはサーバー内でのみ使用できます。', ephemeral: true });
  }
  const game = getGame(interaction.guild.id);

  // ▼ ペア相手の選択
  if (interaction.customId === 'select_pair') {
    const targetId = interaction.values[0];
    const myData = game.participants.get(interaction.user.id);
    const targetData = game.participants.get(targetId);

    if (!myData || !targetData) {
      return interaction.update({ content: '⚠️ 参加者情報が見つかりません。', components: [] });
    }

    myData.pairedWith.add(targetId);
    targetData.pairedWith.add(interaction.user.id);

    let member = interaction.guild.members.cache.get(targetId);
    if (!member) member = await interaction.guild.members.fetch(targetId).catch(() => null);

    await interaction.update({
      content: `✅ **${
        member ? member.displayName : '相手'
      }** さんとペアを組みました！必ず同じチームになります。`,
      components: [],
    });

    if (game.recruitmentMessageId) {
      const msg = await interaction.channel.messages
        .fetch(game.recruitmentMessageId)
        .catch(() => null);
      if (msg) await msg.edit({ embeds: [generateRecruitEmbed(game)] });
    }
    return;
  }

  // ▼ ポイント付与対象チームの選択 → モーダル
  if (interaction.customId === 'select_point_team') {
    const teamId = interaction.values[0];
    const modal = new ModalBuilder().setCustomId(`modal_point_${teamId}`).setTitle('ポイント付与');
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('input_point')
          .setLabel('付与するポイント (例: 100, -50)')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      )
    );
    return interaction.showModal(modal);
  }

  // ▼ 捕獲したチームの選択
  if (interaction.customId === 'catch_select_menu') {
    const teamId = interaction.values[0];
    const teamIndex = game.teams.runner.findIndex((t) => t.id === teamId);
    if (teamIndex === -1) {
      return interaction.update({ content: 'そのチームは既に捕獲されています。', components: [] });
    }

    // 捕獲した鬼チームにポイント付与
    const trackerTeam = game.teams.oni.find((t) => t.discordIds.includes(interaction.user.id));
    if (trackerTeam) {
      game.points[trackerTeam.id] = (game.points[trackerTeam.id] || 0) + 100;
    }

    const caughtTeam = game.teams.runner.splice(teamIndex, 1)[0];
    game.teams.oni.push(caughtTeam);

    const oniRole = interaction.guild.roles.cache.find((r) => r.name === ONI_ROLE_NAME);
    const runnerRole = interaction.guild.roles.cache.find((r) => r.name === RUNNER_ROLE_NAME);

    for (const dId of caughtTeam.discordIds) {
      const member = await interaction.guild.members.fetch(dId).catch(() => null);
      if (member) {
        if (runnerRole) await member.roles.remove(runnerRole).catch(() => {});
        if (oniRole) await member.roles.add(oniRole).catch(() => {});
      }
    }

    await interaction.update({
      content: `✅ **逃走者チーム** (${caughtTeam.displayMembers.join(
        ', '
      )}) を捕獲し、鬼チームに 100pt 加算しました！`,
      components: [],
    });

    const controlCh = getControlChannel(interaction.guild, game);
    if (controlCh) {
      await controlCh.send(
        `🚨 **捕獲情報** 🚨\n<@${interaction.user.id}> が逃走者を捕まえました！(+100pt)\n捕まったメンバー: **${caughtTeam.displayMembers.join(
          ', '
        )}** は鬼陣営になります！`
      );
    }

    if (game.teams.runner.length === 0) {
      await endGame(interaction.guild, controlCh, '🎊 全員の逃走者が捕まりました！鬼陣営の勝利です！', game);
    }
    return;
  }
}

module.exports = { handleSelectMenu };
