import { expect, test } from "@playwright/test";
import path from "node:path";

test("CSVからフィッティングとエクスポートまで進められる", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Material Curve Fitter" })).toBeVisible();

  const testData = path.resolve(import.meta.dirname, "../test-data/C5210HP_EH_rolling_direction.csv");
  await page.getByLabel("CSVファイル").setInputFiles(testData);
  await page.getByLabel("ヤング率 [MPa]").fill("104316");
  await page.getByRole("button", { name: "変換データを作成" }).click();
  await expect(page.getByRole("heading", { name: /真応力–真塑性ひずみへの変換/ })).toBeVisible();
  await expect(page.getByText(/比例限度応力:/)).toBeVisible();
  await expect(page.getByText(/0.2%耐力:/)).toBeVisible();
  await page.getByRole("button", { name: "この比例限度を使用" }).click();

  await page.getByLabel("Ludwik").check();
  await page.getByLabel("Voce").check();
  await expect(page.getByLabel("フィッティング始点")).toHaveAttribute("step", "0.01");
  const fitEnd = page.getByLabel("実測・硬化則接続点");
  const initialFitEnd = await fitEnd.inputValue();
  await fitEnd.fill(String(Number(initialFitEnd) / 2));
  await page.getByRole("button", { name: "推奨接続点に戻す" }).click();
  await expect(fitEnd).toHaveValue(initialFitEnd);
  await page.getByLabel("フィッティング始点").fill(String(Number(initialFitEnd) + 0.01));
  const fitButton = page.getByRole("button", { name: /選択した硬化則をフィット/ });
  await expect(fitButton).toBeDisabled();
  await page.getByLabel("フィッティング始点").fill("0.01");
  await expect(fitButton).toBeEnabled();
  await fitButton.click();
  await expect(page.getByText("パラメータ調整")).toHaveCount(3, { timeout: 15_000 });

  await page.getByLabel("エクスポート対象硬化則").selectOption("voce");
  await page.getByRole("button", { name: "出力データを生成" }).click();
  await expect(page.getByLabel("LS-DYNA *DEFINE_CURVE プレビュー")).toContainText("*DEFINE_CURVE");
  await expect(page.getByRole("button", { name: /CSVをダウンロード/ })).toBeVisible();
});

test("0.2%耐力を参考値として比例限度とは別に表示する", async ({ page }) => {
  await page.goto("/");
  const testData = path.resolve(import.meta.dirname, "../test-data/C5210HP_EH_rolling_direction.csv");
  await page.getByLabel("CSVファイル").setInputFiles(testData);
  await page.getByLabel("ヤング率 [MPa]").fill("104316");
  await page.getByRole("button", { name: "変換データを作成" }).click();

  await expect(page.getByText(/比例限度応力:/)).toBeVisible();
  await expect(page.getByText(/0.2%耐力:/)).toBeVisible();
  await expect(page.getByLabel("比例限度候補の真全ひずみ")).toBeVisible();
  await expect(page.getByRole("button", { name: "この比例限度を使用" })).toBeEnabled();
});
