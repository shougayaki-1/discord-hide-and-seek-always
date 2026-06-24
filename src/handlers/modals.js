// ==========================================
// モーダル送信処理
// ==========================================
const { state } = require('../state');
const { generateRecruitEmbed } = require('../ui/embeds');
const { getControlChannel } = require('../utils/discord');

// 募集パネルメッセージを最新状態へ更新
async function refreshRecruitPanel(interaction) {
  if (!state.game.recruitmentMessageId) return;
  const msg = await interaction.channel.messages
    .fetch(state.game.recruitmentMessageId)
    .catch(() => null);
  if (msg) await msg.edit({ embeds: [generateRecruitEmbed()] });
}

async function handleModal(interaction) {
  const game = state.game;

  // ▼ ゲスト追加
  if (interaction.customId === 'modal_guest') {
    const guestNames = interaction.fields
      .getTextInputValue('guest_name')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s);
    const data = game.participants.get(interaction.user.id);
    if (!data) {
      return interaction.reply({
        content: '参加情報が見つかりません。再度参加ボタンを押してください。',
        ephemeral: true,
      });
    }
    data.guests.push(...guestNames);
    await refreshRecruitPanel(interaction);
    return interaction.reply({
      content: `✅ ゲスト「${guestNames.join(', ')}」を追加しました！`,
      ephemeral: true,
    });
  }

  // ▼ 基本設定
  if (interaction.customId === 'modal_setup_basic') {
    const time = parseInt(interaction.fields.getTextInputValue('input_time'));
    const oniCount = parseInt(interaction.fields.getTextInputValue('input_oni'));
    const teamSize = parseInt(interaction.fields.getTextInputValue('input_teamsize'));
    if (isNaN(time) || isNaN(oniCount) || isNaN(teamSize) || oniCount < 1 || teamSize < 1) {
      return interaction.reply({ content: '正しい数値を入力してください。', ephemeral: true });
    }
    game.settings.timeLimit = time;
    game.settings.oniTeamCount = oniCount;
    game.settings.teamSize = teamSize;
    await refreshRecruitPanel(interaction);
    return interaction.reply({
      content: '✅ 基本設定を保存し、募集パネルを更新しました。',
      ephemeral: true,
    });
  }

  // ▼ 通知/間隔設定
  if (interaction.customId === 'modal_setup_mission') {
    const photo = parseInt(interaction.fields.getTextInputValue('input_photo'));
    const min = parseInt(interaction.fields.getTextInputValue('input_min'));
    const max = parseInt(interaction.fields.getTextInputValue('input_max'));
    if (isNaN(photo) || isNaN(min) || isNaN(max) || min > max || photo < 1) {
      return interaction.reply({
        content: '正しい数値を入力してください（最小間隔は最大間隔以下にしてください）。',
        ephemeral: true,
      });
    }
    game.photoRemind.interval = photo;
    game.mission.intervalMin = min;
    game.mission.intervalMax = max;
    await refreshRecruitPanel(interaction);
    return interaction.reply({
      content: '✅ 通知/間隔設定を保存し、募集パネルを更新しました。',
      ephemeral: true,
    });
  }

  // ▼ ミッション手動追加
  if (interaction.customId === 'modal_add_mission') {
    const content = interaction.fields.getTextInputValue('mission_content');
    game.mission.customMissions.push(content);
    return interaction.reply({
      content: `✅ 手動ミッションをストックしました！\n内容: ${content}`,
      ephemeral: true,
    });
  }

  // ▼ ポイント付与
  if (interaction.customId.startsWith('modal_point_')) {
    const teamId = interaction.customId.replace('modal_point_', '');
    const points = parseInt(interaction.fields.getTextInputValue('input_point'));
    if (isNaN(points)) {
      return interaction.reply({ content: '数値を入力してください。', ephemeral: true });
    }

    game.points[teamId] = (game.points[teamId] || 0) + points;

    let teamName = '不明なチーム';
    const oniIdx = game.teams.oni.findIndex((t) => t.id === teamId);
    if (oniIdx !== -1) {
      teamName = `👹鬼 ${oniIdx + 1}班`;
    } else {
      const runIdx = game.teams.runner.findIndex((t) => t.id === teamId);
      if (runIdx !== -1) teamName = `🏃逃走者 ${runIdx + 1}班`;
    }

    const controlCh = getControlChannel(interaction.guild);
    if (controlCh) {
      await controlCh.send(
        `🪙 **ポイント付与！**\n**${teamName}** に **${points}pt** が付与されました！ (合計: ${game.points[teamId]}pt)`
      );
    }
    return interaction.reply({
      content: `✅ ${teamName} に ${points}pt を付与しました。`,
      ephemeral: true,
    });
  }
}

module.exports = { handleModal };
