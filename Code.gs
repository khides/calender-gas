/**
 * Code.gs - Main Entry Points
 *
 * Google Apps Script Calendar Sync
 * 複数のソースカレンダーを単一の宛先カレンダーに同期
 *
 * セットアップ手順:
 * 1. Config.gs でソースカレンダーを設定
 * 2. validateSetup() を実行して権限を付与・検証
 * 3. setupTriggers() を実行してトリガーを設定
 * 4. manualSync() を実行して初回同期
 */

// ============================================================
// メイン同期関数 (トリガーから呼び出される)
// ============================================================

/**
 * メイン同期関数 - トリガーから呼び出される
 */
function runSync() {
  Utils.recordStartTime();

  try {
    const results = SyncEngine.syncAll();

    AppLogger.info('同期完了', {
      duration: Utils.formatDuration(results.durationMs),
      created: results.totalCreated,
      updated: results.totalUpdated,
      deleted: results.totalDeleted,
      errors: results.errors.length
    });

    return results;
  } catch (error) {
    AppLogger.error('同期失敗', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

/**
 * カレンダー変更トリガーハンドラー
 * @param {Object} e - トリガーイベントオブジェクト
 */
function onCalendarChange(e) {
  AppLogger.debug('カレンダー変更検出', {
    calendarId: e.calendarId
  });

  // マッチするカレンダー設定を検索
  const config = getConfig();
  const calendarConfig = config.sourceCalendars.find(
    cal => cal.calendarId === e.calendarId
  );

  if (calendarConfig && calendarConfig.enabled) {
    try {
      SyncEngine.syncCalendar(calendarConfig);
    } catch (error) {
      AppLogger.error('カレンダー変更同期失敗', {
        calendarId: e.calendarId,
        error: error.message
      });
    }
  }
}

// ============================================================
// 手動実行関数 (スクリプトエディタから実行)
// ============================================================

/**
 * 手動同期 - スクリプトエディタから実行
 */
function manualSync() {
  console.log('========================================');
  console.log('       カレンダー同期 開始');
  console.log('========================================\n');

  const results = runSync();

  console.log('\n========================================');
  console.log('       同期結果');
  console.log('========================================');
  console.log('所要時間: ' + Utils.formatDuration(results.durationMs));
  console.log('作成: ' + results.totalCreated + ' イベント');
  console.log('更新: ' + results.totalUpdated + ' イベント');
  console.log('削除: ' + results.totalDeleted + ' イベント');
  console.log('エラー: ' + results.errors.length + ' 件');

  if (results.errors.length > 0) {
    console.log('\n--- エラー詳細 ---');
    results.errors.forEach(err => {
      console.log('  - ' + err.label + ': ' + err.error);
    });
  }

  console.log('\n========================================\n');
}

/**
 * フルシンク強制 - sync tokenをクリア
 */
function forceFullSync() {
  console.log('フルシンクを開始します...\n');
  const results = SyncEngine.forceFullSyncAll();
  console.log('フルシンク完了');
  console.log('作成: ' + results.totalCreated);
  console.log('更新: ' + results.totalUpdated);
  console.log('削除: ' + results.totalDeleted);
}

// ============================================================
// セットアップ関数
// ============================================================

/**
 * トリガーをセットアップ
 */
function setupTriggers() {
  console.log('トリガーをセットアップしています...\n');

  const triggers = Triggers.setup();

  console.log('作成されたトリガー:');
  triggers.forEach(t => {
    if (t.type === 'time-driven') {
      console.log('  - ' + t.handler + ' (' + t.interval + '間隔)');
    } else {
      console.log('  - ' + t.handler + ' (カレンダー: ' + t.label + ')');
    }
  });

  console.log('\nトリガーのセットアップが完了しました');
}

/**
 * 全トリガーをクリア
 */
function clearTriggers() {
  Triggers.clearAll();
  console.log('全てのトリガーをクリアしました');
}

// ============================================================
// 検証・状態確認関数
// ============================================================

/**
 * 設定とカレンダーアクセスを検証
 */
function validateSetup() {
  console.log('========================================');
  console.log('       セットアップ検証');
  console.log('========================================\n');

  const result = Utils.validateSetup();

  // カレンダー状態を表示
  console.log('--- カレンダー ---\n');

  result.calendars.forEach(cal => {
    const status = cal.accessible ? '✓ アクセス可能' : '✗ アクセス不可';
    const enabled = cal.enabled !== undefined ? (cal.enabled ? '' : ' (無効)') : '';

    if (cal.type === 'destination') {
      console.log('宛先: ' + cal.id);
      console.log('  状態: ' + status);
    } else {
      console.log('ソース: ' + (cal.label || cal.id) + enabled);
      console.log('  ID: ' + cal.id);
      console.log('  状態: ' + status);
    }
    console.log('');
  });

  // 問題があれば表示
  if (result.issues.length > 0) {
    console.log('--- 問題 ---\n');
    result.issues.forEach(issue => {
      console.log('  ⚠ ' + issue);
    });
    console.log('');
  }

  // サマリー
  console.log('========================================');
  if (result.valid) {
    console.log('✓ 検証成功 - 同期の準備ができています');
    console.log('\n次のステップ:');
    console.log('  1. setupTriggers() を実行してトリガーを設定');
    console.log('  2. manualSync() を実行して初回同期');
  } else {
    console.log('✗ 検証失敗 - 上記の問題を解決してください');
    console.log('\nヒント:');
    console.log('  - ソースカレンダーがAccount Aと共有されているか確認');
    console.log('  - Config.gs のカレンダーIDが正しいか確認');
  }
  console.log('========================================\n');

  return result.valid;
}

/**
 * 同期状態を表示
 */
function showStatus() {
  console.log('========================================');
  console.log('       同期状態');
  console.log('========================================\n');

  const status = Utils.getStatus();

  // 最終同期
  console.log('最終同期: ' + (status.lastSync
    ? Utils.formatDateJST(status.lastSync)
    : '未実行'));
  console.log('');

  // カレンダー状態
  console.log('--- カレンダー ---\n');
  status.calendars.forEach(cal => {
    const enabled = cal.enabled ? '' : ' [無効]';
    const accessible = cal.accessible ? '' : ' [アクセス不可]';
    console.log(cal.label + ' (' + cal.calendarId + ')' + enabled + accessible);
    console.log('  プライバシー: ' + cal.privacyMode);
    console.log('  sync token: ' + (cal.hasSyncToken ? 'あり' : 'なし (フルシンクが必要)'));
    console.log('  同期済みイベント: ' + cal.syncedEventCount);
    console.log('');
  });

  // トリガー
  console.log('--- トリガー ---\n');
  console.log('合計: ' + status.triggers.length + ' 個');
  status.triggers.forEach(t => {
    console.log('  - ' + t.handler + ' (' + t.type + ')');
  });
  console.log('');

  // ストレージ
  console.log('--- ストレージ ---\n');
  console.log('sync token: ' + status.storage.syncTokenCount + ' 個');
  console.log('イベントマッピング: ' + status.storage.totalMappedEvents + ' 個');
  console.log('');

  console.log('========================================\n');
}

// ============================================================
// リセット・クリーンアップ関数
// ============================================================

/**
 * 全ての同期データをリセット
 */
function resetAllData() {
  console.log('========================================');
  console.log('       データリセット');
  console.log('========================================\n');

  console.log('以下のデータを削除します:');
  console.log('  - 全てのsync token');
  console.log('  - 全てのイベントマッピング');
  console.log('  - 全てのトリガー');
  console.log('');

  // 確認なしで実行 (GASではUIが常に利用可能とは限らない)
  StorageManager.clearAllSyncData();
  Triggers.clearAll();

  console.log('✓ 全ての同期データがリセットされました');
  console.log('');
  console.log('次のステップ:');
  console.log('  1. validateSetup() を実行して設定を確認');
  console.log('  2. setupTriggers() を実行してトリガーを再設定');
  console.log('  3. manualSync() を実行して再同期');
  console.log('========================================\n');
}

/**
 * 宛先カレンダーから同期されたイベントを全て削除
 * ※注意: この操作は取り消せません
 */
function removeAllSyncedEvents() {
  console.log('========================================');
  console.log('       同期イベント削除');
  console.log('========================================\n');

  const config = getConfig();
  let totalDeleted = 0;

  config.sourceCalendars.forEach(cal => {
    const eventMap = StorageManager.getEventMap(cal.calendarId);
    const destIds = Object.values(eventMap);

    console.log(cal.label + ': ' + destIds.length + ' イベント');

    destIds.forEach(destId => {
      try {
        Calendar.Events.remove(config.destinationCalendarId, destId);
        totalDeleted++;
      } catch (error) {
        // 既に削除されている可能性
        if (!error.message.includes('404')) {
          console.log('  削除失敗: ' + destId + ' - ' + error.message);
        }
      }
    });

    // マッピングをクリア
    StorageManager.setEventMap(cal.calendarId, {});
    StorageManager.clearSyncToken(cal.calendarId);
  });

  console.log('');
  console.log('✓ ' + totalDeleted + ' イベントを削除しました');
  console.log('========================================\n');
}

// ============================================================
// デバッグ関数
// ============================================================

/**
 * 現在の設定を表示 (デバッグ用)
 */
function showConfig() {
  const config = getConfig();
  console.log('現在の設定:');
  console.log(JSON.stringify(config, null, 2));
}

/**
 * ストレージ統計を表示 (デバッグ用)
 */
function showStorageStats() {
  const stats = StorageManager.getStorageStats();
  console.log('ストレージ統計:');
  console.log(JSON.stringify(stats, null, 2));
}
