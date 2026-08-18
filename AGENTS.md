# Project: Material Curve Fitter

Next.js 16 App Router + React 19 + TypeScriptの、金属材料SSカーブフィッティングアプリです。
引張試験CSVを真応力・真塑性ひずみへ変換し、Ludwik・Swift・Voce硬化則へ当てはめます。処理はブラウザ内で完結します。

## Commands

- install: `npm --prefix frontend install`
- dev: `npm --prefix frontend run dev`
- build: `npm --prefix frontend run build`
- typecheck: `npm --prefix frontend run typecheck`
- lint: `npm --prefix frontend run lint`
- test: `npm --prefix frontend test`
- test single: `npm --prefix frontend test -- path/to/test.ts`
- e2e: `npm --prefix frontend run test:e2e`
- e2e single: `npm --prefix frontend run test:e2e -- e2e/workflow.spec.ts`

## Code Style

- コンポーネントとutilityはnamed exportを使います。Next.jsの`page.tsx`と`layout.tsx`のみdefault exportを許可します。
- TypeScriptのstrict設定を維持し、`any`や不要な型アサーションを避けます。
- feature固有の状態選択・派生データ・ブラウザ操作はhooksへ、React非依存の計算はfeature内の`lib`へ置きます。
- Zustandは工程別sliceを維持し、上流データ変更時に依存するフィット・エクスポート結果を無効化します。
- UIは既存のshadcnコンポーネントとTailwindのspacing scaleを優先し、理由のないarbitrary valueを増やしません。
- テストは対象実装の近くへ配置し、数値処理を変更した場合は境界値と既知解のテストを更新します。

## Architecture

- `frontend/src/app`: ルート・レイアウト・メタデータだけを置く薄いApp Router層です。
- `frontend/src/features/curve-fitting`: 曲線フィッティング機能のcomponents、hooks、lib、store、types、constants、workersを集約します。
- `frontend/src/features/curve-fitting/index.ts`: app層へ公開する唯一のfeature APIです。
- `frontend/src/shared`: feature非依存のUIプリミティブと汎用utilityだけを置きます。
- 依存方向は`app → features → shared`です。appからfeature内部への直接import、sharedからfeaturesへのimportは禁止です。
- DB・外部API接続がないため`external`層、API Route、Server Action、TanStack Queryは追加しません。

## Important

- アップロードされたCSVをサーバーや外部サービスへ送信しません。データ処理はブラウザ内で完結させます。
- 表示用の点群間引きを、フィッティングやエクスポートに使用する元データへ混入させません。
- 工学値から真値への変換と弾性ひずみ除去は`frontend/src/features/curve-fitting/lib/transform.ts`へ集約します。
- 出力最大塑性ひずみと出力点数はフィッティング時ではなく、エクスポート時だけ指定します。
- CSVはBOM付きUTF-8・CRLF、数値は有効数字6桁で出力します。
- LS-DYNAの`LCINT`は1001固定です。変更する場合は要件・実装・テスト・文書を同時に更新します。
