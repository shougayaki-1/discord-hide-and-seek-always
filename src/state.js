// ==========================================
// ゲーム状態管理（サーバー＝guildごとに独立）
//
// マルチサーバー対応: 状態を Map<guildId, gameState> で保持する。
// 各処理は guildId から getGame() で自分のサーバーの状態を取得する。
// 状態を丸ごと差し替えるリセットは setGame() を使う。
// ==========================================

function getInitialGameStatus(keepChannels = false, oldStatus = null) {
  return {
    phase: 'idle',
    hostId: oldStatus ? oldStatus.hostId : null,
    recruitmentMessageId: null,
    // participants: Map<discordId, { discordId, guests:string[], pairedWith: Set<discordId> }>
    participants: new Map(),
    teams: { oni: [], runner: [] },
    initialTeams: { oni: [], runner: [] },
    points: oldStatus && oldStatus.points ? oldStatus.points : {},
    controlPanelMessageId: null,
    settings: oldStatus ? oldStatus.settings : { timeLimit: 60, oniTeamCount: 1, teamSize: 2 },
    gameTimer: null,
    createdChannelIds: keepChannels && oldStatus ? oldStatus.createdChannelIds : [],
    categoryChannelId: keepChannels && oldStatus ? oldStatus.categoryChannelId : null,
    gameChannelId: null,
    photoThreadId: null,
    mission: oldStatus
      ? oldStatus.mission
      : {
          enabled: true,
          timer: null,
          intervalMin: 5,
          intervalMax: 15,
          customMissions: [],
          defaultMissions: [
            '指定された色のものを3つ集めて写真を撮れ！',
            '一番高い場所に移動して景色を報告せよ！',
            'チーム全員でジャンプしている写真を撮れ！',
            '自動販売機で一番安い飲み物を見つけて写真を撮れ！',
            '動物（犬・猫・鳥など）の写真を撮影せよ！',
            '街にある「数字の7」を探して写真を撮れ！',
          ],
        },
    photoRemind: oldStatus
      ? oldStatus.photoRemind
      : { timer: null, interval: 5, unsubmittedTimers: [] },
  };
}

// guildId -> gameState
const games = new Map();

// 該当サーバーの状態を取得（無ければ idle 状態を生成）
function getGame(guildId) {
  let game = games.get(guildId);
  if (!game) {
    game = getInitialGameStatus();
    games.set(guildId, game);
  }
  return game;
}

// 該当サーバーの状態を差し替える
function setGame(guildId, game) {
  games.set(guildId, game);
  return game;
}

// 該当サーバーの状態を破棄（クリーンアップ完了時など）
function deleteGame(guildId) {
  games.delete(guildId);
}

module.exports = { getGame, setGame, deleteGame, getInitialGameStatus, games };
