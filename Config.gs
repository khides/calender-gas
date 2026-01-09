/**
 * Config.gs - Calendar Sync Configuration
 *
 * このファイルを編集してソースカレンダーと同期オプションを設定してください
 */

const CONFIG = {
  // 宛先カレンダー (Account AのカレンダーID、'primary'で既定のカレンダー)
  destinationCalendarId: 'primary',

  // 同期するソースカレンダー (Account Aと共有されている必要があります)
  sourceCalendars: [
    {
      calendarId: 'example1@gmail.com',  // ← 実際のメールアドレスに変更
      label: 'Account B',                 // 識別用ラベル
      privacyMode: 'busy',               // 'full' | 'busy' | 'title-only'
      enabled: true,                      // false で一時的に無効化
      colorId: '1'                        // Google Calendar色ID (1-11)
    },
    {
      calendarId: 'example2@gmail.com',  // ← 実際のメールアドレスに変更
      label: 'Account C',
      privacyMode: 'busy',
      enabled: true,
      colorId: '2'
    }
    // 必要に応じてカレンダーを追加
    // {
    //   calendarId: 'example3@gmail.com',
    //   label: 'Account D',
    //   privacyMode: 'busy',
    //   enabled: true,
    //   colorId: '3'
    // }
  ],

  // 同期オプション
  syncOptions: {
    syncWindowDays: 90,           // 未来何日分を同期するか
    syncPastDays: 7,              // 過去何日分を同期するか
    includeAllDayEvents: true,    // 終日イベントを含めるか
    includeDeclinedEvents: false, // 辞退したイベントを含めるか
    batchSize: 50,                // 1回のAPI呼び出しで取得するイベント数
    retryAttempts: 3,             // リトライ回数
    retryDelayMs: 1000            // リトライ間隔 (ミリ秒)
  },

  // イベントマッピングオプション
  eventMapping: {
    prefixFormat: '[{label}] ',   // プレフィックス形式 ('[Work] Meeting' など)
    copyDescription: true,        // 説明をコピーするか (full modeのみ)
    copyLocation: true,           // 場所をコピーするか (full modeのみ)
    copyAttendees: false,         // 参加者をコピーするか (プライバシーのため通常false)
    copyReminders: false,         // リマインダーをコピーするか
    setAsPrivate: false           // 非公開としてマークするか
  },

  // トリガー設定
  triggers: {
    syncIntervalMinutes: 15,      // 定期同期の間隔 (分)
    useCalendarTriggers: true     // カレンダー変更トリガーを使用するか (即座同期)
  },

  // ログ設定
  logging: {
    level: 'INFO',                // 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'
    logToSheet: false,            // スプレッドシートにログを出力するか
    logSheetId: ''                // ログ出力先スプレッドシートID (オプション)
  }
};

/**
 * 設定を取得する
 * @returns {Object} 設定オブジェクト
 */
function getConfig() {
  return CONFIG;
}

/**
 * プライバシーモードの説明
 *
 * 'full':       タイトル、説明、場所など全ての情報をコピー
 * 'busy':       「予定あり」とだけ表示 (プライバシー重視)
 * 'title-only': タイトルと時間のみ表示 (説明・場所は非表示)
 *
 * カラーIDの対応:
 * 1: ラベンダー, 2: セージ, 3: ブドウ, 4: フラミンゴ, 5: バナナ
 * 6: みかん, 7: ピーコック, 8: グラファイト, 9: ブルーベリー, 10: バジル, 11: トマト
 */
