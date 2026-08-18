# SSカーブフィッティングアプリ 実装計画

## 1. なぜやるか

引張試験CSVからCAE用硬化カーブを作る工程を、変換根拠とフィッティング結果をグラフで確認できる再現可能な操作へ置き換える。機密性のある試験データを外部送信せず、汎用CSVとLS-DYNA向けカーブをブラウザだけで作成できるようにする。

## 2. 何を変えるか

ソースコードは `app / features / shared` の3層で構成する。`app` はルーティングとレイアウトだけに限定し、`features` は業務機能単位、`shared` は業務機能に依存しない共通資産を配置する。依存方向は `app → features → shared` とし、逆依存と `app` からfeature内部への直接参照をESLintで禁止する。DB・外部API接続を行わないため `external` 層は設けない。

| ファイル | 変更内容 | 種別 |
|---|---|---|
| `frontend/package.json` | Next.js、Tailwind CSS、shadcn/ui、Zustand、数値処理、CSV、グラフ、テストの依存関係とスクリプト | 新規 |
| `frontend/next.config.ts` | EChartsとZRenderのトランスパイル設定 | 新規 |
| `frontend/src/app/layout.tsx` | アプリ共通レイアウトとメタデータ | 新規 |
| `frontend/src/app/page.tsx` | featureの公開APIを呼び出す薄いルート | 新規 |
| `frontend/src/app/globals.css` | 共通スタイルとデザイントークン | 新規 |
| `frontend/src/features/curve-fitting/index.ts` | app層へ公開するfeatureの公開API | 新規 |
| `frontend/src/features/curve-fitting/components/` | ワークベンチ、工程UI、曲線グラフ | 新規 |
| `frontend/src/features/curve-fitting/hooks/` | 工程UIの状態選択、派生表示データ、ブラウザ操作 | 新規 |
| `frontend/src/features/curve-fitting/lib/` | CSV、変換、硬化則、フィッティング、エクスポートの純粋処理 | 新規 |
| `frontend/src/features/curve-fitting/store/` | Zustandによるワークフロー状態と工程別slice | 新規 |
| `frontend/src/features/curve-fitting/types/` | カーブ、単位、材料物性、処理状態の型 | 新規 |
| `frontend/src/features/curve-fitting/constants/` | 描画点数上限、LCINT、エクスポート点配分などの定数 | 新規 |
| `frontend/src/features/curve-fitting/workers/` | 重いフィッティング計算とWorkerクライアント | 新規 |
| `frontend/src/shared/components/ui/` | feature非依存のshadcn/uiプリミティブ | 新規 |
| `frontend/src/shared/lib/` | feature非依存の汎用ユーティリティ | 新規 |
| `frontend/src/**/*.test.ts(x)` | 数式、CSV、状態遷移、UI操作のテスト | 新規 |
| `frontend/e2e/` | アップロードからエクスポートまでのE2Eテスト | 新規 |

## 3. どう実装するか

### 3.1 技術選定

実装開始時点で相互互換性のある安定版を固定し、ロックファイルをコミットする。

| 分類 | 採用技術・パッケージ | 判断 |
|---|---|---|
| フレームワーク | Next.js App Router、React、TypeScript | 確定 |
| スタイル | Tailwind CSS、shadcn/ui | 確定 |
| 状態管理 | `zustand` | 確定 |
| グラフ | `echarts`、`echarts-for-react` | 推奨採用 |
| CSV解析 | `papaparse`、`@types/papaparse` | 推奨採用 |
| 非線形最小二乗 | `ml-levenberg-marquardt` | 推奨採用 |
| スキーマ検証 | `zod` | 推奨採用 |
| フォーム | `react-hook-form`、`@hookform/resolvers` | 推奨採用 |
| 単体・コンポーネントテスト | `vitest`、`jsdom`、`@testing-library/react`、`@testing-library/jest-dom`、`@testing-library/user-event` | 推奨採用 |
| E2Eテスト | `@playwright/test` | 推奨採用 |

選定理由は次のとおり。

- EChartsは線・点系列、`dataZoom`、brush、Canvas描画、line系列のLTTBサンプリングを提供する。`echarts-for-react` のcoreビルドを使い、初期化、破棄、リサイズ、option更新、イベント接続を共通化する。
- `ReactEChartsCore` と `echarts/core` を組み合わせ、Line、Scatter、Grid、Tooltip、Legend、DataZoom、Brush、CanvasRendererなど使用する機能だけを登録する。Next.jsではクライアントコンポーネントとして読み込み、`next.config.ts` の `transpilePackages` に `echarts` と `zrender` を指定する。
- 大量配列に対する不要なdeep comparisonを避けるため、グラフへ渡す表示用データだけを `useMemo` で安定化する。生データ全点はZustand側に保持し、`echarts-for-react` のpropsへ直接渡さない。
- Papa ParseはローカルCSV、チャンク処理、ストリーミング、Web Worker解析に対応する。大量CSVは `worker: true` と `chunk` を組み合わせる。
- `ml-levenberg-marquardt` は重み、パラメータ上下限、解析ヤコビアン、タイムアウトを指定できる。モデル式と解析ヤコビアンはアプリ側で実装し、複数初期値探索をラップする。
- ZodをCSVメタデータ、材料物性、フィッティング設定、エクスポート設定の共通検証に使い、React Hook Formから同じスキーマを参照する。
- Zustandは工程ごとのsliceとselectorに分割し、元データ配列の更新で無関係なUIが再描画されないようにする。試験データを永続化しないため `persist` middlewareは使用しない。
- フィッティング処理はブラウザ標準のWeb Worker、ダウンロードはBlobとObject URL、コピーはClipboard APIを使う。`comlink`、`file-saver`、`axios`、`decimal.js`、`react-dropzone` は初期版では追加しない。

### 3.2 実装手順

1. **Next.js基盤を作る**  
   TypeScript、App Router、Tailwind CSS、shadcn/ui、Lint、Formatter、Vitest、Testing Library、Playwrightを設定する。データ処理画面はクライアントコンポーネントとし、API RouteやServer ActionへCSVを渡さない。

2. **feature内のモデルと状態遷移を定義する**  
   元データ、正規化データ、変換データ、フィット結果、手動調整結果、エクスポートデータを別の型として管理する。純粋な計算処理は `features/curve-fitting/lib`、型は `types`、Zustandは `store`へ分け、前段の変更時に依存する後段結果を無効化する。

3. **CSVインポートを実装する**  
   Papa ParseをWeb Worker・チャンク処理で使用し、ブラウザ内でCSVを解析する。先頭行のプレビュー、X/Y列割り当て、応力単位、ひずみ表現、入力形式を選択できるようにする。Zodで不正行を収集し、処理を止めるエラーと継続可能な警告を分ける。

4. **変換と検証を実装する**  
   単位正規化、工学値から真値への変換、真全ひずみから弾性ひずみを除く変換を副作用のない関数として実装する。ヤング率、降伏応力、単調性、有限値、塑性ひずみの妥当性を検証する。

5. **グラフ基盤と大量データ対策を実装する**  
   `echarts-for-react` を `curve-fitting` feature内のグラフコンポーネントで包み、点・線、凡例、`dataZoom`、brush、パン、軸、範囲ハンドルを実装する。`option`、`onEvents`、`lazyUpdate`、`replaceMerge`、`autoResize` を共通管理し、必要な命令的操作だけ `getEchartsInstance()` 経由で行う。設定上限を超えた場合は通知し、line系列のLTTBサンプリングで表示系列だけを間引く。元データ配列は別に保持する。

6. **硬化則と自動フィッティングを実装する**  
   3モデルの式と解析ヤコビアン、初期値推定、複数初期値探索、パラメータ境界、ひずみ区間均等重み、適合度を独立モジュールに分離する。`ml-levenberg-marquardt` をWeb Worker内で実行し、進行中、成功、未収束、タイムアウト、キャンセルを画面状態として扱う。

7. **範囲調整と手動パラメータ調整を実装する**  
   グラフのハンドルと数値入力を同期し、選択範囲だけを再フィットできるようにする。自動値と編集中の手動値を分け、手動変更時はカーブと指標だけを再計算する。自動値へ戻すリセットを追加する。

8. **エクスポート工程を実装する**  
   フィット工程とは別に最大真塑性ひずみと20点以上の総点数 `N` を入力する。総分割数 `N - 1` は `0～0.05` に50%、`0.05～0.20` に35%、それ以降に15%を固定配分し、各区間内を等間隔にする。存在しない区間の配分再計算、最大剰余法による整数化、区間境界の挿入、境界重複の除去を決定的な純粋関数として実装する。有効数字6桁へ丸めた後にも重複点を検査する。汎用CSVはBOM付きUTF-8・CRLFでダウンロードし、LS-DYNAは同じ非等間隔点群から `*MAT_024` の `LCSS` 参照向け `*DEFINE_CURVE` ブロックを固定幅で整形して、等幅プレビューとClipboard APIによるコピーを提供する。曲線固有 `LCINT` は `1001` に固定し、1001点の等間隔再離散化をアプリ側でも模擬して元カーブと重ね、最大絶対差・相対差を表示する。

9. **ワークフローを統合する**  
   インポート、変換、フィット、手動調整、エクスポートを段階表示し、未完了の工程へ進めないようにする。再入力時の結果無効化、エラー要約、注意事項、ローカル処理の説明を統合する。

10. **自動テストと性能確認を行う**  
    既知解を持つ合成データ、境界値、大量データ、不正CSVを使って数値処理と画面フローを検証する。初期リリース前に全テスト、型チェック、Lint、ビルドを通す。

### 実装順序と完了条件

| フェーズ | 対象 | 完了条件 |
|---|---|---|
| 1 | 基盤、型、CSV、変換 | 3入力形式を正規化し、変換結果をテストで確認できる |
| 2 | グラフ、範囲操作、大量点群 | 4段階のカーブを表示し、表示だけを間引ける |
| 3 | 3硬化則、自動・手動フィット | 既知パラメータを許容誤差内で復元し、UIから調整できる |
| 4 | CSV、LS-DYNAエクスポート | 条件指定後の曲線をプレビュー、ダウンロード、コピーできる |
| 5 | 統合、E2E、性能、エラー処理 | 主要フローと異常系を自動テストで再現できる |

## 4. 検証方法

- [ ] 工学応力–工学ひずみの既知データが式どおり真応力–真塑性ひずみへ変換される
- [ ] 真応力–真全ひずみから `σ/E` が正しく差し引かれる
- [ ] 真応力–真塑性ひずみ入力では不要な変換が行われない
- [ ] 単位と `%` 表現の切り替えで内部値が一致する
- [ ] `NaN`、無限値、空欄、重複、非単調、負の塑性ひずみを期待どおり検出する
- [ ] Ludwik、Swift、Voceの合成データから既知パラメータを許容誤差内で復元する
- [ ] 範囲変更後に対象点とフィッティング結果が更新される
- [ ] 手動パラメータ変更とリセットが自動結果を破壊せず動作する
- [ ] 描画用間引き前後でフィッティング結果が変化しない
- [ ] 大量点群でも操作中のUI応答を維持し、間引き通知を表示する
- [ ] 最大塑性ひずみと点数がフィット時ではなくエクスポート時だけ要求される
- [ ] 出力総点数、始点、終点が指定どおりになり、`N - 1` 個の分割が3区間へ50%・35%・15%で配分される
- [ ] 出力最大値が `0.05` または `0.20` 未満の場合、存在する区間へ分割数が正しく再配分される
- [ ] 区間境界が一度だけ含まれ、各区間内の点が等間隔かつ全体で厳密な昇順になる
- [ ] すべての出力数値が小数点以下ではなく有効数字6桁になる
- [ ] CSVが `plastic_strain,true_stress`、BOM付きUTF-8、CRLFで生成される
- [ ] LS-DYNAプレビューのX/Y値、LCID、固定項目、固定幅、行数、コピー内容が一致する
- [ ] `LCINT=1001` の等間隔再離散化を模擬したカーブと、再離散化前後の最大絶対差・相対差が正しく表示される
- [ ] アップロードからCSVダウンロードおよびLS-DYNAコピーまでのE2Eテストが通る
- [ ] CSV内容を送信するネットワークリクエストが発生しない
- [ ] `lint`、型チェック、単体・コンポーネント・E2Eテスト、production buildがすべて通る

## 5. リスク・注意点

- 工学値からの単純な真応力変換はネッキング後に成立しない。対象範囲の警告を明確にし、補正済みデータは真値入力として扱う。
- 真応力入力だけではネッキング点を自動判定できないため、ユーザーの範囲確認を省略しない。
- 硬化則の名称と式には流儀の差がある。採用式をUI、コード、テスト、文書で一貫させる。
- 非線形最適化は初期値とパラメータ境界に依存する。複数初期値、収束診断、既知解テストを用意する。
- 点群の間引きを計算用データへ混入させると結果が変わる。表示データと解析データを型とモジュールで分離する。
- エクスポート先のひずみが実測範囲を超える場合は外挿になる。実測最大値を超えた領域をグラフで区別し、警告する。
- 固定配分の端数処理を誤ると、出力総点数の不足や境界重複が起こる。最大剰余法を使い、総点数と厳密な昇順をテストする。
- LS-DYNAの単位系はユーザーのモデル全体に依存し、`*DEFINE_CURVE` 単体では材料モデルとの互換性を保証できない。単位とLCID参照の注意を表示する。
- 曲線固有 `LCINT=1001` は解像度を確保する一方、LS-DYNA R16より前では多数のカーブを持つモデルのメモリ使用量を増やす可能性がある。固定値の意図と影響をプレビュー付近に明記する。
- 全処理をブラウザで行うため、非常に大きなCSVではメモリ制約がある。上限値、キャンセル、エラー回復を設ける。
- フロントエンドの見た目に対する画像比較・目視検証は、本計画には含めない。機能と操作フローは自動テストで検証する。

## 6. 技術選定の参考資料

- [Next.js App Routerで破綻しない設計──本番で使えるアーキテクチャ実践ガイド](https://zenn.dev/yukionishi/articles/cd79e39ea6c172)
- [Next.js: Project Structure](https://nextjs.org/docs/app/getting-started/project-structure)
- [Next.js: Testing](https://nextjs.org/docs/app/guides/testing)
- [Tailwind CSS: Install with Next.js](https://tailwindcss.com/docs/installation/framework-guides/nextjs)
- [shadcn/ui: Documentation](https://ui.shadcn.com/docs)
- [Zustand: Official Repository](https://github.com/pmndrs/zustand)
- [Apache ECharts: Features](https://echarts.apache.org/en/feature.html)
- [echarts-for-react: Official Repository](https://github.com/hustcc/echarts-for-react)
- [Papa Parse: Documentation](https://www.papaparse.com/docs)
- [ml-levenberg-marquardt: Official Repository](https://github.com/mljs/levenberg-marquardt)
- [Zod: Documentation](https://zod.dev/)
