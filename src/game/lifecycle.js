// ==========================================
// ゲーム終了処理
// ==========================================
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { state } = require('../state');
const { ONI_ROLE_NAME, RUNNER_ROLE_NAME, COLORS } = require('../config');

// 進行中の全タイマーを停止
function clearAllTimers() {
  const game = state.game;
  if (game.gameTimer) clearTimeout(game.gameTimer);
  if (game.mission.timer) clearTimeout(game.mission.timer);
  if (game.photoRemind.timer) clearInterval(game.photoRemind.timer);
  game.gameTimer = null;
  game.mission.timer = null;
  game.photoRemind.timer = null;
}

async function endGame(guild, channel, reason) {
  const game = state.game;
  game.phase = 'postgame';
  clearAllTimers();

  // コントロールパネルのボタンを無効化
  if (game.controlPanelMessageId && channel) {
    try {
      const pMsg = await channel.messages.fetch(game.controlPanelMessageId);
      const disabledRows = pMsg.components.map((row) => {
        const newRow = ActionRowBuilder.from(row);
        newRow.components.forEach((c) => c.setDisabled(true));
        return newRow;
      });
      await pMsg.edit({ components: disabledRows });
    } catch (e) {
      /* パネルが消えている場合は無視 */
    }
  }

  if (!channel) return;

  const pointResults = [];
  game.teams.oni.forEach((t, i) =>
    pointResults.push({
      name: `👹鬼 ${i + 1}班`,
      points: game.points[t.id] || 0,
      members: t.displayMembers.join(', '),
    })
  );
  game.teams.runner.forEach((t, i) =>
    pointResults.push({
      name: `🏃逃走者 ${i + 1}班`,
      points: game.points[t.id] || 0,
      members: t.displayMembers.join(', '),
    })
  );
  pointResults.sort((a, b) => b.points - a.points);

  let rankingText = pointResults
    .map((r, i) => `**${i + 1}位:** ${r.name} (${r.points}pt)\n└ ${r.members}`)
    .join('\n\n');
  if (!rankingText) rankingText = '参加者がいませんでした。';

  const oniRole = guild.roles.cache.find((r) => r.name === ONI_ROLE_NAME);
  const runnerRole = guild.roles.cache.find((r) => r.name === RUNNER_ROLE_NAME);
  const mentionText = `${oniRole ? `<@&${oniRole.id}>` : '@鬼'} ${
    runnerRole ? `<@&${runnerRole.id}>` : '@逃走者'
  }`;

  const endEmbed = new EmbedBuilder()
    .setColor(COLORS.END)
    .setTitle('🏁 ゲーム終了')
    .setDescription(
      `${reason}\n\n🏆 **最終ポイントランキング** 🏆\n${rankingText}\n\n**次のアクション（コンティニュー・終了）を選択してください：**`
    );

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('btn_cont_same').setLabel('🔄 同じチームで再戦').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('btn_cont_shuffle').setLabel('🔀 チームを変えて再戦').setStyle(ButtonStyle.Primary)
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('btn_end_keep').setLabel('♻️ 終了 (チャンネル残す)').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('btn_end_cleanup').setLabel('🗑️ 終了＆クリーンアップ').setStyle(ButtonStyle.Danger)
  );

  await channel.send({ content: mentionText, embeds: [endEmbed], components: [row1, row2] });
}

module.exports = { endGame, clearAllTimers };
