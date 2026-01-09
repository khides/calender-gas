/**
 * SyncEngine.gs - Core Synchronization Logic
 *
 * Advanced Calendar APIを使用した増分同期
 * ページネーション、エラー回復を処理
 */

const SyncEngine = {

  /**
   * 全ての有効なソースカレンダーを宛先に同期
   * @returns {Object} 同期結果サマリー
   */
  syncAll: function() {
    const config = getConfig();
    const results = {
      startTime: new Date(),
      calendars: [],
      totalCreated: 0,
      totalUpdated: 0,
      totalDeleted: 0,
      errors: []
    };

    config.sourceCalendars.forEach(calendarConfig => {
      if (!calendarConfig.enabled) return;

      try {
        const calendarResult = this.syncCalendar(calendarConfig);
        results.calendars.push(calendarResult);
        results.totalCreated += calendarResult.created;
        results.totalUpdated += calendarResult.updated;
        results.totalDeleted += calendarResult.deleted;
      } catch (error) {
        const errorInfo = {
          calendarId: calendarConfig.calendarId,
          label: calendarConfig.label,
          error: error.message,
          stack: error.stack
        };
        results.errors.push(errorInfo);
        AppLogger.error('カレンダー同期失敗', errorInfo);
      }
    });

    results.endTime = new Date();
    results.durationMs = results.endTime - results.startTime;

    StorageManager.updateLastSync();
    AppLogger.logSyncSummary(results);

    return results;
  },

  /**
   * 単一のソースカレンダーを同期
   * @param {Object} calendarConfig - カレンダー設定
   * @returns {Object} このカレンダーの同期結果
   */
  syncCalendar: function(calendarConfig) {
    const config = getConfig();
    const destCalendarId = config.destinationCalendarId;

    const result = {
      calendarId: calendarConfig.calendarId,
      label: calendarConfig.label,
      created: 0,
      updated: 0,
      deleted: 0,
      fullSync: false
    };

    // sync tokenを取得 (null = フルシンク)
    let syncToken = StorageManager.getSyncToken(calendarConfig.calendarId);
    let pageToken = null;

    // API呼び出しの基本オプション
    const baseOptions = {
      maxResults: config.syncOptions.batchSize,
      singleEvents: true,
      showDeleted: true
    };

    // フルシンクの場合、時間範囲を設定
    if (!syncToken) {
      result.fullSync = true;
      const now = new Date();
      const timeMin = new Date(now);
      timeMin.setDate(timeMin.getDate() - config.syncOptions.syncPastDays);
      const timeMax = new Date(now);
      timeMax.setDate(timeMax.getDate() + config.syncOptions.syncWindowDays);

      baseOptions.timeMin = timeMin.toISOString();
      baseOptions.timeMax = timeMax.toISOString();

      AppLogger.info('フルシンク開始', {
        calendarId: calendarConfig.calendarId,
        label: calendarConfig.label,
        timeMin: baseOptions.timeMin,
        timeMax: baseOptions.timeMax
      });
    } else {
      AppLogger.info('増分シンク開始', {
        calendarId: calendarConfig.calendarId,
        label: calendarConfig.label
      });
    }

    // ページネーションでイベント取得
    do {
      const options = { ...baseOptions };
      if (syncToken && !result.fullSync) {
        options.syncToken = syncToken;
      }
      if (pageToken) {
        options.pageToken = pageToken;
      }

      let events;
      try {
        events = Calendar.Events.list(calendarConfig.calendarId, options);
      } catch (error) {
        // 410 Gone - sync token無効化を処理
        if (error.message.includes('Sync token') ||
            error.message.includes('410') ||
            error.message.includes('fullSyncRequired')) {
          AppLogger.warn('sync token無効化、フルシンク実行', {
            calendarId: calendarConfig.calendarId
          });
          StorageManager.clearSyncToken(calendarConfig.calendarId);
          return this.syncCalendar(calendarConfig); // 再帰的にフルシンク
        }
        throw error;
      }

      // イベントを処理
      if (events.items && events.items.length > 0) {
        events.items.forEach(event => {
          const eventResult = this._processEvent(
            event,
            calendarConfig,
            destCalendarId
          );
          result.created += eventResult.created ? 1 : 0;
          result.updated += eventResult.updated ? 1 : 0;
          result.deleted += eventResult.deleted ? 1 : 0;
        });
      }

      pageToken = events.nextPageToken;

      // 最終ページに達したらsync tokenを保存
      if (!pageToken && events.nextSyncToken) {
        StorageManager.setSyncToken(
          calendarConfig.calendarId,
          events.nextSyncToken
        );
      }

    } while (pageToken);

    AppLogger.debug('カレンダー同期完了', result);
    return result;
  },

  /**
   * 単一のイベントを処理 (作成、更新、または削除)
   * @private
   */
  _processEvent: function(sourceEvent, calendarConfig, destCalendarId) {
    const result = { created: false, updated: false, deleted: false };
    const config = getConfig();

    // 既存のマッピングを取得
    const existingDestId = StorageManager.getDestinationEventId(
      calendarConfig.calendarId,
      sourceEvent.id
    );

    // キャンセル/削除されたイベントを処理
    if (sourceEvent.status === 'cancelled') {
      if (existingDestId) {
        try {
          Calendar.Events.remove(destCalendarId, existingDestId);
          StorageManager.removeEventMapping(
            calendarConfig.calendarId,
            sourceEvent.id
          );
          result.deleted = true;
          AppLogger.debug('イベント削除', {
            sourceId: sourceEvent.id,
            destId: existingDestId
          });
        } catch (error) {
          // イベントが既に削除されている可能性
          if (!error.message.includes('404')) {
            throw error;
          }
          StorageManager.removeEventMapping(
            calendarConfig.calendarId,
            sourceEvent.id
          );
        }
      }
      return result;
    }

    // フィルタリング条件をチェック
    if (!EventMapper.shouldSync(sourceEvent, config.syncOptions)) {
      // 以前同期されていた場合は削除
      if (existingDestId) {
        try {
          Calendar.Events.remove(destCalendarId, existingDestId);
          StorageManager.removeEventMapping(
            calendarConfig.calendarId,
            sourceEvent.id
          );
          result.deleted = true;
        } catch (error) {
          if (!error.message.includes('404')) throw error;
        }
      }
      return result;
    }

    // イベントを変換
    const mappedEvent = EventMapper.mapEvent(sourceEvent, calendarConfig);

    // 既存を更新または新規作成
    if (existingDestId) {
      // 更新が必要かチェック
      try {
        const existingEvent = Calendar.Events.get(destCalendarId, existingDestId);

        if (EventMapper.hasChanges(sourceEvent, existingEvent, calendarConfig)) {
          Calendar.Events.patch(mappedEvent, destCalendarId, existingDestId);
          result.updated = true;
          AppLogger.debug('イベント更新', {
            sourceId: sourceEvent.id,
            destId: existingDestId,
            summary: sourceEvent.summary
          });
        }
      } catch (error) {
        if (error.message.includes('404')) {
          // 宛先イベントが削除されていた場合、再作成
          const newEvent = Calendar.Events.insert(mappedEvent, destCalendarId);
          StorageManager.addEventMapping(
            calendarConfig.calendarId,
            sourceEvent.id,
            newEvent.id
          );
          result.created = true;
        } else {
          throw error;
        }
      }
    } else {
      // 新規イベント作成
      const newEvent = Calendar.Events.insert(mappedEvent, destCalendarId);
      StorageManager.addEventMapping(
        calendarConfig.calendarId,
        sourceEvent.id,
        newEvent.id
      );
      result.created = true;
      AppLogger.debug('イベント作成', {
        sourceId: sourceEvent.id,
        destId: newEvent.id,
        summary: sourceEvent.summary
      });
    }

    return result;
  },

  /**
   * 特定のカレンダーのフルシンクを強制
   * @param {string} calendarId - ソースカレンダーID
   */
  forceFullSync: function(calendarId) {
    StorageManager.clearSyncToken(calendarId);

    const config = getConfig();
    const calendarConfig = config.sourceCalendars.find(
      c => c.calendarId === calendarId
    );

    if (calendarConfig) {
      return this.syncCalendar(calendarConfig);
    }

    throw new Error('設定にカレンダーが見つかりません: ' + calendarId);
  },

  /**
   * 全カレンダーのフルシンクを強制
   */
  forceFullSyncAll: function() {
    const config = getConfig();
    config.sourceCalendars.forEach(cal => {
      StorageManager.clearSyncToken(cal.calendarId);
    });
    return this.syncAll();
  }
};
