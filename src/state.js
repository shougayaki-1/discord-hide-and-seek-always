// ==========================================
// ゲーム状態管理
//
// 注意: gameStatus は複数箇所で「丸ごと差し替え」される。
// import binding の再代入は他モジュールへ伝播しないため、
// 状態は state コンテナ経由（state.game）で共有し、
// リセット時は state.game = getInitialGameStatus(...) で差し替える。
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
    photoRemind: oldStatus ? oldStatus.photoRemind : { timer: null, interval: 5 },
  };
}

// 全モジュールが参照する状態コンテナ
const state = { game: getInitialGameStatus() };

module.exports = { state, getInitialGameStatus };
