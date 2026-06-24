// ==========================================
// スラッシュコマンド処理
// ==========================================
const { PermissionsBitField } = require('discord.js');
const { state, getInitialGameStatus } = require('../state');
const { generateRecruitEmbed, buildWelcomeEmbed } = require('../ui/embeds');
const { generateRecruitButtons } = require('../ui/components');
const { endGame } = require('../game/lifecycle');

async function handleSlashCommand(interaction) {
  const { commandName } = interaction;

  if (commandName === 'welcome') {
    return interaction.reply({ embeds: [buildWelcomeEmbed()] });
  }

  if (commandName === 'game-recruit') {
    if (state.game.phase !== 'idle') {
      return interaction.reply({ content: '他のゲームが進行中または募集中です。', ephemeral: true });
    }

    state.game = getInitialGameStatus(true, state.game);
    state.game.phase = 'recruiting';
    state.game.hostId = interaction.user.id;
    state.game.participants.set(interaction.user.id, {
      discordId: interaction.user.id,
      guests: [],
      pairedWith: new Set(),
    });

    await interaction.reply({
      embeds: [generateRecruitEmbed()],
      components: generateRecruitButtons(),
    });
    const sent = await interaction.fetchReply();
    state.game.recruitmentMessageId = sent.id;
    state.game.gameChannelId = interaction.channelId;
    return;
  }

  if (commandName === 'game-end') {
    if (state.game.phase === 'idle') {
      return interaction.reply({ content: '現在ゲームは行われていません。', ephemeral: true });
    }
    const isAdmin = interaction.member?.permissions?.has(PermissionsBitField.Flags.Administrator);
    if (interaction.user.id !== state.game.hostId && !isAdmin) {
      return interaction.reply({ content: '権限がありません。', ephemeral: true });
    }
    await interaction.reply('ゲームを強制終了します…');
    await endGame(interaction.guild, interaction.channel, '管理者により強制終了されました。');
    return;
  }

  if (commandName === 'ping') {
    return interaction.reply('Pong!');
  }
}

module.exports = { handleSlashCommand };
