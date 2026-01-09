/**
 * StorageManager.gs - State Persistence
 *
 * PropertiesServiceを使用してsync tokensとevent mappingsを永続化
 */

const StorageManager = {

  KEYS: {
    SYNC_TOKEN_PREFIX: 'syncToken_',
    EVENT_MAP_PREFIX: 'eventMap_',
    LAST_SYNC: 'lastSyncTimestamp',
    SYNC_STATE: 'syncState'
  },

  /**
   * カレンダーのsync tokenを取得
   * @param {string} calendarId - ソースカレンダーID
   * @returns {string|null} sync token または null (フルシンクが必要)
   */
  getSyncToken: function(calendarId) {
    const props = PropertiesService.getScriptProperties();
    return props.getProperty(this.KEYS.SYNC_TOKEN_PREFIX + calendarId);
  },

  /**
   * カレンダーのsync tokenを保存
   * @param {string} calendarId - ソースカレンダーID
   * @param {string} token - APIレスポンスからのsync token
   */
  setSyncToken: function(calendarId, token) {
    const props = PropertiesService.getScriptProperties();
    props.setProperty(this.KEYS.SYNC_TOKEN_PREFIX + calendarId, token);
  },

  /**
   * sync tokenをクリア (フルシンクをトリガー)
   * @param {string} calendarId - ソースカレンダーID
   */
  clearSyncToken: function(calendarId) {
    const props = PropertiesService.getScriptProperties();
    props.deleteProperty(this.KEYS.SYNC_TOKEN_PREFIX + calendarId);
  },

  /**
   * イベントIDマッピングを取得 (ソースイベントID → 宛先イベントID)
   * @param {string} calendarId - ソースカレンダーID
   * @returns {Object} ソースから宛先へのイベントIDマップ
   */
  getEventMap: function(calendarId) {
    const props = PropertiesService.getScriptProperties();
    const mapStr = props.getProperty(this.KEYS.EVENT_MAP_PREFIX + calendarId);
    return mapStr ? JSON.parse(mapStr) : {};
  },

  /**
   * イベントIDマッピングを保存
   * @param {string} calendarId - ソースカレンダーID
   * @param {Object} eventMap - ソースから宛先へのイベントIDマップ
   */
  setEventMap: function(calendarId, eventMap) {
    const props = PropertiesService.getScriptProperties();
    props.setProperty(
      this.KEYS.EVENT_MAP_PREFIX + calendarId,
      JSON.stringify(eventMap)
    );
  },

  /**
   * 単一のイベントマッピングを追加
   * @param {string} calendarId - ソースカレンダーID
   * @param {string} sourceEventId - ソースイベントID
   * @param {string} destEventId - 宛先イベントID
   */
  addEventMapping: function(calendarId, sourceEventId, destEventId) {
    const eventMap = this.getEventMap(calendarId);
    eventMap[sourceEventId] = destEventId;
    this.setEventMap(calendarId, eventMap);
  },

  /**
   * イベントマッピングを削除
   * @param {string} calendarId - ソースカレンダーID
   * @param {string} sourceEventId - ソースイベントID
   */
  removeEventMapping: function(calendarId, sourceEventId) {
    const eventMap = this.getEventMap(calendarId);
    delete eventMap[sourceEventId];
    this.setEventMap(calendarId, eventMap);
  },

  /**
   * ソースイベントに対応する宛先イベントIDを取得
   * @param {string} calendarId - ソースカレンダーID
   * @param {string} sourceEventId - ソースイベントID
   * @returns {string|null} 宛先イベントID または null
   */
  getDestinationEventId: function(calendarId, sourceEventId) {
    const eventMap = this.getEventMap(calendarId);
    return eventMap[sourceEventId] || null;
  },

  /**
   * 最終同期タイムスタンプを更新
   */
  updateLastSync: function() {
    const props = PropertiesService.getScriptProperties();
    props.setProperty(this.KEYS.LAST_SYNC, new Date().toISOString());
  },

  /**
   * 最終同期タイムスタンプを取得
   * @returns {Date|null}
   */
  getLastSync: function() {
    const props = PropertiesService.getScriptProperties();
    const timestamp = props.getProperty(this.KEYS.LAST_SYNC);
    return timestamp ? new Date(timestamp) : null;
  },

  /**
   * 全ての同期データをクリア (フレッシュスタート用)
   */
  clearAllSyncData: function() {
    const props = PropertiesService.getScriptProperties();
    const allProps = props.getProperties();

    Object.keys(allProps).forEach(key => {
      if (key.startsWith(this.KEYS.SYNC_TOKEN_PREFIX) ||
          key.startsWith(this.KEYS.EVENT_MAP_PREFIX)) {
        props.deleteProperty(key);
      }
    });

    props.deleteProperty(this.KEYS.LAST_SYNC);
    AppLogger.info('全ての同期データをクリアしました');
  },

  /**
   * ストレージ使用量を取得 (デバッグ用)
   * @returns {Object} ストレージ統計
   */
  getStorageStats: function() {
    const props = PropertiesService.getScriptProperties();
    const allProps = props.getProperties();

    let syncTokenCount = 0;
    let eventMapCount = 0;
    let totalEvents = 0;

    Object.keys(allProps).forEach(key => {
      if (key.startsWith(this.KEYS.SYNC_TOKEN_PREFIX)) {
        syncTokenCount++;
      } else if (key.startsWith(this.KEYS.EVENT_MAP_PREFIX)) {
        eventMapCount++;
        try {
          const map = JSON.parse(allProps[key]);
          totalEvents += Object.keys(map).length;
        } catch (e) {
          // ignore parse errors
        }
      }
    });

    return {
      syncTokenCount: syncTokenCount,
      eventMapCount: eventMapCount,
      totalMappedEvents: totalEvents,
      lastSync: this.getLastSync()
    };
  }
};
