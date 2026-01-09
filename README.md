# Google Calendar Sync - Google Apps Script

複数のGoogleカレンダーを1つのカレンダーに自動同期するGoogle Apps Scriptソリューション。

## 概要

このスクリプトは、複数のGmailアカウント（B, C, D...）のカレンダー予定を、1つのメインアカウント（A）のカレンダーに自動的に同期します。

```
Account B のカレンダー ──┐
Account C のカレンダー ──┼──▶ Account A のカレンダー
Account D のカレンダー ──┘
```

## 機能

- **自動同期**: 15分間隔の定期同期 + イベント変更時の即座同期
- **増分同期**: sync tokenを使用した効率的な差分同期
- **プライバシーモード**:
  - `busy`: 「予定あり」のみ表示
  - `title-only`: タイトルと時間のみ
  - `full`: 全情報をコピー
- **イベント追跡**: 作成・更新・削除を完全同期
- **カラー分け**: ソースカレンダーごとに色を設定可能

## セットアップ手順 (Clasp版 - 推奨)

Claspを使用すると、コマンドラインから簡単にデプロイできます。

### 前提条件

- Node.js >= 22.0.0
- npm

### Step 1: カレンダーの共有設定

各ソースアカウント（B, C, D...）で以下を実行:

1. [Google Calendar](https://calendar.google.com) にログイン
2. 左サイドバーのカレンダー名にカーソルを合わせ、**⋮** → **設定と共有** をクリック
3. 「特定のユーザーまたはグループと共有する」セクションで **+ ユーザーやグループを追加** をクリック
4. Account A のメールアドレスを入力
5. 権限を **「予定の表示（すべての予定の詳細）」** に設定
6. **送信** をクリック

### Step 2: 事前準備 (Account Aで1回のみ)

1. [Apps Script API](https://script.google.com/home/usersettings) を有効化
2. リポジトリをクローン & 依存関係インストール:

```bash
git clone https://github.com/khides/calender-gas.git
cd calender-gas
npm install
```

3. Googleアカウントでログイン:

```bash
npm run login
```

### Step 3: デプロイ

```bash
# GASプロジェクト作成
npm run create

# コードをプッシュ & Calendar API有効化
npm run deploy

# ブラウザでプロジェクトを開く
npm run open
```

### Step 4: 設定と初回同期 (ブラウザで実施)

1. `clasp open` で開いたApps Scriptエディタで `Config.gs` を編集
2. ソースカレンダーのメールアドレスを設定
3. `validateSetup` を実行 → 権限を承認
4. `setupTriggers` を実行
5. `manualSync` で初回同期

### npm スクリプト一覧

| コマンド | 説明 |
|---------|------|
| `npm run login` | Googleアカウントでログイン |
| `npm run create` | GASプロジェクト作成 |
| `npm run push` | コードをプッシュ |
| `npm run deploy` | プッシュ + API有効化 |
| `npm run open` | ブラウザでエディタを開く |
| `npm run watch` | ファイル変更を監視して自動プッシュ |

---

## セットアップ手順 (手動版)

Claspを使用しない場合の手順です。

### Step 1: カレンダーの共有設定

(Clasp版と同じ)

### Step 2: GASプロジェクトの作成

Account A で以下を実行:

1. [Google Apps Script](https://script.google.com) にアクセス
2. **新しいプロジェクト** をクリック
3. プロジェクト名を「Calendar Sync」に変更

### Step 3: Advanced Calendar APIの有効化

1. 左サイドバーの **サービス** の横にある **+** をクリック
2. **Google Calendar API** を選択
3. **追加** をクリック

### Step 4: ファイルの作成

以下の各ファイルを作成し、対応するコードをコピー:

| ファイル名 | 説明 |
|-----------|------|
| `appsscript.json` | プロジェクトマニフェスト |
| `Config.gs` | 設定ファイル |
| `Code.gs` | メインエントリーポイント |
| `SyncEngine.gs` | 同期エンジン |
| `EventMapper.gs` | イベント変換 |
| `StorageManager.gs` | 状態管理 |
| `Logger.gs` | ログユーティリティ |
| `Triggers.gs` | トリガー管理 |
| `Utils.gs` | ヘルパー関数 |

**注意**: `appsscript.json` を編集するには:
1. **プロジェクトの設定** (歯車アイコン) をクリック
2. **「appsscript.json」マニフェストファイルをエディタで表示する** にチェック
3. 左サイドバーに `appsscript.json` が表示される

### Step 5: 設定の編集

`Config.gs` を開き、以下を編集:

```javascript
sourceCalendars: [
  {
    calendarId: 'your-account-b@gmail.com',  // ← 実際のメールに変更
    label: 'Account B',
    privacyMode: 'busy',
    enabled: true,
    colorId: '1'
  },
  {
    calendarId: 'your-account-c@gmail.com',  // ← 実際のメールに変更
    label: 'Account C',
    privacyMode: 'busy',
    enabled: true,
    colorId: '2'
  }
]
```

### Step 6: 検証と権限付与

1. **関数を選択** ドロップダウンで `validateSetup` を選択
2. **実行** ボタンをクリック
3. 権限の確認画面が表示されたら:
   - **権限を確認** をクリック
   - Googleアカウントを選択
   - **詳細** → **[プロジェクト名] に移動（安全ではないページ）** をクリック
   - **許可** をクリック
4. 実行ログで全てのカレンダーが「アクセス可能」と表示されることを確認

### Step 7: トリガーの設定

1. **関数を選択** ドロップダウンで `setupTriggers` を選択
2. **実行** ボタンをクリック
3. 実行ログでトリガーが作成されたことを確認

### Step 8: 初回同期

1. **関数を選択** ドロップダウンで `manualSync` を選択
2. **実行** ボタンをクリック
3. Account A のカレンダーに予定が同期されていることを確認

## 利用可能な関数

| 関数 | 説明 |
|------|------|
| `manualSync()` | 手動で同期を実行 |
| `validateSetup()` | 設定とアクセス権を検証 |
| `setupTriggers()` | 自動トリガーを設定 |
| `clearTriggers()` | 全トリガーを削除 |
| `showStatus()` | 同期状態を表示 |
| `forceFullSync()` | 全カレンダーのフルシンクを実行 |
| `resetAllData()` | 全ての同期データをリセット |
| `removeAllSyncedEvents()` | 同期されたイベントを全削除 |

## 設定オプション

### プライバシーモード

| モード | 表示内容 |
|--------|---------|
| `busy` | 「[ラベル] 予定あり」のみ表示 |
| `title-only` | タイトルと時間のみ（説明・場所なし） |
| `full` | 全ての情報をコピー |

### カラーID

| ID | 色 |
|----|-----|
| 1 | ラベンダー |
| 2 | セージ |
| 3 | ブドウ |
| 4 | フラミンゴ |
| 5 | バナナ |
| 6 | みかん |
| 7 | ピーコック |
| 8 | グラファイト |
| 9 | ブルーベリー |
| 10 | バジル |
| 11 | トマト |

## クォータと制限

| 項目 | 制限 | 対策 |
|------|------|------|
| イベント作成/日 | 5,000 | 増分同期で最小化 |
| スクリプト実行時間 | 6分 | ページネーション |
| トリガー実行時間/日 | 90分 | sync tokenで効率化 |

## トラブルシューティング

### カレンダーにアクセスできない

1. ソースアカウントでカレンダーが正しく共有されているか確認
2. Account A がカレンダーを購読しているか確認（Calendar > 他のカレンダー > 購読）
3. `Config.gs` のカレンダーIDが正しいか確認

### 同期が動作しない

1. `showStatus()` を実行して状態を確認
2. トリガーが設定されているか確認
3. 実行ログでエラーを確認

### sync tokenエラー

```
sync token無効化、フルシンク実行
```

これは正常な動作です。GoogleがトークンをリセットしたためスクリプトがフルシンクにフォールバックしたことをUP示します。

## ライセンス

MIT License

## 参考資料

- [Calendar Service | Apps Script](https://developers.google.com/apps-script/reference/calendar)
- [Advanced Calendar Service](https://developers.google.com/apps-script/advanced/calendar)
- [Calendar Sync Tokens](https://developers.google.com/workspace/calendar/api/guides/sync)
