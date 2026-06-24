// ==========================================
// スラッシュコマンド処理
// ==========================================
const { PermissionsBitField } = require('discord.js');
const { getGame, setGame, getInitialGameStatus } = require('../state');
const { generateRecruitEmbed, buildWelcomeEmbed } = require('../ui/embeds');
const { generateRecruitButtons } = require('../ui/components');
const { endGame } = require('../game/lifecycle');

async function handleSlashCommand(interaction) {
  const { commandName } = interaction;

  if (commandName === 'ping') {
    return interaction.reply('Pong!');
  }

  if (commandName === 'welcome') {
    return interaction.reply({ embeds: [buildWelcomeEmbed()] });
  }

  // 以降はサーバー内専用
  if (!interaction.guild) {
    return interaction.reply({ content: 'このコマンドはサーバー内で実行してください。', ephemeral: true });
  }
  const guildId = interaction.guild.id;

  if (commandName === 'game-recruit') {
    const game = getGame(guildId);
    if (game.phase !== 'idle') {
      return interaction.reply({ content: 'このサーバーでは他のゲームが進行中または募集中です。', ephemeral: true });
    }

    const newGame = setGame(guildId, getInitialGameStatus(true, game));
    newGame.phase = 'recruiting';
    newGame.hostId = interaction.user.id;
    newGame.participants.set(interaction.user.id, {
      discordId: interaction.user.id,
      guests: [],
      pairedWith: new Set(),
    });

    await interaction.reply({
      embeds: [generateRecruitEmbed(newGame)],
      components: generateRecruitButtons(),
    });
    const sent = await interaction.fetchReply();
    newGame.recruitmentMessageId = sent.id;
    newGame.gameChannelId = interaction.channelId;
    return;
  }

  if (commandName === 'game-end') {
    const game = getGame(guildId);
    if (game.phase === 'idle') {
      return interaction.reply({ content: '現在ゲームは行われていません。', ephemeral: true });
    }
    const isAdmin = interaction.member?.permissions?.has(PermissionsBitField.Flags.Administrator);
    if (interaction.user.id !== game.hostId && !isAdmin) {
      return interaction.reply({ content: '権限がありません。', ephemeral: true });
    }
    await interaction.reply('ゲームを強制終了します…');
    await endGame(interaction.guild, interaction.channel, '管理者により強制終了されました。', game);
    return;
  }
}

module.exports = { handleSlashCommand };
