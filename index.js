// ==========================================
// リアル隠れ鬼ごっこ Bot - エントリポイント
// ==========================================
require('dotenv').config();

const { Client, REST, Routes } = require('discord.js');
const http = require('http');

const { INTENTS, PARTIALS, COMMANDS } = require('./src/config');
const { handleSlashCommand } = require('./src/handlers/commands');
const { handleButton } = require('./src/handlers/buttons');
const { handleModal } = require('./src/handlers/modals');
const { handleSelectMenu } = require('./src/handlers/selects');

const clientId = process.env.DISCORD_CLIENT_ID;
const token = process.env.DISCORD_TOKEN;

const client = new Client({ intents: INTENTS, partials: PARTIALS });

// — スラッシュコマンド登録 —
async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(token);
  try {
    await rest.put(Routes.applicationCommands(clientId), { body: COMMANDS });
    console.log('コマンド登録完了。');
  } catch (error) {
    console.error('コマンド登録に失敗しました:', error);
  }
}

client.once('ready', () => {
  console.log(`${client.user.tag}としてログインしました！`);
});

// — インタラクションの振り分け —
client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) await handleSlashCommand(interaction);
    else if (interaction.isButton()) await handleButton(interaction);
    else if (interaction.isModalSubmit()) await handleModal(interaction);
    else if (interaction.isStringSelectMenu()) await handleSelectMenu(interaction);
  } catch (err) {
    console.error('InteractionError:', err);
    try {
      const msg = { content: '⚠️ エラーが発生しました。もう一度試してください。', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(msg).catch(() => {});
      } else {
        await interaction.reply(msg).catch(() => {});
      }
    } catch (_) {
      /* 応答不能なら無視 */
    }
  }
});

// — 起動 —
registerCommands();
client.login(token);

// — ヘルスチェック用 HTTP サーバ —
const server = http.createServer((req, res) => {
  if (client.isReady()) {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is ready.\n');
  } else {
    res.writeHead(503, { 'Content-Type': 'text/plain' });
    res.end('Bot is not ready.\n');
  }
});
server.listen(process.env.PORT || 8000, () => {
  console.log(`Health check server listening on port ${process.env.PORT || 8000}`);
});
