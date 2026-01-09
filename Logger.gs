/**
 * Logger.gs - Structured Logging Utility
 *
 * 設定可能なログレベルとオプションのスプレッドシート出力
 */

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

const AppLogger = {

  /**
   * 現在のログレベルを取得
   * @private
   */
  _getLevel: function() {
    const config = getConfig();
    return LOG_LEVELS[config.logging.level] || LOG_LEVELS.INFO;
  },

  /**
   * ログエントリを出力
   * @private
   */
  _log: function(level, message, data) {
    if (LOG_LEVELS[level] < this._getLevel()) return;

    const logEntry = {
      timestamp: new Date().toISOString(),
      level: level,
      message: message
    };

    if (data) {
      logEntry.data = data;
    }

    const logString = JSON.stringify(logEntry);

    switch (level) {
      case 'ERROR':
        console.error(logString);
        break;
      case 'WARN':
        console.warn(logString);
        break;
      default:
        console.log(logString);
    }

    // オプション: スプレッドシートにログ出力
    const config = getConfig();
    if (config.logging.logToSheet && config.logging.logSheetId) {
      this._logToSheet(logEntry);
    }
  },

  /**
   * スプレッドシートにログを出力
   * @private
   */
  _logToSheet: function(logEntry) {
    try {
      const config = getConfig();
      const ss = SpreadsheetApp.openById(config.logging.logSheetId);
      let sheet = ss.getSheetByName('Logs');

      if (!sheet) {
        sheet = ss.insertSheet('Logs');
        sheet.appendRow(['Timestamp', 'Level', 'Message', 'Data']);
        sheet.getRange(1, 1, 1, 4).setFontWeight('bold');
      }

      sheet.appendRow([
        logEntry.timestamp,
        logEntry.level,
        logEntry.message,
        JSON.stringify(logEntry.data || {})
      ]);

      // 古いログを削除 (1000行を超えたら)
      const maxRows = 1000;
      if (sheet.getLastRow() > maxRows + 1) {
        sheet.deleteRows(2, sheet.getLastRow() - maxRows);
      }
    } catch (e) {
      console.error('スプレッドシートへのログ出力に失敗: ' + e.message);
    }
  },

  /**
   * DEBUGレベルのログ
   * @param {string} message - ログメッセージ
   * @param {Object} [data] - 追加データ
   */
  debug: function(message, data) {
    this._log('DEBUG', message, data);
  },

  /**
   * INFOレベルのログ
   * @param {string} message - ログメッセージ
   * @param {Object} [data] - 追加データ
   */
  info: function(message, data) {
    this._log('INFO', message, data);
  },

  /**
   * WARNレベルのログ
   * @param {string} message - ログメッセージ
   * @param {Object} [data] - 追加データ
   */
  warn: function(message, data) {
    this._log('WARN', message, data);
  },

  /**
   * ERRORレベルのログ
   * @param {string} message - ログメッセージ
   * @param {Object} [data] - 追加データ
   */
  error: function(message, data) {
    this._log('ERROR', message, data);
  },

  /**
   * 実行結果のサマリーをログ
   * @param {Object} results - 同期結果オブジェクト
   */
  logSyncSummary: function(results) {
    const summary = {
      duration: results.durationMs ? (results.durationMs / 1000).toFixed(2) + 's' : 'N/A',
      created: results.totalCreated || 0,
      updated: results.totalUpdated || 0,
      deleted: results.totalDeleted || 0,
      errors: results.errors ? results.errors.length : 0,
      calendars: results.calendars ? results.calendars.length : 0
    };

    if (results.errors && results.errors.length > 0) {
      this.warn('同期完了 (エラーあり)', summary);
    } else {
      this.info('同期完了', summary);
    }
  }
};
