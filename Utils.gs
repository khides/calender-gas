/**
 * Utils.gs - Helper Functions
 *
 * ユーティリティ関数と検証ヘルパー
 */

const Utils = {

  /**
   * 指数バックオフでリトライ
   * @param {Function} fn - リトライする関数
   * @param {number} maxAttempts - 最大リトライ回数
   * @param {number} baseDelayMs - 基本遅延時間 (ミリ秒)
   * @returns {*} 関数の戻り値
   */
  retry: function(fn, maxAttempts, baseDelayMs) {
    maxAttempts = maxAttempts || 3;
    baseDelayMs = baseDelayMs || 1000;

    let lastError;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return fn();
      } catch (error) {
        lastError = error;

        // 特定のエラーはリトライしない
        if (error.message.includes('403') ||
            error.message.includes('401') ||
            error.message.includes('404')) {
          throw error;
        }

        if (attempt < maxAttempts) {
          const delay = baseDelayMs * Math.pow(2, attempt - 1);
          AppLogger.warn('リトライ ' + attempt + '/' + maxAttempts, {
            error: error.message,
            nextDelayMs: delay
          });
          Utilities.sleep(delay);
        }
      }
    }

    throw lastError;
  },

  /**
   * 残り実行時間を確認
   * @returns {number} 残りミリ秒 (概算)
   */
  getRemainingTime: function() {
    // Apps Scriptの6分制限
    const MAX_EXECUTION_TIME = 6 * 60 * 1000;
    const startTime = parseInt(
      PropertiesService.getScriptProperties().getProperty('executionStartTime') ||
      Date.now()
    );
    return MAX_EXECUTION_TIME - (Date.now() - startTime);
  },

  /**
   * 実行開始時刻を記録
   */
  recordStartTime: function() {
    PropertiesService.getScriptProperties()
      .setProperty('executionStartTime', Date.now().toString());
  },

  /**
   * 期間を人間が読める形式にフォーマット
   * @param {number} ms - ミリ秒
   * @returns {string} フォーマット済み期間
   */
  formatDuration: function(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes > 0) {
      return minutes + '分 ' + remainingSeconds + '秒';
    }
    return seconds + '秒';
  },

  /**
   * カレンダーへのアクセスを検証
   * @param {string} calendarId - 検証するカレンダーID
   * @returns {boolean} アクセス可能な場合true
   */
  validateCalendarAccess: function(calendarId) {
    try {
      Calendar.Calendars.get(calendarId);
      return true;
    } catch (error) {
      return false;
    }
  },

  /**
   * 同期状態サマリーを取得
   * @returns {Object} 状態サマリー
   */
  getStatus: function() {
    const config = getConfig();
    const status = {
      lastSync: StorageManager.getLastSync(),
      calendars: [],
      triggers: Triggers.list(),
      storage: StorageManager.getStorageStats()
    };

    config.sourceCalendars.forEach(cal => {
      const syncToken = StorageManager.getSyncToken(cal.calendarId);
      const eventMap = StorageManager.getEventMap(cal.calendarId);

      status.calendars.push({
        calendarId: cal.calendarId,
        label: cal.label,
        enabled: cal.enabled,
        privacyMode: cal.privacyMode,
        hasSyncToken: !!syncToken,
        syncedEventCount: Object.keys(eventMap).length,
        accessible: this.validateCalendarAccess(cal.calendarId)
      });
    });

    return status;
  },

  /**
   * 設定とカレンダーアクセスを検証
   * @returns {Object} 検証結果
   */
  validateSetup: function() {
    const config = getConfig();
    const result = {
      valid: true,
      issues: [],
      calendars: []
    };

    // 宛先カレンダーをチェック
    const destAccessible = this.validateCalendarAccess(config.destinationCalendarId);
    result.calendars.push({
      id: config.destinationCalendarId,
      type: 'destination',
      accessible: destAccessible
    });

    if (!destAccessible) {
      result.valid = false;
      result.issues.push('宛先カレンダーにアクセスできません: ' + config.destinationCalendarId);
    }

    // ソースカレンダーをチェック
    config.sourceCalendars.forEach(cal => {
      const accessible = this.validateCalendarAccess(cal.calendarId);
      result.calendars.push({
        id: cal.calendarId,
        label: cal.label,
        type: 'source',
        enabled: cal.enabled,
        accessible: accessible
      });

      if (cal.enabled && !accessible) {
        result.valid = false;
        result.issues.push(
          'ソースカレンダーにアクセスできません: ' + cal.label +
          ' (' + cal.calendarId + ') - カレンダーが共有されているか確認してください'
        );
      }
    });

    // トリガー検証
    const triggerValidation = Triggers.validate();
    if (!triggerValidation.valid) {
      result.issues = result.issues.concat(triggerValidation.issues);
    }

    return result;
  },

  /**
   * メールアドレス形式の検証
   * @param {string} email - 検証するメールアドレス
   * @returns {boolean} 有効な場合true
   */
  isValidEmail: function(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  /**
   * 日付を日本時間でフォーマット
   * @param {Date} date - フォーマットする日付
   * @returns {string} フォーマット済み日付
   */
  formatDateJST: function(date) {
    return Utilities.formatDate(
      date,
      'Asia/Tokyo',
      'yyyy/MM/dd HH:mm:ss'
    );
  }
};
