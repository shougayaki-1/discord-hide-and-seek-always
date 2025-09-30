// discord.jsライブラリ
const {
  Client, GatewayIntentBits, Partials, REST, Routes, EmbedBuilder,
  ApplicationCommandOptionType, PermissionsBitField, ChannelType,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
} = require('discord.js');

// Googleスプレッドシート連携ライブラリ
const { JWT } = require('google-auth-library');
const { GoogleSpreadsheet } = require('google-spreadsheet');

// 設定ファイルと認証情報
const { clientId, token, spreadsheetId } = require('./config.json');
const creds = require('./google-credentials.json');

// --- Google Sheets API セットアップ ---
const serviceAccountAuth = new JWT({
  email: creds.client_email,
  key: creds.private_key,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const doc = new GoogleSpreadsheet(spreadsheetId, serviceAccountAuth);


// --- Discordボット本体の作成 ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});


// --- ゲームの状態を管理する変数 ---
let gameStatus = {
  phase: 'idle',
  participants: new Set(),
  recruitmentMessageId: null,
  teams: { oni: [], runner: [] },
  points: {},
  gameMasterId: null,
  controlPanelMessageId: null,
  timeLimit: 0,
  gameTimer: null,
  mission: {
    enabled: false,
    timer: null,
    intervalMin: 5,
    intervalMax: 15,
  },
  photoRemind: {
    timer: null,
    interval: 3,
  },
  // ★ コマンドが実行されたチャンネルIDを保存
  gameChannelId: null,
  createdChannelIds: [],
  categoryChannelId: null,
};


// --- 設定値 ---
const ONI_ROLE_NAME = '鬼';
const RUNNER_ROLE_NAME = '逃走者';


// --- スラッシュコマンドの定義 ---
const commands = [
  { name: 'ping', description: 'ボットが応答するかテストします。' },
  {
    name: 'game-recruit',
    description: 'リアル隠れ鬼ごっこの参加者募集を開始します。',
    options: [
      { name: 'title', description: 'ゲームのタイトル', type: ApplicationCommandOptionType.String, required: true },
      { name: 'description', description: 'ゲームの説明やルールなど', type: ApplicationCommandOptionType.String, required: false },
    ],
  },
  {
    name: 'game-set-teams',
    description: '募集を締め切り、チーム分けと専用チャンネル作成を行います。',
    options: [
      { name: 'oni-team-count', description: '鬼チームの数を指定します。', type: ApplicationCommandOptionType.Integer, required: true, minValue: 1 },
      { name: 'time-limit', description: 'ゲームの制限時間（分）を指定します。', type: ApplicationCommandOptionType.Integer, required: true, minValue: 1 },
      { name: 'enable-missions', description: 'ゲーム中にミッションを発令するかどうか (デフォルト: OFF)', type: ApplicationCommandOptionType.Boolean, required: false },
      { name: 'photo-remind-interval', description: '写真リマインドの間隔（分） (デフォルト: 3分)', type: ApplicationCommandOptionType.Integer, required: false, minValue: 1 },
      { name: 'mission-interval-min', description: 'ミッション発令の最小間隔（分） (デフォルト: 5分)', type: ApplicationCommandOptionType.Integer, required: false, minValue: 1 },
      { name: 'mission-interval-max', description: 'ミッション発令の最大間隔（分） (デフォルト: 15分)', type: ApplicationCommandOptionType.Integer, required: false, minValue: 1 },
    ],
  },
  { name: 'game-end', description: '現在のゲームを強制終了します。（管理者/ゲームマスター専用）' },
];


// --- スラッシュコマンドの登録 ---
const rest = new REST({ version: '10' }).setToken(token);
(async () => {
  try {
    console.log('スラッシュコマンドの登録を更新します...');
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
    console.log('スラッシュコマンドの登録が正常に完了しました。');
  } catch (error) { console.error('スラッシュコマンドの登録中にエラー:', error); }
})();


// --- ボット起動時の処理 ---
client.on('ready', () => { console.log(`${client.user.tag}としてログインしました！`); });


// --- インタラクション受付 ---
client.on('interactionCreate', async (interaction) => {
  if (interaction.isChatInputCommand()) await handleSlashCommand(interaction);
  else if (interaction.isButton()) await handleButton(interaction);
  else if (interaction.isStringSelectMenu()) await handleSelectMenu(interaction);
});

// --- リアクション受付 ---
client.on('messageReactionAdd', async (reaction, user) => {
  if (user.bot || gameStatus.phase !== 'recruiting' || reaction.message.id !== gameStatus.recruitmentMessageId || reaction.emoji.name !== '👍') return;
  gameStatus.participants.add(user.id);
  await updateRecruitmentMessage(reaction.message);
});
client.on('messageReactionRemove', async (reaction, user) => {
  if (user.bot || gameStatus.phase !== 'recruiting' || reaction.message.id !== gameStatus.recruitmentMessageId || reaction.emoji.name !== '👍') return;
  gameStatus.participants.delete(user.id);
  await updateRecruitmentMessage(reaction.message);
});


// --- スラッシュコマンド処理 ---
async function handleSlashCommand(interaction) {
  const { commandName } = interaction;

  if (commandName === 'ping') {
    await interaction.reply('Pong!');
  }

  if (commandName === 'game-recruit') {
    // (変更なし)
    if (gameStatus.phase !== 'idle') {
      return interaction.reply({ content: '現在、他のゲームが進行中または募集中です。', ephemeral: true });
    }
    gameStatus.phase = 'recruiting';
    gameStatus.participants.clear();
    const title = interaction.options.getString('title');
    const description = interaction.options.getString('description') || '奮ってご参加ください！';
    const recruitEmbed = new EmbedBuilder().setColor(0x0099FF).setTitle(`【参加者募集中】${title}`).setDescription(description).addFields({ name: '参加方法', value: 'このメッセージに👍リアクションを付けてください！' }, { name: '現在の参加者', value: '0人' }).setFooter({ text: 'リアル隠れ鬼ごっこBot' });
    const sentMessage = await interaction.reply({ embeds: [recruitEmbed], fetchReply: true });
    gameStatus.recruitmentMessageId = sentMessage.id;
    await sentMessage.react('👍');
  }

  if (commandName === 'game-set-teams') {
    if (gameStatus.phase !== 'recruiting') {
      return interaction.reply({ content: '現在、参加者募集中ではありません。', ephemeral: true });
    }
    if (gameStatus.participants.size < 2) {
      return interaction.reply({ content: `参加者が2人未満のため、ゲームを開始できません。`, ephemeral: true });
    }
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: 'このコマンドはサーバー管理者のみ実行できます。', ephemeral: true });
    }

    await interaction.deferReply({ content: 'チーム分けと専用チャンネルの作成を開始します...' });

    const participantsArray = Array.from(gameStatus.participants);
    const shuffledParticipants = participantsArray.sort(() => Math.random() - 0.5);
    const oniTeamCount = interaction.options.getInteger('oni-team-count');
    let teams = [];
    let tempTeam = [];
    for (const pId of shuffledParticipants) {
      tempTeam.push(pId);
      if (tempTeam.length === 2) {
        teams.push(tempTeam);
        tempTeam = [];
      }
    }
    if (tempTeam.length > 0) {
      if (teams.length > 0) {
        teams[teams.length - 1].push(tempTeam[0]);
      } else {
        teams.push(tempTeam);
      }
    }
    if (oniTeamCount >= teams.length) {
      return interaction.followUp({ content: `鬼チームの数が多すぎます。チームの総数は${teams.length}です。`, ephemeral: true });
    }
    gameStatus.teams.oni = teams.slice(0, oniTeamCount);
    gameStatus.teams.runner = teams.slice(oniTeamCount);

    const guild = interaction.guild;
    const oniRole = await getOrCreateRole(guild, ONI_ROLE_NAME, 'Red');
    const runnerRole = await getOrCreateRole(guild, RUNNER_ROLE_NAME, 'Blue');
    for (const team of gameStatus.teams.oni) {
      for (const mId of team) {
        (await guild.members.fetch(mId)).roles.add(oniRole);
      }
    }
    for (const team of gameStatus.teams.runner) {
      for (const mId of team) {
        (await guild.members.fetch(mId)).roles.add(runnerRole);
      }
    }

    await createTeamChannels(guild);

    gameStatus.points = {};
    gameStatus.teams.oni.forEach((_, i) => gameStatus.points[`oni-${i}`] = 0);
    gameStatus.teams.runner.forEach((_, i) => gameStatus.points[`runner-${i}`] = 0);
    
    gameStatus.mission.enabled = interaction.options.getBoolean('enable-missions') || false;
    gameStatus.photoRemind.interval = interaction.options.getInteger('photo-remind-interval') || 3;
    const minInterval = interaction.options.getInteger('mission-interval-min') || 5;
    const maxInterval = interaction.options.getInteger('mission-interval-max') || 15;
    if (minInterval > maxInterval) {
      return interaction.followUp({ content: 'ミッションの最小間隔は最大間隔より大きい値にできません。', ephemeral: true });
    }
    gameStatus.mission.intervalMin = minInterval;
    gameStatus.mission.intervalMax = maxInterval;

    const teamsEmbed = new EmbedBuilder().setColor(0xFFFF00).setTitle('チーム分け完了 & 専用チャンネル作成！').setDescription('各チームの専用チャンネルで、作戦会議をしてください！\nゲームマスターがコントロールパネルからゲームを開始します。');
    gameStatus.teams.oni.forEach((t, i) => teamsEmbed.addFields({ name: `鬼チーム ${i + 1}`, value: t.map(id => `<@${id}>`).join('\n'), inline: true }));
    gameStatus.teams.runner.forEach((t, i) => teamsEmbed.addFields({ name: `逃走者チーム ${i + 1}`, value: t.map(id => `<@${id}>`).join('\n'), inline: true }));

    await interaction.editReply({ content: '', embeds: [teamsEmbed] });

    gameStatus.phase = 'ready';
    gameStatus.gameMasterId = interaction.user.id;
    gameStatus.timeLimit = interaction.options.getInteger('time-limit');
    // ★ チャンネルIDを保存
    gameStatus.gameChannelId = interaction.channelId;
    await sendControlPanel(interaction.channel);
  }

  if (commandName === 'game-end') {
    if (gameStatus.phase !== 'playing' && gameStatus.phase !== 'ready') {
      return interaction.reply({ content: '現在ゲームは行われていません。', ephemeral: true });
    }
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator) && interaction.user.id !== gameStatus.gameMasterId) {
      return interaction.reply({ content: 'ゲームを終了できるのは、サーバー管理者またはゲームを開始した本人だけです。', ephemeral: true });
    }
    await interaction.reply('ゲームを強制終了します...');
    await endGame(interaction.guild, interaction.channel, 'ゲームマスターによりゲームが強制終了されました。');
  }
}

// --- ボタン処理 ---
async function handleButton(interaction) {
  const { customId } = interaction;

  if (customId === 'start_game_button') {
    if (interaction.user.id !== gameStatus.gameMasterId) {
      return interaction.reply({ content: 'ゲームマスターのみがゲームを開始できます。', ephemeral: true });
    }
    if (gameStatus.phase !== 'ready') {
      return interaction.reply({ content: 'ゲームは準備完了状態ではありません。', ephemeral: true });
    }

    gameStatus.phase = 'playing';

    const panelMsg = await interaction.channel.messages.fetch(gameStatus.controlPanelMessageId);
    const startButton = new ButtonBuilder().setCustomId('start_game_button').setLabel('▶️ ゲーム開始').setStyle(ButtonStyle.Success).setDisabled(true);
    const catchButton = ButtonBuilder.from(panelMsg.components[0].components[1]);
    const row = new ActionRowBuilder().addComponents(startButton, catchButton);
    await panelMsg.edit({ components: [row] });

    await interaction.reply(`**${interaction.user.displayName}** がゲームを開始しました！ 制限時間は **${gameStatus.timeLimit}分** です！`);

    gameStatus.gameTimer = setTimeout(() => {
      endGame(interaction.guild, interaction.channel, '時間切れによりゲームが終了しました！');
    }, gameStatus.timeLimit * 60 * 1000);
    if (gameStatus.mission.enabled) {
      startMissionTimer(interaction.guild);
    }
    startPhotoRemindTimer(interaction.guild);
  }

  if (customId === 'catch_button') {
    // (変更なし)
    if (gameStatus.phase !== 'playing') {
      return interaction.reply({ content: 'ゲームが開始されていません。', ephemeral: true });
    }
    const executor = interaction.member;
    if (!executor.roles.cache.some(r => r.name === ONI_ROLE_NAME)) {
      return interaction.reply({ content: 'このボタンは鬼チームのメンバーしか使用できません。', ephemeral: true });
    }
    const allRunners = gameStatus.teams.runner.flat();
    if (allRunners.length === 0) {
      return interaction.reply({ content: '捕獲対象の逃走者がいません。', ephemeral: true });
    }
    const selectMenu = new StringSelectMenuBuilder().setCustomId('catch_select_menu').setPlaceholder('捕まえた逃走者を選択').addOptions(allRunners.map(rId => { const m = interaction.guild.members.cache.get(rId); return { label: m ? m.displayName : `不明 (${rId})`, value: rId }; }));
    const row = new ActionRowBuilder().addComponents(selectMenu);
    await interaction.reply({ content: '誰を捕まえましたか？', components: [row], ephemeral: true });
  }
}

// --- ドロップダウンメニュー処理 ---
async function handleSelectMenu(interaction) {
  // (変更なし)
  if (interaction.customId === 'catch_select_menu') {
    const targetId = interaction.values[0];
    const target = await interaction.guild.members.fetch(targetId);

    const oniRole = await getOrCreateRole(interaction.guild, ONI_ROLE_NAME);
    const runnerRole = await getOrCreateRole(interaction.guild, RUNNER_ROLE_NAME);
    await target.roles.remove(runnerRole);
    await target.roles.add(oniRole);

    gameStatus.teams.runner = gameStatus.teams.runner.map(t => t.filter(id => id !== targetId)).filter(t => t.length > 0);
    if (gameStatus.teams.oni.length > 0) {
      gameStatus.teams.oni[0].push(targetId);
    } else {
      gameStatus.teams.oni.push([targetId]);
    }

    const pointValue = 100;
    const oniTeamId = findTeamIdByMember(interaction.user.id, 'oni');
    if (oniTeamId) {
      gameStatus.points[oniTeamId] = (gameStatus.points[oniTeamId] || 0) + pointValue;
    }

    await interaction.update({ content: `**${target.displayName}** を捕獲したことを記録しました！`, components: [] });
    await interaction.channel.send(`**${interaction.member.displayName}** が **${target.displayName}** を捕獲した！ (${oniTeamId}に +${pointValue} pt)`);

    if (gameStatus.teams.runner.flat().length === 0) {
      await endGame(interaction.guild, interaction.channel, '全ての逃走者が捕まりました！鬼チームの勝利です！');
    }
  }
}


// --- ユーティリティ関数 ---

function startMissionTimer(guild) {
  const interval = (Math.floor(Math.random() * (gameStatus.mission.intervalMax - gameStatus.mission.intervalMin + 1)) + gameStatus.mission.intervalMin) * 60 * 1000;
  gameStatus.mission.timer = setTimeout(async () => {
    if (gameStatus.phase !== 'playing') return;
    await issueMission(guild);
    startMissionTimer(guild);
  }, interval);
}

async function issueMission(guild) {
  try {
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    const rows = await sheet.getRows();
    const availableMissions = rows.filter(row => row.get('used') !== 'TRUE');
    if (availableMissions.length === 0) {
      console.log('発令できるミッションがありません。');
      return;
    }

    const missionRow = availableMissions[Math.floor(Math.random() * availableMissions.length)];
    const missionContent = missionRow.get('content');
    const missionPoints = missionRow.get('points');

    const missionEmbed = new EmbedBuilder().setColor(0xFFA500).setTitle('🚨 緊急ミッション発令！ 🚨').setDescription(missionContent).addFields({ name: '達成報酬', value: `${missionPoints} ポイント` }).setFooter({ text: '達成はゲームマスターに口頭で報告してください。' });
    
    // ★ 保存したチャンネルIDのチャンネルに送信
    if (gameStatus.gameChannelId) {
        const mainChannel = guild.channels.cache.get(gameStatus.gameChannelId);
        if (mainChannel) {
            await mainChannel.send({ embeds: [missionEmbed] });
            console.log(`ミッションを #${mainChannel.name} に発令しました: ${missionContent}`);
        }
    }

    missionRow.set('used', 'TRUE');
    await missionRow.save();
  } catch (error) {
    console.error('ミッションの発令に失敗しました:', error);
  }
}

function startPhotoRemindTimer(guild) {
  gameStatus.photoRemind.timer = setInterval(async () => {
    if (gameStatus.phase !== 'playing') {
      clearInterval(gameStatus.photoRemind.timer);
      return;
    }

    const remindEmbed = new EmbedBuilder().setColor(0xADD8E6).setTitle('📸 写真提出リマインド 📸').setDescription('現在地のヒントとなる写真を、いずれかのチャンネルに投稿してください！');
    
    // ★ 保存したチャンネルIDのチャンネルに送信
    if (gameStatus.gameChannelId) {
        const mainChannel = guild.channels.cache.get(gameStatus.gameChannelId);
        if (mainChannel) {
            await mainChannel.send({ embeds: [remindEmbed] });
            console.log(`写真提出リマインドを #${mainChannel.name} に送信しました。`);
        }
    }
  }, gameStatus.photoRemind.interval * 60 * 1000);
}

async function createTeamChannels(guild) {
  // (変更なし)
  const category = await guild.channels.create({ name: '👹リアル鬼ごっこ', type: ChannelType.GuildCategory });
  gameStatus.categoryChannelId = category.id;
  const allTeams = [...gameStatus.teams.oni.map((t, i) => ({ n: `鬼チーム-${i + 1}`, m: t })), ...gameStatus.teams.runner.map((t, i) => ({ n: `逃走者チーム-${i + 1}`, m: t }))];
  for (const team of allTeams) {
    const pO = [{ id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] }, { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel] }, ...team.m.map(mId => ({ id: mId, allow: [PermissionsBitField.Flags.ViewChannel] }))];
    const txtCh = await guild.channels.create({ name: team.n, type: ChannelType.GuildText, parent: category.id, permissionOverwrites: pO }); gameStatus.createdChannelIds.push(txtCh.id);
    const vcCh = await guild.channels.create({ name: team.n, type: ChannelType.GuildVoice, parent: category.id, permissionOverwrites: pO }); gameStatus.createdChannelIds.push(vcCh.id);
    await txtCh.send(`${team.m.map(id => `<@${id}>`).join(' ')} こちらがあなたたちのチームチャンネルです！`);
  }
}

async function sendControlPanel(channel) {
  // (変更なし)
  const embed = new EmbedBuilder().setColor(0x5865F2).setTitle('ゲームコントロールパネル').setDescription('ここからゲームの操作ができます。');
  const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('start_game_button').setLabel('▶️ ゲーム開始').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId('catch_button').setLabel('🤚 捕獲報告').setStyle(ButtonStyle.Primary));
  const sentMessage = await channel.send({ embeds: [embed], components: [row] });
  gameStatus.controlPanelMessageId = sentMessage.id;
}

async function updateRecruitmentMessage(message) {
  // (変更なし)
  try {
    await message.fetch(); const originalEmbed = message.embeds[0]; if (!originalEmbed) return;
    let pList = 'まだいません'; if (gameStatus.participants.size > 0) { pList = Array.from(gameStatus.participants).map(uId => `<@${uId}>`).join('\n'); }
    const updatedEmbed = EmbedBuilder.from(originalEmbed).setFields({ name: '参加方法', value: 'このメッセージに👍リアクションを付けてください！' }, { name: `現在の参加者 (${gameStatus.participants.size}人)`, value: pList });
    await message.edit({ embeds: [updatedEmbed] });
  } catch(error) { console.error("募集メッセージの更新に失敗:", error); }
}

async function endGame(guild, channel, reason) {
  if (gameStatus.phase === 'idle') return;
  const wasPlaying = gameStatus.phase === 'playing';
  gameStatus.phase = 'idle';
  console.log('ゲームを終了します...');

  if (gameStatus.gameTimer) clearTimeout(gameStatus.gameTimer);
  if (gameStatus.mission.timer) clearTimeout(gameStatus.mission.timer);
  if (gameStatus.photoRemind.timer) clearInterval(gameStatus.photoRemind.timer);

  if (gameStatus.controlPanelMessageId && channel) { try { const pMsg = await channel.messages.fetch(gameStatus.controlPanelMessageId); const dComps = pMsg.components.map(r => { const nR = ActionRowBuilder.from(r); nR.components.forEach(c => c.setDisabled(true)); return nR; }); await pMsg.edit({ components: dComps }); } catch (e) { console.error('コントロールパネルの無効化に失敗:', e); } }

  const oniRole = guild.roles.cache.find(r => r.name === ONI_ROLE_NAME);
  const runnerRole = guild.roles.cache.find(r => r.name === RUNNER_ROLE_NAME);
  for (const mId of gameStatus.participants) { try { const m = await guild.members.fetch(mId); if (oniRole) m.roles.remove(oniRole).catch(console.error); if (runnerRole) m.roles.remove(runnerRole).catch(console.error); } catch (e) { console.error(`${mId} のロール剥奪失敗。`, e.message); } }

  for (const chId of gameStatus.createdChannelIds) { const ch = guild.channels.cache.get(chId); if (ch) ch.delete('ゲーム終了').catch(e => console.error(`${ch.name}の削除失敗:`, e.message)); }
  if (gameStatus.categoryChannelId) { const cat = guild.channels.cache.get(gameStatus.categoryChannelId); if (cat) cat.delete('ゲーム終了').catch(e => console.error(`カテゴリの削除失敗:`, e.message)); }

  if (channel && wasPlaying) {
    const resultEmbed = new EmbedBuilder().setColor(0x808080).setTitle('🏆 ゲーム終了 - 結果発表 🏆').setDescription(reason);
    const sortedTeams = Object.entries(gameStatus.points).sort(([, a], [, b]) => b - a);
    let resultText = '';
    sortedTeams.forEach(([teamId, points]) => {
      const [role, index] = teamId.split('-');
      const team = (role === 'oni') ? gameStatus.teams.oni[index] : gameStatus.teams.runner[index];
      if (team && team.length > 0) {
        const teamName = (role === 'oni') ? `鬼チーム ${Number(index) + 1}` : `逃走者チーム ${Number(index) + 1}`;
        resultText += `**${teamName}**: ${points} pt\n${team.map(id => `<@${id}>`).join(' ')}\n\n`;
      }
    });
    resultEmbed.addFields({ name: '最終結果', value: resultText || 'データがありません' });
    await channel.send({ embeds: [resultEmbed] });
  } else if (channel) {
    const endEmbed = new EmbedBuilder().setColor(0x808080).setTitle('ゲーム終了').setDescription(reason);
    await channel.send({ embeds: [endEmbed] });
  }

  // ★ gameChannelId もリセット
  gameStatus = {
    phase: 'idle', participants: new Set(), recruitmentMessageId: null,
    teams: { oni: [], runner: [] }, points: {}, gameMasterId: null, controlPanelMessageId: null,
    timeLimit: 0, gameTimer: null, mission: { enabled: false, timer: null, intervalMin: 5, intervalMax: 15 },
    photoRemind: { timer: null, interval: 3 }, gameChannelId: null, createdChannelIds: [], categoryChannelId: null,
  };
  console.log('ゲーム状態をリセットしました。');
}

async function getOrCreateRole(guild, roleName, color) {
  // (変更なし)
  let role = guild.roles.cache.find(r => r.name === roleName);
  if (!role) {
    role = await guild.roles.create({ name: roleName, color, reason: '鬼ごっこ用ロール' });
  }
  return role;
}

function findTeamIdByMember(memberId, role) {
  // (変更なし)
  const teams = gameStatus.teams[role];
  for (let i = 0; i < teams.length; i++) {
    if (teams[i].includes(memberId)) {
      return `${role}-${i}`;
    }
  }
  return null;
}

// --- ボットをDiscordにログインさせる ---
client.login(token);