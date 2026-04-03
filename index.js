// ==========================================
// リアル隠れ鬼ごっこ Bot - 【バグ修正版】
// ==========================================

require(‘dotenv’).config();

const {
Client, GatewayIntentBits, Partials, REST, Routes, EmbedBuilder,
PermissionsBitField, ChannelType, ActionRowBuilder, ButtonBuilder,
ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle,
StringSelectMenuBuilder
} = require(‘discord.js’);
const http = require(‘http’);

const clientId = process.env.DISCORD_CLIENT_ID;
const token = process.env.DISCORD_TOKEN;

const client = new Client({
intents:[
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.MessageContent,
GatewayIntentBits.GuildMembers,
],
partials:[Partials.Message, Partials.Channel],
});

// — ゲーム状態管理 —
function getInitialGameStatus(keepChannels = false, oldStatus = null) {
return {
phase: ‘idle’,
hostId: oldStatus ? oldStatus.hostId : null,
recruitmentMessageId: null,
// participants: Map<discordId, { discordId, guests:string[], pairedWith: Set<discordId> }>
participants: new Map(),
teams: { oni: [], runner:[] },
initialTeams: { oni:[], runner:[] },
points: (oldStatus && oldStatus.points) ? oldStatus.points : {},
controlPanelMessageId: null,
settings: oldStatus ? oldStatus.settings : { timeLimit: 60, oniTeamCount: 1, teamSize: 2 },
gameTimer: null,
createdChannelIds: (keepChannels && oldStatus) ? oldStatus.createdChannelIds : [],
categoryChannelId: (keepChannels && oldStatus) ? oldStatus.categoryChannelId : null,
gameChannelId: null,
mission: oldStatus ? oldStatus.mission : {
enabled: true, timer: null, intervalMin: 5, intervalMax: 15, customMissions:[],
defaultMissions:[
“指定された色のものを3つ集めて写真を撮れ！”,
“一番高い場所に移動して景色を報告せよ！”,
“チーム全員でジャンプしている写真を撮れ！”,
“自動販売機で一番安い飲み物を見つけて写真を撮れ！”,
“動物（犬・猫・鳥など）の写真を撮影せよ！”,
“街にある「数字の7」を探して写真を撮れ！”
]
},
photoRemind: oldStatus ? oldStatus.photoRemind : { timer: null, interval: 5 }
};
}

let gameStatus = getInitialGameStatus();

const ONI_ROLE_NAME = ‘鬼’;
const RUNNER_ROLE_NAME = ‘逃走者’;

// — コマンド定義 —
const commands = [
{ name: ‘ping’, description: ‘ボットの応答テスト’ },
{ name: ‘welcome’, description: ‘このボットの使い方・マニュアルを表示します。’ },
{ name: ‘game-recruit’, description: ‘リアル隠れ鬼ごっこの参加者募集パネルを表示します。’ },
{ name: ‘game-end’, description: ‘現在のゲームや募集を強制終了します（ホスト/管理者用）’ },
];

const rest = new REST({ version: ‘10’ }).setToken(token);
(async () => {
try {
await rest.put(Routes.applicationCommands(clientId), { body: commands });
console.log(‘コマンド登録完了。’);
} catch (error) {
console.error(error);
}
})();

client.once(‘ready’, () => { console.log(`${client.user.tag}としてログインしました！`); });

// — イベントハンドラ —
client.on(‘interactionCreate’, async (interaction) => {
try {
if (interaction.isChatInputCommand()) await handleSlashCommand(interaction);
else if (interaction.isButton()) await handleButton(interaction);
else if (interaction.isModalSubmit()) await handleModal(interaction);
else if (interaction.isStringSelectMenu()) await handleSelectMenu(interaction);
} catch (err) {
// 未応答のインタラクションに対してエラーを返す（二重応答を避ける）
console.error(‘InteractionError:’, err);
try {
const msg = { content: ‘⚠️ エラーが発生しました。もう一度試してください。’, ephemeral: true };
if (interaction.replied || interaction.deferred) {
await interaction.followUp(msg).catch(() => {});
} else {
await interaction.reply(msg).catch(() => {});
}
} catch (_) {}
}
});

// — 1. スラッシュコマンド処理 —
async function handleSlashCommand(interaction) {
const { commandName } = interaction;

if (commandName === ‘welcome’) {
const welcomeEmbed = new EmbedBuilder()
.setColor(0x00FF00)
.setTitle(‘👹 リアル隠れ鬼ごっこ Bot 取扱説明書’)
.setDescription(‘このBotは、現実世界での鬼ごっこをDiscordで楽しく管理するためのツールです。’)
.addFields(
{ name: ‘Step 1: 募集を開始する’, value: ‘ホストが `/game-recruit` を実行します。表示されたパネルで参加者を集めます。’ },
{ name: ‘Step 2: 参加・設定’, value: ‘参加者は「👍参加」を押し、必要なら「👤ゲスト」「🤝ペア」を設定します。\nホストは「👑ホストメニュー」から制限時間や人数を設定し、「✅募集終了」を押します。’ },
{ name: ‘Step 3: 準備と開始’, value: ‘自動作成された専用チャンネルで班ごとに作戦会議をします。\n準備ができたら、ホストが全体連絡チャンネルのパネルから「▶️ゲーム開始」を押します。’ },
{ name: ‘Step 4: ゲーム中’, value: ‘鬼は逃走者を捕まえたら「🤚捕獲報告」をします（チームごと鬼に移動します）。\n定期的にAI（または固定）からミッションが届くので、クリアしてポイントを稼ぎましょう！’ },
{ name: ‘Step 5: ゲーム終了’, value: ‘時間切れ、または逃走者全滅で終了し、ランキングが発表されます。\n最後にコンティニュー（再戦）か終了を選んで完了です。’ }
)
.setFooter({ text: ‘困ったときはサーバー管理者に相談してください。’ });
return interaction.reply({ embeds: [welcomeEmbed] });
}

if (commandName === ‘game-recruit’) {
if (gameStatus.phase !== ‘idle’) {
return interaction.reply({ content: ‘他のゲームが進行中または募集中です。’, ephemeral: true });
}

```
gameStatus = getInitialGameStatus(true, gameStatus);
gameStatus.phase = 'recruiting';
gameStatus.hostId = interaction.user.id;
gameStatus.participants.set(interaction.user.id, {
  discordId: interaction.user.id, guests: [], pairedWith: new Set()
});

// withResponse は discord.js v14.x によっては使えないため fetchReply: true を使う
await interaction.reply({ embeds: [generateRecruitEmbed()], components: generateRecruitButtons(), fetchReply: true });
const sent = await interaction.fetchReply();
gameStatus.recruitmentMessageId = sent.id;
gameStatus.gameChannelId = interaction.channelId;
return;
```

}

if (commandName === ‘game-end’) {
if (gameStatus.phase === ‘idle’) {
return interaction.reply({ content: ‘現在ゲームは行われていません。’, ephemeral: true });
}
if (
interaction.user.id !== gameStatus.hostId &&
!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)
) {
return interaction.reply({ content: ‘権限がありません。’, ephemeral: true });
}
await interaction.reply(‘ゲームを強制終了します…’);
await endGame(interaction.guild, interaction.channel, ‘管理者により強制終了されました。’);
return;
}

if (commandName === ‘ping’) {
return interaction.reply(‘Pong!’);
}
}

// — 2. ボタン処理 —
async function handleButton(interaction) {
const { customId } = interaction;

// ▼ 参加/取消
if (customId === ‘btn_join_leave’) {
if (gameStatus.phase !== ‘recruiting’) {
return interaction.reply({ content: ‘現在は募集フェーズではありません。’, ephemeral: true });
}
if (gameStatus.participants.has(interaction.user.id)) {
gameStatus.participants.delete(interaction.user.id);
} else {
gameStatus.participants.set(interaction.user.id, {
discordId: interaction.user.id, guests: [], pairedWith: new Set()
});
}
return interaction.update({ embeds: [generateRecruitEmbed()], components: generateRecruitButtons() });
}

// ▼ ゲスト追加
if (customId === ‘btn_add_guest’) {
if (!gameStatus.participants.has(interaction.user.id)) {
return interaction.reply({ content: ‘先に「参加」してください！’, ephemeral: true });
}
const modal = new ModalBuilder().setCustomId(‘modal_guest’).setTitle(‘ゲストの追加’);
modal.addComponents(
new ActionRowBuilder().addComponents(
new TextInputBuilder()
.setCustomId(‘guest_name’)
.setLabel(‘追加するゲスト名（カンマ区切り）’)
.setStyle(TextInputStyle.Short)
.setRequired(true)
)
);
return interaction.showModal(modal);
}

// ▼ ペアを組む
if (customId === ‘btn_pair’) {
if (!gameStatus.participants.has(interaction.user.id)) {
return interaction.reply({ content: ‘先に「参加」してください！’, ephemeral: true });
}
// 自分以外の参加者リスト
const others = […gameStatus.participants.keys()].filter(id => id !== interaction.user.id);
if (others.length === 0) {
return interaction.reply({ content: ‘ペアを組む相手がまだ参加していません。’, ephemeral: true });
}

```
const selectMenu = new StringSelectMenuBuilder()
  .setCustomId('select_pair')
  .setPlaceholder('絶対に同じチームになりたい相手を選択');

for (const dId of others) {
  // guild.members.cache にいない場合は fetch して補完
  let member = interaction.guild.members.cache.get(dId);
  if (!member) member = await interaction.guild.members.fetch(dId).catch(() => null);
  selectMenu.addOptions({
    label: member ? member.displayName : `ユーザー(${dId})`,
    value: dId
  });
}
return interaction.reply({
  content: 'ペア相手を選んでください。\n※選んだ相手とは必ず同じチームになります。',
  components: [new ActionRowBuilder().addComponents(selectMenu)],
  ephemeral: true
});
```

}

// ▼ ホスト専用メニューの展開
if (customId === ‘btn_host_menu’) {
if (interaction.user.id !== gameStatus.hostId) {
return interaction.reply({ content: ‘このメニューはホスト（募集開始者）専用です！’, ephemeral: true });
}
return interaction.reply({
content: ‘👑 **ホスト専用設定メニュー**\nここでゲームの設定や募集の締め切りを行えます。’,
components: generateHostMenuButtons(),
ephemeral: true
});
}

// ▼ ホスト専用設定ボタン
if (customId === ‘btn_setup_basic’) {
if (interaction.user.id !== gameStatus.hostId) {
return interaction.reply({ content: ‘ホスト専用です。’, ephemeral: true });
}
const modal = new ModalBuilder().setCustomId(‘modal_setup_basic’).setTitle(‘基本設定（時間・人数）’);
modal.addComponents(
new ActionRowBuilder().addComponents(
new TextInputBuilder().setCustomId(‘input_time’).setLabel(‘制限時間（分）’).setStyle(TextInputStyle.Short).setValue(String(gameStatus.settings.timeLimit)).setRequired(true)
),
new ActionRowBuilder().addComponents(
new TextInputBuilder().setCustomId(‘input_oni’).setLabel(‘鬼チームの数’).setStyle(TextInputStyle.Short).setValue(String(gameStatus.settings.oniTeamCount)).setRequired(true)
),
new ActionRowBuilder().addComponents(
new TextInputBuilder().setCustomId(‘input_teamsize’).setLabel(‘1チームの人数目安’).setStyle(TextInputStyle.Short).setValue(String(gameStatus.settings.teamSize)).setRequired(true)
)
);
return interaction.showModal(modal);
}

if (customId === ‘btn_setup_mission’) {
if (interaction.user.id !== gameStatus.hostId) {
return interaction.reply({ content: ‘ホスト専用です。’, ephemeral: true });
}
const modal = new ModalBuilder().setCustomId(‘modal_setup_mission’).setTitle(‘通知・ミッション設定’);
modal.addComponents(
new ActionRowBuilder().addComponents(
new TextInputBuilder().setCustomId(‘input_photo’).setLabel(‘写真通知の間隔（分）’).setStyle(TextInputStyle.Short).setValue(String(gameStatus.photoRemind.interval)).setRequired(true)
),
new ActionRowBuilder().addComponents(
new TextInputBuilder().setCustomId(‘input_min’).setLabel(‘ミッション発令 最小間隔（分）’).setStyle(TextInputStyle.Short).setValue(String(gameStatus.mission.intervalMin)).setRequired(true)
),
new ActionRowBuilder().addComponents(
new TextInputBuilder().setCustomId(‘input_max’).setLabel(‘ミッション発令 最大間隔（分）’).setStyle(TextInputStyle.Short).setValue(String(gameStatus.mission.intervalMax)).setRequired(true)
)
);
return interaction.showModal(modal);
}

if (customId === ‘btn_toggle_mission’) {
if (interaction.user.id !== gameStatus.hostId) {
return interaction.reply({ content: ‘ホスト専用です。’, ephemeral: true });
}
gameStatus.mission.enabled = !gameStatus.mission.enabled;
// ephemeralメッセージを更新してから、募集パネルも更新
await interaction.update({ components: generateHostMenuButtons() });
const msg = await interaction.channel.messages.fetch(gameStatus.recruitmentMessageId).catch(() => null);
if (msg) await msg.edit({ embeds: [generateRecruitEmbed()] });
return;
}

// ▼ 募集終了＆チーム分け
if (customId === ‘btn_close_recruit’) {
if (interaction.user.id !== gameStatus.hostId) {
return interaction.reply({ content: ‘ホスト専用です。’, ephemeral: true });
}
if (gameStatus.participants.size < 2) {
return interaction.reply({ content: ‘参加者が少なすぎます（最低2人必要）。’, ephemeral: true });
}

```
await interaction.update({ content: 'チーム分け・チャンネル設定中...', components: [] });
const result = await setupTeamsAndChannels(interaction.guild);
if (!result.success) {
  return interaction.editReply({ content: `⚠️ エラー: ${result.message}` });
}

await interaction.editReply({ content: '✅ 準備完了！各チャンネルで作戦会議をしてください。' });
const controlCh = interaction.guild.channels.cache.find(
  c => c.name === '📢全体連絡' && c.parentId === gameStatus.categoryChannelId
);
if (controlCh) await sendControlPanel(controlCh);
return;
```

}

// ▼ チーム再抽選
if (customId === ‘btn_reshuffle’) {
if (interaction.user.id !== gameStatus.hostId) {
return interaction.reply({ content: ‘ホスト専用です。’, ephemeral: true });
}
if (gameStatus.phase !== ‘ready’) {
return interaction.reply({ content: ‘準備完了フェーズでのみ可能です。’, ephemeral: true });
}
await interaction.deferReply();
await stripAllRoles(interaction.guild);
const result = await performTeamShuffle(interaction.guild);
if (!result.success) return interaction.editReply(`⚠️ エラー: ${result.message}`);

```
// チーム編成をチャンネルにメンション付きで通知
const controlCh = interaction.guild.channels.cache.find(
  c => c.name === '📢全体連絡' && c.parentId === gameStatus.categoryChannelId
);
if (controlCh) await announceTeams(controlCh);

return interaction.editReply('🔀 **チームを再抽選しました！** 各陣営チャンネルのメンションを確認してください。');
```

}

// ▼ ゲーム開始
if (customId === ‘start_game_button’) {
if (interaction.user.id !== gameStatus.hostId) {
return interaction.reply({ content: ‘ホスト専用です。’, ephemeral: true });
}
if (gameStatus.phase !== ‘ready’) {
return interaction.reply({ content: ‘準備完了していません。’, ephemeral: true });
}

```
gameStatus.phase = 'playing';
await interaction.reply(`▶️ **ゲームスタート！** 制限時間は **${gameStatus.settings.timeLimit}分** です！`);

const panelMsg = await interaction.channel.messages.fetch(gameStatus.controlPanelMessageId).catch(() => null);
if (panelMsg) {
  const playingEmbed = new EmbedBuilder()
    .setColor(0xFF0000)
    .setTitle('🎮 ゲーム進行中パネル')
    .setDescription('捕獲報告やポイント操作、ミッション追加ができます。');
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('btn_catch').setLabel('🤚 捕獲報告').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('btn_give_point').setLabel('🪙 ポイント操作(ホスト用)').setStyle(ButtonStyle.Success)
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('btn_add_mission').setLabel('📝 ミッション追加(ホスト用)').setStyle(ButtonStyle.Secondary)
  );
  await panelMsg.edit({ embeds: [playingEmbed], components: [row1, row2] });
}

gameStatus.gameTimer = setTimeout(() => {
  endGame(interaction.guild, interaction.channel, '⏰ 時間切れ！ゲーム終了です！');
}, gameStatus.settings.timeLimit * 60 * 1000);

startMissionTimer(interaction.guild);
startPhotoRemindTimer(interaction.guild);
return;
```

}

// ▼ 捕獲報告
if (customId === ‘btn_catch’) {
if (gameStatus.phase !== ‘playing’) {
return interaction.reply({ content: ‘ゲーム中のみ有効です。’, ephemeral: true });
}
const isOni = gameStatus.teams.oni.some(t => t.discordIds.includes(interaction.user.id));
if (!isOni && interaction.user.id !== gameStatus.hostId) {
return interaction.reply({ content: ‘鬼陣営のみ報告できます。’, ephemeral: true });
}
if (gameStatus.teams.runner.length === 0) {
return interaction.reply({ content: ‘逃走者がいません。’, ephemeral: true });
}

```
const selectMenu = new StringSelectMenuBuilder()
  .setCustomId('catch_select_menu')
  .setPlaceholder('捕獲したチームを選択');
gameStatus.teams.runner.forEach((team, index) => {
  selectMenu.addOptions({
    label: `逃走者 ${index + 1}班`,
    description: `メンバー: ${team.displayMembers.join(', ').substring(0, 50)}`,
    value: team.id
  });
});
return interaction.reply({
  content: 'どのチームを捕まえましたか？',
  components: [new ActionRowBuilder().addComponents(selectMenu)],
  ephemeral: true
});
```

}

// ▼ ポイント操作
if (customId === ‘btn_give_point’) {
if (interaction.user.id !== gameStatus.hostId) {
return interaction.reply({ content: ‘ホスト専用です。’, ephemeral: true });
}
const selectMenu = new StringSelectMenuBuilder()
.setCustomId(‘select_point_team’)
.setPlaceholder(‘ポイントを与えるチームを選択’);
gameStatus.teams.oni.forEach((t, i) =>
selectMenu.addOptions({ label: `👹鬼 ${i + 1}班`, description: `メンバー: ${t.displayMembers.join(', ').substring(0, 50)}`, value: t.id })
);
gameStatus.teams.runner.forEach((t, i) =>
selectMenu.addOptions({ label: `🏃逃走者 ${i + 1}班`, description: `メンバー: ${t.displayMembers.join(', ').substring(0, 50)}`, value: t.id })
);
return interaction.reply({
content: ‘どのチームにポイントを与えますか？’,
components: [new ActionRowBuilder().addComponents(selectMenu)],
ephemeral: true
});
}

// ▼ ミッション手動追加
if (customId === ‘btn_add_mission’) {
if (interaction.user.id !== gameStatus.hostId) {
return interaction.reply({ content: ‘ホスト専用です。’, ephemeral: true });
}
const modal = new ModalBuilder().setCustomId(‘modal_add_mission’).setTitle(‘ミッション手動追加’);
modal.addComponents(
new ActionRowBuilder().addComponents(
new TextInputBuilder().setCustomId(‘mission_content’).setLabel(‘ミッション内容’).setStyle(TextInputStyle.Paragraph).setRequired(true)
)
);
return interaction.showModal(modal);
}

// ▼ コンティニュー・終了操作
if ([‘btn_cont_same’, ‘btn_cont_shuffle’, ‘btn_end_keep’, ‘btn_end_cleanup’].includes(customId)) {
if (
interaction.user.id !== gameStatus.hostId &&
!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)
) {
return interaction.reply({ content: ‘ホストまたは管理者専用です。’, ephemeral: true });
}

```
if (customId === 'btn_cont_same') {
  await interaction.deferReply();
  // initialTeams は JSON.parse/stringify で保存されているので Set が失われていない
  gameStatus.teams = {
    oni: gameStatus.initialTeams.oni.map(t => ({ ...t })),
    runner: gameStatus.initialTeams.runner.map(t => ({ ...t }))
  };
  await stripAllRoles(interaction.guild);

  const oniRole = await getOrCreateRole(interaction.guild, ONI_ROLE_NAME, 'Red');
  const runnerRole = await getOrCreateRole(interaction.guild, RUNNER_ROLE_NAME, 'Blue');
  for (const t of gameStatus.teams.oni) {
    for (const id of t.discordIds) {
      const m = await interaction.guild.members.fetch(id).catch(() => null);
      if (m) await m.roles.add(oniRole).catch(() => {});
    }
  }
  for (const t of gameStatus.teams.runner) {
    for (const id of t.discordIds) {
      const m = await interaction.guild.members.fetch(id).catch(() => null);
      if (m) await m.roles.add(runnerRole).catch(() => {});
    }
  }

  gameStatus.phase = 'ready';
  await interaction.editReply('🔄 **同じチームでコンティニューします！** 各陣営のチャンネルで作戦会議をしてください。');
  const controlCh = interaction.guild.channels.cache.find(
    c => c.name === '📢全体連絡' && c.parentId === gameStatus.categoryChannelId
  );
  if (controlCh) {
    await announceTeams(controlCh);
    await sendControlPanel(controlCh);
  }
  return;
}

if (customId === 'btn_cont_shuffle') {
  await interaction.deferReply();
  await stripAllRoles(interaction.guild);
  const oldPoints = gameStatus.points;
  gameStatus = getInitialGameStatus(true, gameStatus);
  gameStatus.points = oldPoints; // ポイントを引き継ぐ場合はこの行を削除
  gameStatus.phase = 'recruiting';
  gameStatus.hostId = interaction.user.id;
  gameStatus.participants.set(interaction.user.id, {
    discordId: interaction.user.id, guests: [], pairedWith: new Set()
  });
  const msg = await interaction.channel.send({
    embeds: [generateRecruitEmbed()],
    components: generateRecruitButtons()
  });
  gameStatus.recruitmentMessageId = msg.id;
  gameStatus.gameChannelId = interaction.channelId;
  return interaction.editReply('🔀 **チームとポイントをリセットしました！再度募集を行います。**');
}

if (customId === 'btn_end_keep') {
  await interaction.deferReply();
  await stripAllRoles(interaction.guild);
  gameStatus = getInitialGameStatus(true, gameStatus);
  return interaction.editReply('♻️ **ゲームを終了しました。チャンネルは次回のために残しておきます。**');
}

if (customId === 'btn_end_cleanup') {
  await interaction.deferReply();
  await stripAllRoles(interaction.guild);
  await cleanupChannels(interaction.guild);
  gameStatus = getInitialGameStatus(false);
  return interaction.editReply('🗑️ **クリーンアップ完了！お疲れ様でした。**');
}
```

}
}

// — 3. モーダル処理 —
async function handleModal(interaction) {
// ▼ ゲスト追加 - モーダル送信後は reply() が正しい（update() は不可）
if (interaction.customId === ‘modal_guest’) {
const guestNames = interaction.fields.getTextInputValue(‘guest_name’)
.split(’,’).map(s => s.trim()).filter(s => s);
const data = gameStatus.participants.get(interaction.user.id);
if (!data) return interaction.reply({ content: ‘参加情報が見つかりません。再度参加ボタンを押してください。’, ephemeral: true });
data.guests.push(…guestNames);

```
// 募集パネルメッセージを更新
const msg = await interaction.channel.messages.fetch(gameStatus.recruitmentMessageId).catch(() => null);
if (msg) await msg.edit({ embeds: [generateRecruitEmbed()] });
return interaction.reply({ content: `✅ ゲスト「${guestNames.join(', ')}」を追加しました！`, ephemeral: true });
```

}

if (interaction.customId === ‘modal_setup_basic’) {
const time = parseInt(interaction.fields.getTextInputValue(‘input_time’));
const oniCount = parseInt(interaction.fields.getTextInputValue(‘input_oni’));
const teamSize = parseInt(interaction.fields.getTextInputValue(‘input_teamsize’));
if (isNaN(time) || isNaN(oniCount) || isNaN(teamSize) || oniCount < 1 || teamSize < 1) {
return interaction.reply({ content: ‘正しい数値を入力してください。’, ephemeral: true });
}

```
gameStatus.settings.timeLimit = time;
gameStatus.settings.oniTeamCount = oniCount;
gameStatus.settings.teamSize = teamSize;

const msg = await interaction.channel.messages.fetch(gameStatus.recruitmentMessageId).catch(() => null);
if (msg) await msg.edit({ embeds: [generateRecruitEmbed()] });
return interaction.reply({ content: '✅ 基本設定を保存し、募集パネルを更新しました。', ephemeral: true });
```

}

if (interaction.customId === ‘modal_setup_mission’) {
const photo = parseInt(interaction.fields.getTextInputValue(‘input_photo’));
const min = parseInt(interaction.fields.getTextInputValue(‘input_min’));
const max = parseInt(interaction.fields.getTextInputValue(‘input_max’));
if (isNaN(photo) || isNaN(min) || isNaN(max) || min > max || photo < 1) {
return interaction.reply({ content: ‘正しい数値を入力してください（最小間隔は最大間隔以下にしてください）。’, ephemeral: true });
}

```
gameStatus.photoRemind.interval = photo;
gameStatus.mission.intervalMin = min;
gameStatus.mission.intervalMax = max;

const msg = await interaction.channel.messages.fetch(gameStatus.recruitmentMessageId).catch(() => null);
if (msg) await msg.edit({ embeds: [generateRecruitEmbed()] });
return interaction.reply({ content: '✅ 通知/間隔設定を保存し、募集パネルを更新しました。', ephemeral: true });
```

}

if (interaction.customId === ‘modal_add_mission’) {
const content = interaction.fields.getTextInputValue(‘mission_content’);
gameStatus.mission.customMissions.push(content);
return interaction.reply({ content: `✅ 手動ミッションをストックしました！\n内容: ${content}`, ephemeral: true });
}

if (interaction.customId.startsWith(‘modal_point_’)) {
const teamId = interaction.customId.replace(‘modal_point_’, ‘’);
const points = parseInt(interaction.fields.getTextInputValue(‘input_point’));
if (isNaN(points)) return interaction.reply({ content: ‘数値を入力してください。’, ephemeral: true });

```
gameStatus.points[teamId] = (gameStatus.points[teamId] || 0) + points;

let teamName = '不明なチーム';
const oniIdx = gameStatus.teams.oni.findIndex(t => t.id === teamId);
if (oniIdx !== -1) {
  teamName = `👹鬼 ${oniIdx + 1}班`;
} else {
  const runIdx = gameStatus.teams.runner.findIndex(t => t.id === teamId);
  if (runIdx !== -1) teamName = `🏃逃走者 ${runIdx + 1}班`;
}

const controlCh = interaction.guild.channels.cache.find(
  c => c.name === '📢全体連絡' && c.parentId === gameStatus.categoryChannelId
);
if (controlCh) {
  await controlCh.send(
    `🪙 **ポイント追加！**\nミッション達成などの報酬として、**${teamName}** に **${points}pt** が付与されました！ (合計: ${gameStatus.points[teamId]}pt)`
  );
}
return interaction.reply({ content: `✅ ${teamName} に ${points}pt を付与しました。`, ephemeral: true });
```

}
}

// — 4. 選択メニュー処理 —
async function handleSelectMenu(interaction) {
if (interaction.customId === ‘select_pair’) {
const targetId = interaction.values[0];
const myData = gameStatus.participants.get(interaction.user.id);
const targetData = gameStatus.participants.get(targetId);

```
if (!myData || !targetData) {
  return interaction.update({ content: '⚠️ 参加者情報が見つかりません。', components: [] });
}

myData.pairedWith.add(targetId);
targetData.pairedWith.add(interaction.user.id);

let member = interaction.guild.members.cache.get(targetId);
if (!member) member = await interaction.guild.members.fetch(targetId).catch(() => null);

await interaction.update({
  content: `✅ **${member ? member.displayName : '相手'}** さんとペアを組みました！必ず同じチームになります。`,
  components: []
});

const msg = await interaction.channel.messages.fetch(gameStatus.recruitmentMessageId).catch(() => null);
if (msg) await msg.edit({ embeds: [generateRecruitEmbed()] });
return;
```

}

if (interaction.customId === ‘select_point_team’) {
const teamId = interaction.values[0];
const modal = new ModalBuilder().setCustomId(`modal_point_${teamId}`).setTitle(‘ポイント付与’);
modal.addComponents(
new ActionRowBuilder().addComponents(
new TextInputBuilder()
.setCustomId(‘input_point’)
.setLabel(‘付与するポイント (例: 100, -50)’)
.setStyle(TextInputStyle.Short)
.setRequired(true)
)
);
return interaction.showModal(modal);
}

if (interaction.customId === ‘catch_select_menu’) {
const teamId = interaction.values[0];
const teamIndex = gameStatus.teams.runner.findIndex(t => t.id === teamId);
if (teamIndex === -1) {
return interaction.update({ content: ‘そのチームは既に捕獲されています。’, components: [] });
}

```
// 捕獲した鬼チームにポイント付与
const trackerTeam = gameStatus.teams.oni.find(t => t.discordIds.includes(interaction.user.id));
if (trackerTeam) {
  gameStatus.points[trackerTeam.id] = (gameStatus.points[trackerTeam.id] || 0) + 100;
}

const caughtTeam = gameStatus.teams.runner.splice(teamIndex, 1)[0];
gameStatus.teams.oni.push(caughtTeam);

const oniRole = interaction.guild.roles.cache.find(r => r.name === ONI_ROLE_NAME);
const runnerRole = interaction.guild.roles.cache.find(r => r.name === RUNNER_ROLE_NAME);

for (const dId of caughtTeam.discordIds) {
  const member = await interaction.guild.members.fetch(dId).catch(() => null);
  if (member) {
    if (runnerRole) await member.roles.remove(runnerRole).catch(() => {});
    if (oniRole) await member.roles.add(oniRole).catch(() => {});
  }
}

await interaction.update({
  content: `✅ **逃走者チーム** (${caughtTeam.displayMembers.join(', ')}) を捕獲し、鬼チームに 100pt 加算しました！`,
  components: []
});

const controlCh = interaction.guild.channels.cache.find(
  c => c.name === '📢全体連絡' && c.parentId === gameStatus.categoryChannelId
);
if (controlCh) {
  await controlCh.send(
    `🚨 **捕獲情報** 🚨\n<@${interaction.user.id}> が逃走者を捕まえました！(+100pt)\n捕まったメンバー: **${caughtTeam.displayMembers.join(', ')}** は鬼陣営になります！`
  );
}

if (gameStatus.teams.runner.length === 0) {
  await endGame(interaction.guild, controlCh, '🎊 全員の逃走者が捕まりました！鬼陣営の勝利です！');
}
return;
```

}
}

// — 5. チーム編成アナウンス —
// チーム分け後、誰が同じチームかをメンション付きで全体連絡に投稿する
async function announceTeams(channel) {
const lines = [‘📋 **チーム編成が決まりました！**\n’];

gameStatus.teams.oni.forEach((team, i) => {
const mentions = team.discordIds.map(id => `<@${id}>`).join(’ ‘);
const guests = team.discordIds.length < team.displayMembers.length
? team.displayMembers.filter(m => m.startsWith(’(ゲスト)’)).join(’, ’)
: ‘’;
lines.push(`👹 **鬼 ${i + 1}班**: ${mentions}${guests ? ` / ゲスト: ${guests}` : ''}`);
});

gameStatus.teams.runner.forEach((team, i) => {
const mentions = team.discordIds.map(id => `<@${id}>`).join(’ ‘);
const guests = team.displayMembers.filter(m => m.startsWith(’(ゲスト)’)).join(’, ’);
lines.push(`🏃 **逃走者 ${i + 1}班**: ${mentions}${guests ? ` / ゲスト: ${guests}` : ''}`);
});

await channel.send(lines.join(’\n’));
}

// — 6. ミッション・タイマー機能 —
function startMissionTimer(guild) {
if (!gameStatus.mission.enabled) return;
const intervalMs =
(Math.floor(Math.random() * (gameStatus.mission.intervalMax - gameStatus.mission.intervalMin + 1)) +
gameStatus.mission.intervalMin) * 60 * 1000;

gameStatus.mission.timer = setTimeout(async () => {
if (gameStatus.phase !== ‘playing’) return;
await issueMission(guild);
startMissionTimer(guild); // 次のタイマーをセット
}, intervalMs);
}

async function issueMission(guild) {
let missionContent = ‘’;
if (gameStatus.mission.customMissions.length > 0) {
missionContent = gameStatus.mission.customMissions.shift();
} else {
const def = gameStatus.mission.defaultMissions;
missionContent = def[Math.floor(Math.random() * def.length)];
}

const controlCh = guild.channels.cache.find(
c => c.name === ‘📢全体連絡’ && c.parentId === gameStatus.categoryChannelId
);
if (controlCh) {
const runnerRole = guild.roles.cache.find(r => r.name === RUNNER_ROLE_NAME);
const embed = new EmbedBuilder()
.setColor(0xFFA500)
.setTitle(‘🚨 緊急ミッション発令！ 🚨’)
.setDescription(missionContent)
.setFooter({ text: ‘達成できたら写真共有チャンネルに投稿しよう！’ });
await controlCh.send({ content: runnerRole ? `<@&${runnerRole.id}>` : ‘@逃走者’, embeds: [embed] });
}
}

function startPhotoRemindTimer(guild) {
gameStatus.photoRemind.timer = setInterval(async () => {
if (gameStatus.phase !== ‘playing’) return;
const controlCh = guild.channels.cache.find(
c => c.name === ‘📢全体連絡’ && c.parentId === gameStatus.categoryChannelId
);
if (controlCh) {
const runnerRole = guild.roles.cache.find(r => r.name === RUNNER_ROLE_NAME);
const embed = new EmbedBuilder()
.setColor(0xADD8E6)
.setTitle(‘📸 写真提出リマインド’)
.setDescription(‘現在地のヒントとなる写真を「📸写真共有」チャンネルに投稿してください！’);
await controlCh.send({ content: runnerRole ? `<@&${runnerRole.id}>` : ‘@逃走者’, embeds: [embed] });
}
}, gameStatus.photoRemind.interval * 60 * 1000);
}

// — ユーティリティ —
async function performTeamShuffle(guild) {
let handled = new Set();
let groups = [];

for (const [id, data] of gameStatus.participants.entries()) {
if (handled.has(id)) continue;
let queue = [id];
let currentDiscordIds = [];
let currentGuests = [];

```
while (queue.length > 0) {
  const curr = queue.shift();
  if (handled.has(curr)) continue;
  handled.add(curr);

  const pData = gameStatus.participants.get(curr);
  if (!pData) continue;
  currentDiscordIds.push(curr);
  currentGuests.push(...pData.guests);

  for (const pairId of pData.pairedWith) {
    if (!handled.has(pairId)) queue.push(pairId);
  }
}
groups.push({ discordIds: currentDiscordIds, guests: currentGuests });
```

}

groups.sort(() => Math.random() - 0.5);

let allTeams = [];
let currentTeam = { discordIds: [], guests: [], displayMembers: [] };
let currentSize = 0;
const teamSizeLimit = gameStatus.settings.teamSize || 3;

for (const g of groups) {
let members = g.discordIds.map(id => `<@${id}>`);
g.guests.forEach(guest => members.push(`(ゲスト)${guest}`));
const gSize = g.discordIds.length + g.guests.length;

```
currentTeam.discordIds.push(...g.discordIds);
currentTeam.guests.push(...g.guests);
currentTeam.displayMembers.push(...members);
currentSize += gSize;

if (currentSize >= teamSizeLimit) {
  allTeams.push({
    id: `team-${Date.now()}-${allTeams.length}`,
    discordIds: [...currentTeam.discordIds],
    displayMembers: [...currentTeam.displayMembers]
  });
  currentTeam = { discordIds: [], guests: [], displayMembers: [] };
  currentSize = 0;
}
```

}
if (currentSize > 0) {
allTeams.push({
id: `team-${Date.now()}-${allTeams.length}`,
discordIds: […currentTeam.discordIds],
displayMembers: […currentTeam.displayMembers]
});
}

const oniCount = gameStatus.settings.oniTeamCount;
if (allTeams.length <= oniCount) {
return {
success: false,
message: `作成された総チーム数(${allTeams.length}) に対して、鬼の指定数(${oniCount}) が多すぎます。人数設定や鬼の数を見直してください。`
};
}

gameStatus.teams.oni = allTeams.slice(0, oniCount);
gameStatus.teams.runner = allTeams.slice(oniCount);
// JSON化してディープコピー（Map/Setは含まないので安全）
gameStatus.initialTeams = JSON.parse(JSON.stringify({
oni: gameStatus.teams.oni,
runner: gameStatus.teams.runner
}));

const oniRole = await getOrCreateRole(guild, ONI_ROLE_NAME, ‘Red’);
const runnerRole = await getOrCreateRole(guild, RUNNER_ROLE_NAME, ‘Blue’);

for (const team of gameStatus.teams.oni) {
for (const dId of team.discordIds) {
const m = await guild.members.fetch(dId).catch(() => null);
if (m) await m.roles.add(oniRole).catch(() => {});
}
}
for (const team of gameStatus.teams.runner) {
for (const dId of team.discordIds) {
const m = await guild.members.fetch(dId).catch(() => null);
if (m) await m.roles.add(runnerRole).catch(() => {});
}
}

return { success: true, roles: { oniRole, runnerRole } };
}

async function setupTeamsAndChannels(guild) {
const shuffleResult = await performTeamShuffle(guild);
if (!shuffleResult.success) return shuffleResult;

const roles = shuffleResult.roles;
gameStatus.phase = ‘ready’;

let category = guild.channels.cache.get(gameStatus.categoryChannelId);
if (!category) {
category = await guild.channels.create({ name: ‘👹リアル鬼ごっこ’, type: ChannelType.GuildCategory });
gameStatus.categoryChannelId = category.id;
}

// 各チャンネルを作成（既存なら再利用）
let controlCh = guild.channels.cache.find(c => c.name === ‘📢全体連絡’ && c.parentId === category.id);
if (!controlCh) {
controlCh = await guild.channels.create({
name: ‘📢全体連絡’, type: ChannelType.GuildText, parent: category.id,
permissionOverwrites: [{
id: guild.roles.everyone.id,
allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
}]
});
}

const pPhoto = [
{ id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
{ id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel] },
{ id: roles.oniRole.id, allow: [PermissionsBitField.Flags.ViewChannel] },
{ id: roles.runnerRole.id, allow: [PermissionsBitField.Flags.ViewChannel] }
];
let photoCh = guild.channels.cache.find(c => c.name === ‘📸写真共有’ && c.parentId === category.id);
if (!photoCh) photoCh = await guild.channels.create({ name: ‘📸写真共有’, type: ChannelType.GuildText, parent: category.id, permissionOverwrites: pPhoto });

const pOni = [
{ id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
{ id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel] },
{ id: roles.oniRole.id, allow: [PermissionsBitField.Flags.ViewChannel] }
];
let oniText = guild.channels.cache.find(c => c.name === ‘👹鬼陣営-作戦室’ && c.parentId === category.id);
let oniVC = guild.channels.cache.find(c => c.name === ‘🔊鬼陣営’ && c.parentId === category.id);
if (!oniText) oniText = await guild.channels.create({ name: ‘👹鬼陣営-作戦室’, type: ChannelType.GuildText, parent: category.id, permissionOverwrites: pOni });
if (!oniVC) oniVC = await guild.channels.create({ name: ‘🔊鬼陣営’, type: ChannelType.GuildVoice, parent: category.id, permissionOverwrites: pOni });

const pRun = [
{ id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
{ id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel] },
{ id: roles.runnerRole.id, allow: [PermissionsBitField.Flags.ViewChannel] }
];
let runText = guild.channels.cache.find(c => c.name === ‘🏃逃走者陣営-作戦室’ && c.parentId === category.id);
let runVC = guild.channels.cache.find(c => c.name === ‘🔊逃走者陣営’ && c.parentId === category.id);
if (!runText) runText = await guild.channels.create({ name: ‘🏃逃走者陣営-作戦室’, type: ChannelType.GuildText, parent: category.id, permissionOverwrites: pRun });
if (!runVC) runVC = await guild.channels.create({ name: ‘🔊逃走者陣営’, type: ChannelType.GuildVoice, parent: category.id, permissionOverwrites: pRun });

gameStatus.createdChannelIds = [photoCh.id, oniText.id, oniVC.id, runText.id, runVC.id];

// チーム分け結果をメンション付きで通知
await announceTeams(controlCh);

// 各陣営チャンネルにも通知
await oniText.send(`<@&${roles.oniRole.id}> チーム分けが完了しました！作戦会議を始めてください。`);
await runText.send(`<@&${roles.runnerRole.id}> チーム分けが完了しました！作戦会議を始めてください。`);

return { success: true };
}

// — UI生成 —
function generateRecruitEmbed() {
let pList = ‘’;
let totalCount = 0;
if (gameStatus.participants.size === 0) {
pList = ‘まだいません’;
} else {
gameStatus.participants.forEach((d) => {
pList += `・<@${d.discordId}>`;
if (d.guests.length > 0) pList += ` (ゲスト: ${d.guests.join(', ')})`;
if (d.pairedWith.size > 0) pList += ` 🤝ペア固定`;
pList += ‘\n’;
totalCount += (1 + d.guests.length);
});
}

let settingText = `⏰ 制限時間: **${gameStatus.settings.timeLimit}分**\n`;
settingText += `👹 鬼チーム数: **${gameStatus.settings.oniTeamCount}班**\n`;
settingText += `👥 1チーム人数: **約${gameStatus.settings.teamSize}人**\n`;
settingText += `📸 写真通知: **${gameStatus.photoRemind.interval}分ごと**\n`;
settingText += `🚨 ミッション: **${gameStatus.mission.enabled ? `ON (${gameStatus.mission.intervalMin}〜${gameStatus.mission.intervalMax}分)` : 'OFF'}**`;

return new EmbedBuilder()
.setColor(0x0099FF)
.setTitle(‘🏃 リアル隠れ鬼ごっこ 参加者募集 👹’)
.setDescription(‘下のボタンから参加、ゲスト追加、ペア設定を行ってください！’)
.addFields(
{ name: `現在の参加者（計 ${totalCount} 人）`, value: pList },
{ name: ‘⚙️ 現在のゲーム設定’, value: settingText }
);
}

function generateRecruitButtons() {
const row1 = new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId(‘btn_join_leave’).setLabel(‘👍 参加/取消’).setStyle(ButtonStyle.Primary),
new ButtonBuilder().setCustomId(‘btn_add_guest’).setLabel(‘👤 ゲスト追加’).setStyle(ButtonStyle.Secondary),
new ButtonBuilder().setCustomId(‘btn_pair’).setLabel(‘🤝 ペアを組む’).setStyle(ButtonStyle.Secondary),
new ButtonBuilder().setCustomId(‘btn_host_menu’).setLabel(‘👑 ホストメニュー’).setStyle(ButtonStyle.Danger)
);
return [row1];
}

function generateHostMenuButtons() {
const row1 = new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId(‘btn_setup_basic’).setLabel(‘⚙️ 時間/人数設定’).setStyle(ButtonStyle.Secondary),
new ButtonBuilder().setCustomId(‘btn_setup_mission’).setLabel(‘⚙️ 通知/間隔設定’).setStyle(ButtonStyle.Secondary),
new ButtonBuilder().setCustomId(‘btn_toggle_mission’).setLabel(`🔄 ミッション: ${gameStatus.mission.enabled ? 'ON' : 'OFF'}`).setStyle(gameStatus.mission.enabled ? ButtonStyle.Success : ButtonStyle.Danger)
);
const row2 = new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId(‘btn_close_recruit’).setLabel(‘✅ 募集終了＆チーム分け’).setStyle(ButtonStyle.Success)
);
return [row1, row2];
}

async function sendControlPanel(channel) {
const embed = new EmbedBuilder()
.setColor(0x5865F2)
.setTitle(‘🎮 ゲームコントロールパネル (準備中)’)
.setDescription(‘チームが気に入らない場合は再抽選できます。\n準備ができたら開始を押してください。’);
const row1 = new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId(‘start_game_button’).setLabel(‘▶️ ゲーム開始’).setStyle(ButtonStyle.Success),
new ButtonBuilder().setCustomId(‘btn_reshuffle’).setLabel(‘🔀 チーム再抽選’).setStyle(ButtonStyle.Secondary)
);
const sentMessage = await channel.send({ embeds: [embed], components: [row1] });
gameStatus.controlPanelMessageId = sentMessage.id;
}

async function getOrCreateRole(guild, roleName, color) {
let role = guild.roles.cache.find(r => r.name === roleName);
if (!role) role = await guild.roles.create({ name: roleName, color, reason: ‘鬼ごっこ用’ });
return role;
}

async function stripAllRoles(guild) {
const oniRole = guild.roles.cache.find(r => r.name === ONI_ROLE_NAME);
const runnerRole = guild.roles.cache.find(r => r.name === RUNNER_ROLE_NAME);
for (const dId of gameStatus.participants.keys()) {
try {
const m = await guild.members.fetch(dId).catch(() => null);
if (!m) continue;
if (oniRole) await m.roles.remove(oniRole).catch(() => {});
if (runnerRole) await m.roles.remove(runnerRole).catch(() => {});
} catch (e) {}
}
}

async function cleanupChannels(guild) {
for (const chId of gameStatus.createdChannelIds) {
const ch = guild.channels.cache.get(chId);
if (ch) await ch.delete().catch(() => {});
}
// カテゴリも削除
if (gameStatus.categoryChannelId) {
const cat = guild.channels.cache.get(gameStatus.categoryChannelId);
if (cat) await cat.delete().catch(() => {});
}
gameStatus.createdChannelIds = [];
gameStatus.categoryChannelId = null;
}

async function endGame(guild, channel, reason) {
gameStatus.phase = ‘postgame’;
if (gameStatus.gameTimer) clearTimeout(gameStatus.gameTimer);
if (gameStatus.mission.timer) clearTimeout(gameStatus.mission.timer);
if (gameStatus.photoRemind.timer) clearInterval(gameStatus.photoRemind.timer);
gameStatus.gameTimer = null;
gameStatus.mission.timer = null;
gameStatus.photoRemind.timer = null;

// コントロールパネルのボタンを無効化
if (gameStatus.controlPanelMessageId && channel) {
try {
const pMsg = await channel.messages.fetch(gameStatus.controlPanelMessageId);
const disabledRows = pMsg.components.map(row => {
const newRow = ActionRowBuilder.from(row);
newRow.components.forEach(c => c.setDisabled(true));
return newRow;
});
await pMsg.edit({ components: disabledRows });
} catch (e) {}
}

if (channel) {
let pointResults = [];
gameStatus.teams.oni.forEach((t, i) =>
pointResults.push({ name: `👹鬼 ${i + 1}班`, points: gameStatus.points[t.id] || 0, members: t.displayMembers.join(’, ‘) })
);
gameStatus.teams.runner.forEach((t, i) =>
pointResults.push({ name: `🏃逃走者 ${i + 1}班`, points: gameStatus.points[t.id] || 0, members: t.displayMembers.join(’, ’) })
);
pointResults.sort((a, b) => b.points - a.points);

```
let rankingText = pointResults.map((r, i) => `**${i + 1}位:** ${r.name} (${r.points}pt)\n└ ${r.members}`).join('\n\n');
if (!rankingText) rankingText = '参加者がいませんでした。';

const oniRole = guild.roles.cache.find(r => r.name === ONI_ROLE_NAME);
const runnerRole = guild.roles.cache.find(r => r.name === RUNNER_ROLE_NAME);
const mentionText = `${oniRole ? `<@&${oniRole.id}>` : '@鬼'} ${runnerRole ? `<@&${runnerRole.id}>` : '@逃走者'}`;

const endEmbed = new EmbedBuilder()
  .setColor(0x808080)
  .setTitle('🏁 ゲーム終了')
  .setDescription(`${reason}\n\n🏆 **最終ポイントランキング** 🏆\n${rankingText}\n\n**次のアクション（コンティニュー・終了）を選択してください：**`);

const row1 = new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId('btn_cont_same').setLabel('🔄 同じチームで再戦').setStyle(ButtonStyle.Success),
  new ButtonBuilder().setCustomId('btn_cont_shuffle').setLabel('🔀 チームを変えて再戦').setStyle(ButtonStyle.Primary)
);
const row2 = new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId('btn_end_keep').setLabel('♻️ 終了 (チャンネル残す)').setStyle(ButtonStyle.Secondary),
  new ButtonBuilder().setCustomId('btn_end_cleanup').setLabel('🗑️ 終了＆クリーンアップ').setStyle(ButtonStyle.Danger)
);

await channel.send({ content: mentionText, embeds: [endEmbed], components: [row1, row2] });
```

}
}

// — 起動 —
client.login(token);

const server = http.createServer((req, res) => {
if (client.isReady()) {
res.writeHead(200, { ‘Content-Type’: ‘text/plain’ });
res.end(‘Bot is ready.\n’);
} else {
res.writeHead(503, { ‘Content-Type’: ‘text/plain’ });
res.end(‘Bot is not ready.\n’);
}
});
server.listen(process.env.PORT || 8000, () => {
console.log(`Health check server listening on port ${process.env.PORT || 8000}`);
});