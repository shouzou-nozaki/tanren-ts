# アーキテクチャ / 設計ノート

tanren を今後運用・拡張していくための設計ドキュメント。コードの構造と、なぜそうなっているか（設計判断と割り切り）をまとめる。

## 1. tanren とは

エンジニア向けの **「壁打ち（対話）＋ 実力解析」CLI**。機能の核は2つ。

- **ask（壁打ち）**: AI コーチと対話する。やり取りは全て保存される。
- **report（解析）**: 溜まった壁打ち履歴を「能力軸（Axis）」で AI に採点・講評させ、レポートとして残す。

report は前回レポートを踏まえて成長を測る（差分評価）ため、単なるチャットではなく「継続的に実力を可視化する」点が肝。さらに、**ask も report も「どの能力軸に取り組むか」を都度1つ選ぶ**ようになっており、会話・コーチの記憶・解析がすべて**その軸でスコープ**される（後述 §7・§11）。

## 2. 全体アーキテクチャ（ヘキサゴナル）

依存の向きは **常に外 → 内**。内側（core）は外側（端末・AI・ファイル）を一切知らない。

```mermaid
flowchart TB
    subgraph CLI["cli/ — 入出力・端末依存"]
        IDX["index.ts（エントリ）"]
        CON["container.ts（DI）"]
        CMD["commands/*"]
        INP["input.ts / format.ts"]
    end
    subgraph UC["core/usecases/ — 純粋ロジック"]
        CHAT["chat.ts"]
        ANA["analyze.ts"]
        HIS["history.ts"]
    end
    subgraph PORTS["core/ports/ — 抽象（契約だけ）"]
        PA["ProviderAgent"]
        ST["Storage"]
    end
    subgraph ADP["adapters/ — 外界とのつなぎ込み"]
        CL["ai/claude.ts"]
        GM["ai/gemini.ts"]
        YM["storage/yaml.ts"]
        MM["storage/memory.ts"]
    end

    CLI -->|依存| UC
    UC -->|依存| PORTS
    CL -. implements .-> PA
    GM -. implements .-> PA
    YM -. implements .-> ST
    MM -. implements .-> ST
    CON -. injects .-> ADP
```

依存は常に **外 → 内**（`cli → usecases → ports`）。adapters は ports を **implements** し、`container` が起動時に実体を **注入**する。`core/usecases` は `core/ports` の interface しか見ないので、AI もストレージも差し替え自在で、core はモックだけでテストできる。

## 3. ディレクトリ構成

| パス | 役割 |
| --- | --- |
| `src/cli/index.ts` | **エントリポイント**。commander で引数を解釈し、メニュー or 各コマンドへ振る |
| `src/cli/container.ts` | DI コンテナ。storage と provider を組み立てる唯一の場所 |
| `src/cli/commands/*` | 各コマンドの入出力（setup / ask / report / actions / history / **axes**） |
| `src/cli/input.ts` | 壁打ちの複数行入力 reader（§9） |
| `src/cli/format.ts` | 表示整形（リキャップ・日付・軸ラベル解決） |
| `src/core/ports/*` | ポート（`ProviderAgent` / `Storage`） |
| `src/core/usecases/*` | ロジック（`chat` / `analyze` / `history`） |
| `src/core/axes.ts` | デフォルト能力軸 `DEFAULT_AXES` |
| `src/adapters/ai/*` | AI 実装（claude / gemini）とレジストリ |
| `src/adapters/storage/*` | 保存実装（yaml / memory）とレジストリ |

## 4. ポート（内と外の境界）

### ProviderAgent（`core/ports/ai-provider.ts`）
```ts
interface ProviderAgent {
  capabilities: { readsLocalSource: boolean }  // ローカルのコードを読めるか
  chatStream(systemPrompt, messages, onChunk, signal?): Promise<string>
}
```
「システムプロンプトと会話履歴を渡すと、`onChunk` で逐次返しつつ最終全文を返す」。`signal` で中断（Ctrl+C）対応。`Provider.setup(apiKey?)` が `ProviderAgent` を生成する。

### Storage（`core/ports/storage.ts`）
4つの小さな store の合成。usecase は必要な store だけを型で要求する（最小権限）。

- `SessionStore` … 壁打ちログ（`Session`）
- `ReportStore` … 解析結果（`Report`）
- `AxisStore` … 能力軸（`Axis`）
- `ConfigStore` … 設定（provider 名・APIキー）

`SessionStore` は**焦点軸でスコープされたクエリ**を持つ:
```ts
interface SessionStore {
  getRecentSessions(limit: number, axisKey: string): Session[]  // その軸の直近 limit 件
  getAllSessions(): Session[]                                   // 全件（解析が使う）
  saveSession(messages: Message[], axisKey: string): void       // 焦点軸を必ず記録
}
```
例: `analyze` のシグネチャは `SessionStore & ReportStore & AxisStore` で、ConfigStore は要求しない。何を触るかが型から読める。

## 5. データモデルと永続化

`adapters/storage/yaml.ts` が `~/.tanren/` 配下の YAML に保存する。

| 型 | 中身 | ファイル |
| --- | --- | --- |
| `Session` | `{ id, createdAt, messages[], axisKey }` 1往復 = 1レコード。**`axisKey` でどの焦点軸の会話かを必須記録** | `sessions.yaml` |
| `Report` | `{ id, createdAt, abilities[] }` 解析1回分 | `reports.yaml` |
| `AbilityReport` | `{ axis, summary, nextActions[], score }` 軸1つの評価 | （Report 内） |
| `Axis` | `{ key, label, focus }` 能力軸の定義 | `axes.yaml` |
| Config | `provider` 名 / `<name>_api_key` | `config.yaml` |

`Session.axisKey`・`AbilityReport.axis` はいずれも**軸の `key`**（label ではなく）を持つ。`key` は内部 ID として安定なので、`label`/`focus` を後から編集しても**履歴の照合が途切れない**（§7 axes）。表示時のラベルは `format.ts` の `resolveAxisLabel` が `key → 現在の label` で引く。

YAML 層の堅さ（壊さない設計）:

- **読み込みは zod で検証**。壊れていたら例外で中止し、ファイルを温存（上書きで潰さない）。
- **書き込みは temp ファイル（PID 入り）に書いて `rename`**（アトミック）。途中で落ちても本体は壊れない。
- `id` は「最後の id + 1」で連番採番。
- `Axis` は未設定なら `core/axes.ts` の `DEFAULT_AXES`（技術的判断・設計・コードレビューの**3軸**）にフォールバック。

### 並行書き込みの割り切り（既知・未対応）
保存はすべて **read-modify-write**（全件読む→足す→全体を書き戻す）で、**ロックを持たない**。

- **破損はしない**: temp＋アトミック rename と zod 検証で、半端な内容や壊れた YAML を読むことは無い。
- **ロスト・アップデートはありうる**: 同じ tanren を**2プロセス同時起動**すると、後に書いた方が勝ち、片方の追記が消える。1人・1ターミナルなら実質問題ないため YAGNI で許容。困ったらファイルロックを read-modify-write に巻く。

## 6. DI コンテナと配線

`cli/container.ts` が内と外を結ぶ唯一の場所。

```ts
buildContainer('yaml') → {
  storage,                                          // YamlStorage の実体
  buildProvider: () => resolveProvider(storage),    // config を見て Claude/Gemini を組む（遅延）
}
```

`resolveProvider`（`adapters/ai/registry.ts`）は config の `provider` 名を読み、`requiresApiKey` なら APIキーも取り、対応する `Provider.setup()` で `ProviderAgent` を作る。`buildProvider` を**サンク（遅延関数）**にしてあるのは、**APIキー未設定でも起動だけは通し、AI が要るコマンドの実行時に初めて解決**させるため（未設定で `setup` すら起動できない鶏卵を避ける）。

`cli/index.ts` がエントリ:
- 引数なし `tanren` → `runMenu()`（@inquirer の select で対話メニューをループ。項目: 壁打ち / 実力解析 / 次のアクション / レポート履歴 / **能力を設定** / セットアップ / 終了）
- 引数あり `tanren ask` 等 → `oneShot()`（一発実行して終了）
- 両方とも `dispatch(command)` に集約。`ensureConfigured()` が未設定時に setup へ誘導する（AI 不要なコマンド＝actions/history/axes は素通り）。

## 7. ユーザーフロー

### setup（初回）
プロバイダ選択（Gemini/Claude）→ 必要なら APIキー入力 → `config.yaml` 保存 → `axes.yaml` 初期化。Claude は「Claude Code のログインを使う」ので APIキー不要、Gemini は必要。この差は `Provider.requiresApiKey` で表現。

### axes（能力を設定）— `commands/axes.ts`
伸ばす能力軸をアプリ内で編集する。`tanren axes` ／ メニュー「🎯 能力を設定」。
- 冒頭で**現在の軸を一覧表示**（label＋focus）してから操作を選ばせる。
- **メニュー駆動の CRUD ループ**: `軸を編集する / 軸を追加する / 軸を削除する / デフォルトに戻す / 保存して終了`。
- **作業用コピーを編集し、「保存して終了」を選んだときだけ `saveAxes`**。Ctrl+C は保存せず離脱（＝操作前の状態のまま）。
- 編集は `key` を維持（履歴継続）、追加は新規 `key` を生成（履歴まっさら）、上限 5。全消しで保存するとデフォルトに戻る。

### ask（壁打ち）— `commands/ask.ts` + `usecases/chat.ts`
1. **今回フォーカスする軸を1つ選ぶ**（`selectFocusAxis`、軸が1つなら省略）。
2. **その軸の直近 `RECENT_TURNS`（=5）往復**を `getRecentSessions(RECENT_TURNS, focusAxis.key)` で取り、`formatRecap` で表示（見出しに軸名）。前回その軸で何を話したかが見える。
3. ループ: `readMultilineInput('あなた: ')` で入力 → `chat(userInput, provider, storage, focusAxis, onChunk, signal)`。
4. `chat()` は**同じ軸の直近5往復**を履歴に並べ、`buildSystemPrompt(axis)`（その1軸の focus）を system に、ユーザー入力を末尾に付けて `chatStream` を呼ぶ。応答後、1往復を**焦点軸の key 付きで** Session 保存。

ポイント:
- **コーチの記憶も軸スコープ**。設計にフォーカスすれば前回の設計の会話だけを覚え、別軸の雑談は引かない。**画面の recap ＝ コーチが実際に覚えている範囲**（同じ窓を見る）。
- 中断は `AbortController`。Ctrl+C 1回で応答中断、2回で `exit(130)`。

### report（解析）— `commands/report.ts` + `usecases/analyze.ts`
1. **解析する軸を1つ選ぶ**（`selectAxis`）→ `analyze(..., [targetAxis])` に渡す。
2. `analyze` は軸ごとに、**その軸のセッションだけ**（`sessions.filter(s => s.axisKey === axis.key)`）を対象にし、さらに **`latestReportWithAxis` で辿った「その軸の前回解析」以降**に絞る（最大 `SESSION_LIMIT`=20 件）。新規材料が無い軸はスキップ（`onAxisSkip`）。
3. その軸専門のメンターとして評価させる。前回の同軸サマリと前回の「次のアクション」をプロンプトに入れ、**取り組めたか・成長したか**を評価させる。
4. 出力を `parseScore`（末尾「スコア: N/5」）と `parseNextActions`（「次のアクション:」以降の箇条書き）で**構造化データに落とす**。採点できなければ前回点を据え置き。
5. `saveReport`。1軸も解析できなければ「解析できる壁打ちがありません。対象の能力で tanren ask を…」で中止。

> **軸スコープの一貫性**: recap・コーチ文脈・解析がすべて「その軸の会話だけ」を見る。設計の採点にセキュリティの会話が混ざらない。

### actions — `commands/actions.ts`
最新レポートの `nextActions` だけを表示。新しい状態は持たず、レポートから導出するだけ（表示で導出できるものは状態を持たない）。

### history — `commands/history.ts` + `usecases/history.ts`
- 引数なし: レポート一覧 ＋ 軸ごとのスコア推移（`3 → 4 → 4`）。レポートに無い軸は `・`。
- `history <id>`: そのレポート詳細を、前回との差分（`★★★★☆ 4/5 (前回 3 → +1)`）付きで表示。

## 8. プロバイダ抽象とコーチのツール権限

両プロバイダとも `ProviderAgent` を実装するが中身は別物。

- **claude.ts**: `@anthropic-ai/claude-agent-sdk` の `query` を使う。`readsLocalSource: true`。ask で渡されたパスを実際に読んで議論できる。
- **gemini.ts**: APIキーで Google のモデルを叩く。`readsLocalSource: false`（ローカルは読まない）。

usecase はこの違いを知らない。`capabilities.readsLocalSource` を見て ask の案内文だけ変える（能力差を capability フラグで表現し、分岐を最小化）。

### コーチのツール権限（claude.ts）— 重要な運用方針
コーチは **読み取り専用** に閉じてある。Agent SDK の3つの仕組みを役割分担させている。

| 仕組み | 設定 |
| --- | --- |
| `allowedTools` | `Read / Grep / Glob`（無条件で自動許可） |
| `disallowedTools` | `Write / Edit / NotebookEdit`（文脈から除外。編集ツールの存在すら見せない） |
| `canUseTool` | Bash を関門で吟味し、**読み取り専用 git のときだけ許可** |

`isReadonlyGit` の安全性は二段構え:
1. **メタ文字の構文ブロック**: `; & | < > \` $ ( )` 改行 を含めば即拒否。`git log; rm -rf` のような連結・リダイレクト・コマンド置換を不可能にする。
2. **allowlist 方式**: 許可する git サブコマンド（diff/log/show/status/blame など）だけ true。未知のサブコマンドは自動で安全側（拒否）に倒れる。

さらに `TOOL_HINT`（プロンプト）で「実行できるのは Read/Grep/Glob と読み取り専用 git だけ。編集・git 書き込み・tsc/npm/テスト/ビルドは実行できないので、できる前提で提案するな」と明示。**機構（canUseTool）＝実際にブロック / プロンプト（TOOL_HINT）＝そもそも期待させない** の両輪。

設計意図: コーチは壁打ち相手＋実力解析役であって、コードを編集する実行エージェント（Claude Code の領分）ではない。「読む力は増やすが、書き込みは構造的に不可能」を保つ。

## 9. 入力層 input.ts の設計と既知の割り切り

`readMultilineInput` は端末の生入力を自前でパースする層。`@inquirer` の input が「最初の改行で確定」してペーストが切れる問題を避けるため自作した。

操作モデル:
- **Enter（`\r`）= 送信 / Ctrl+J（`\n`）・Shift+Enter = 改行 / ペースト = 改行ごと丸ごと取り込む / Ctrl+C = キャンセル**
- Shift+Enter は Kitty キーボードプロトコル（`\x1b[>1u`）対応端末でのみ CSI-u として届く。非対応端末では Ctrl+J かペーストで改行する。

実装の柱:
- **ブラケットペースト**（`\x1b[?2004h`）で `200~`…`201~` に囲まれたペースト区間を判定。区間内の改行は本文として残す（送信トリガーにしない）。
- **全体再描画**: buffer を正とし、キーのたびに入力欄を丸ごと描き直す（`render()`）。複数行をまたいだ削除・全消しが画面に反映される。`displayWidth`（日本語=幅2）と行折り返しを計算してカーソル位置を求める。
- **CSI-u 解読**（`parseCsiU`）: Kitty 形式で届く Enter/Shift+Enter/Backspace を拾う。

### 既知の割り切り（YAGNI / 意図的に未対応）
- **render() はビューポート内に収まる前提**。buffer が画面下端を超えて端末がスクロールすると、`\x1b[NA`（N行上へ戻る）が画面最上行でクランプし、戻る位置がズレて表示が崩れる。手入力は数行で収まる前提で切ったが、**長文ペーストでは超えうる**。破綻しても buffer の値自体は正しく（submit は正しい文字列を返す）、内容が縮むか次の短い入力で自己修復する。実害が出たら `process.stdout.rows` と描画行数を突き合わせて全画面クリアに切り替える。
- **非対話（パイプ）は 1行 = 1入力**。`\n` で即送信し、複数行を1メッセージにはしない。対話時のブラケットペーストのような「1メッセージの境界」を表す手段が非対話には無いため。

## 10. ビルドと公開フロー

- **ビルド**: tsup（esbuild）で `src/cli/index.ts` → `dist/index.js`（CJS）。先頭に `#!/usr/bin/env node` の banner。`package.json` の `bin.tanren` が `dist/index.js` を指す。
- **バージョン**: `tsup.config.ts` の `define` で `__APP_VERSION__` に `package.json` の version を埋め込む（単一ソース）。dev（tsx）では `typeof` ガードで `0.0.0-dev` にフォールバック。
- **公開**: GitHub Actions が main の push で動き、**package.json の version が npm 上にまだ無いときだけ** publish する。`--provenance` 付き。秘密情報は `TANREN_CICD`。
- **リリース手順**: version を bump → PR → マージ → CI が自動 publish → `npm i -g tanren@latest`。各リリースに version bump が必須（同一 version は publish されない）。

## 11. 設計上の指針（まとめ）

1. **ポート2本（AI / Storage）で内外を遮断** — 差し替え自在、core はテストで完結。
2. **usecase は純粋的**（端末も AI も知らない）— `analyze`/`chat` 単体テストが軽い。
3. **能力軸（Axis）が一級市民** — コーチの掘り下げ観点にも解析の評価軸にも同じものを使い、`tanren axes` でアプリ内編集できる。`key` で履歴を貫く。
4. **焦点軸でスコープを揃える** — ask の選択軸が、recap・コーチの記憶・解析のすべてを「その軸の会話だけ」に絞る。「見えるもの＝コーチが覚えているもの」を不変条件として保つ。
5. **レポートが成長を畳み込む** — 毎回フルログを送らず、軸ごとに「その軸の前回解析以降＋前回サマリ」で差分評価。スコア推移として可視化。
6. **YAML 層は壊れにくい** — zod 検証＋アトミック書き込み＋壊れたら温存。ただし並行書き込み（多重起動）はロスト・アップデートしうる（既知の割り切り）。
7. **コーチは読み取り専用** — 機構（canUseTool/disallowedTools）とプロンプト（TOOL_HINT）の両輪で「読むが書かない」を保証。
8. **API は呼ばれ方の実態に正直に** — 使われない optional / 死に分岐を残さない（例: `chat` は常に1軸なので単一 `Axis`、`saveSession`/`getRecentSessions` は `axisKey` 必須）。
9. **割り切りは言語化して残す** — input.ts のビューポート前提、非対話=1行入力、YAML の並行書き込みなど、YAGNI で切った前提と「いつ崩れるか」を本ドキュメントに明記し、忘れない。
