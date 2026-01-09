/**
 * Triggers.gs - Trigger Management
 *
 * Time-drivenトリガーとCalendarトリガーの設定・管理
 */

const Triggers = {

  /**
   * 設定に基づいて全てのトリガーをセットアップ
   * @returns {Array} 作成されたトリガー情報
   */
  setup: function() {
    // 既存のトリガーをクリア
    this.clearAll();

    const config = getConfig();
    const createdTriggers = [];

    // Time-drivenトリガーをセットアップ
    const timeTrigger = ScriptApp.newTrigger('runSync')
      .timeBased()
      .everyMinutes(config.triggers.syncIntervalMinutes)
      .create();

    createdTriggers.push({
      id: timeTrigger.getUniqueId(),
      type: 'time-driven',
      handler: 'runSync',
      interval: config.triggers.syncIntervalMinutes + '分'
    });

    AppLogger.info('Time-drivenトリガー作成', {
      interval: config.triggers.syncIntervalMinutes + '分'
    });

    // Calendarトリガーをセットアップ (有効な場合)
    if (config.triggers.useCalendarTriggers) {
      config.sourceCalendars.forEach(cal => {
        if (cal.enabled) {
          try {
            const calTrigger = ScriptApp.newTrigger('onCalendarChange')
              .forUserCalendar(cal.calendarId)
              .onEventUpdated()
              .create();

            createdTriggers.push({
              id: calTrigger.getUniqueId(),
              type: 'calendar',
              handler: 'onCalendarChange',
              calendarId: cal.calendarId,
              label: cal.label
            });

            AppLogger.info('Calendarトリガー作成', {
              calendarId: cal.calendarId,
              label: cal.label
            });
          } catch (error) {
            AppLogger.warn('Calendarトリガー作成失敗', {
              calendarId: cal.calendarId,
              label: cal.label,
              error: error.message
            });
          }
        }
      });
    }

    return createdTriggers;
  },

  /**
   * このスクリプトの全てのトリガーをクリア
   */
  clearAll: function() {
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(trigger => {
      ScriptApp.deleteTrigger(trigger);
    });
    AppLogger.info('全トリガーをクリア', { count: triggers.length });
  },

  /**
   * 現在のトリガーをリスト
   * @returns {Array} トリガー情報
   */
  list: function() {
    const triggers = ScriptApp.getProjectTriggers();
    return triggers.map(trigger => ({
      id: trigger.getUniqueId(),
      type: trigger.getEventType().toString(),
      handler: trigger.getHandlerFunction(),
      source: trigger.getTriggerSource().toString()
    }));
  },

  /**
   * 特定のハンドラーのトリガーを削除
   * @param {string} handlerName - ハンドラー関数名
   */
  removeByHandler: function(handlerName) {
    const triggers = ScriptApp.getProjectTriggers();
    let removed = 0;

    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === handlerName) {
        ScriptApp.deleteTrigger(trigger);
        removed++;
      }
    });

    AppLogger.info('トリガー削除', { handler: handlerName, count: removed });
    return removed;
  },

  /**
   * トリガーが正しくセットアップされているか確認
   * @returns {Object} 検証結果
   */
  validate: function() {
    const config = getConfig();
    const triggers = this.list();

    const result = {
      valid: true,
      issues: [],
      triggers: triggers
    };

    // Time-drivenトリガーをチェック
    const hasTimeTrigger = triggers.some(
      t => t.handler === 'runSync' && t.type.includes('CLOCK')
    );

    if (!hasTimeTrigger) {
      result.valid = false;
      result.issues.push('Time-drivenトリガー (runSync) が見つかりません');
    }

    // Calendarトリガーをチェック (有効な場合)
    if (config.triggers.useCalendarTriggers) {
      const calendarTriggers = triggers.filter(
        t => t.handler === 'onCalendarChange'
      );

      const enabledCalendars = config.sourceCalendars.filter(c => c.enabled);

      if (calendarTriggers.length < enabledCalendars.length) {
        result.issues.push(
          'Calendarトリガーが不足しています: ' +
          calendarTriggers.length + '/' + enabledCalendars.length
        );
      }
    }

    return result;
  }
};
