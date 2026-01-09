/**
 * EventMapper.gs - Event Transformation
 *
 * ソースイベントを宛先イベント形式に変換
 * プライバシーモード、フィールドマッピング、イベント正規化を処理
 */

const EventMapper = {

  /**
   * ソースイベントを宛先イベントリソースに変換
   * @param {Object} sourceEvent - ソースカレンダーからのイベント (API形式)
   * @param {Object} calendarConfig - ソースカレンダー設定
   * @returns {Object} 宛先カレンダー用イベントリソース
   */
  mapEvent: function(sourceEvent, calendarConfig) {
    const config = getConfig();
    const mapping = config.eventMapping;

    // プライバシーモードに応じた変換
    switch (calendarConfig.privacyMode) {
      case 'busy':
        return this._createBusyEvent(sourceEvent, calendarConfig);
      case 'title-only':
        return this._createTitleOnlyEvent(sourceEvent, calendarConfig);
      case 'full':
      default:
        return this._createFullEvent(sourceEvent, calendarConfig, mapping);
    }
  },

  /**
   * 「予定あり」プレースホルダーイベントを作成
   * @private
   */
  _createBusyEvent: function(sourceEvent, calendarConfig) {
    const prefix = this._getPrefix(calendarConfig);

    return {
      summary: prefix + '予定あり',
      start: sourceEvent.start,
      end: sourceEvent.end,
      transparency: 'opaque',
      visibility: 'private',
      colorId: calendarConfig.colorId,
      extendedProperties: {
        private: {
          sourceCalendarId: calendarConfig.calendarId,
          sourceEventId: sourceEvent.id,
          syncedAt: new Date().toISOString()
        }
      }
    };
  },

  /**
   * タイトルのみのイベントを作成 (説明・場所なし)
   * @private
   */
  _createTitleOnlyEvent: function(sourceEvent, calendarConfig) {
    const prefix = this._getPrefix(calendarConfig);

    return {
      summary: prefix + (sourceEvent.summary || 'タイトルなし'),
      start: sourceEvent.start,
      end: sourceEvent.end,
      transparency: sourceEvent.transparency || 'opaque',
      visibility: 'private',
      colorId: calendarConfig.colorId,
      extendedProperties: {
        private: {
          sourceCalendarId: calendarConfig.calendarId,
          sourceEventId: sourceEvent.id,
          syncedAt: new Date().toISOString()
        }
      }
    };
  },

  /**
   * 完全なイベントコピーを作成
   * @private
   */
  _createFullEvent: function(sourceEvent, calendarConfig, mapping) {
    const prefix = this._getPrefix(calendarConfig);

    const destEvent = {
      summary: prefix + (sourceEvent.summary || 'タイトルなし'),
      start: sourceEvent.start,
      end: sourceEvent.end,
      transparency: sourceEvent.transparency || 'opaque',
      colorId: calendarConfig.colorId,
      extendedProperties: {
        private: {
          sourceCalendarId: calendarConfig.calendarId,
          sourceEventId: sourceEvent.id,
          syncedAt: new Date().toISOString()
        }
      }
    };

    // オプションのフィールドマッピング
    if (mapping.copyDescription && sourceEvent.description) {
      destEvent.description = sourceEvent.description;
    }

    if (mapping.copyLocation && sourceEvent.location) {
      destEvent.location = sourceEvent.location;
    }

    if (mapping.setAsPrivate) {
      destEvent.visibility = 'private';
    }

    // 繰り返しイベントの処理
    if (sourceEvent.recurrence) {
      destEvent.recurrence = sourceEvent.recurrence;
    }

    return destEvent;
  },

  /**
   * カレンダーラベルからプレフィックスを生成
   * @private
   */
  _getPrefix: function(calendarConfig) {
    const config = getConfig();
    if (!config.eventMapping.prefixFormat) return '';
    return config.eventMapping.prefixFormat.replace('{label}', calendarConfig.label);
  },

  /**
   * 2つのイベントに意味のある差異があるかチェック
   * @param {Object} sourceEvent - ソースイベント
   * @param {Object} destEvent - 既存の宛先イベント
   * @param {Object} calendarConfig - カレンダー設定
   * @returns {boolean} 差異があり更新が必要な場合true
   */
  hasChanges: function(sourceEvent, destEvent, calendarConfig) {
    const mapped = this.mapEvent(sourceEvent, calendarConfig);

    // 主要フィールドの比較
    if (mapped.summary !== destEvent.summary) return true;

    // 開始時刻の比較
    const sourceStart = mapped.start.dateTime || mapped.start.date;
    const destStart = destEvent.start.dateTime || destEvent.start.date;
    if (sourceStart !== destStart) return true;

    // 終了時刻の比較
    const sourceEnd = mapped.end.dateTime || mapped.end.date;
    const destEnd = destEvent.end.dateTime || destEvent.end.date;
    if (sourceEnd !== destEnd) return true;

    // フルプライバシーモードの場合、オプションフィールドも比較
    if (calendarConfig.privacyMode === 'full') {
      if (mapped.description !== destEvent.description) return true;
      if (mapped.location !== destEvent.location) return true;
    }

    return false;
  },

  /**
   * イベントがフィルタリング条件に合致するかチェック
   * @param {Object} event - チェックするイベント
   * @param {Object} syncOptions - 同期オプション
   * @returns {boolean} イベントを同期すべき場合true
   */
  shouldSync: function(event, syncOptions) {
    // キャンセルされたイベントは別途処理
    if (event.status === 'cancelled') return true;

    // 終日イベントのフィルタリング
    if (!syncOptions.includeAllDayEvents && event.start.date) {
      return false;
    }

    // 辞退したイベントのフィルタリング
    if (!syncOptions.includeDeclinedEvents) {
      const selfAttendee = (event.attendees || []).find(a => a.self === true);
      if (selfAttendee && selfAttendee.responseStatus === 'declined') {
        return false;
      }
    }

    return true;
  }
};
