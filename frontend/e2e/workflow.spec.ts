import { expect, test } from "@playwright/test";
import path from "node:path";

test("CSVからフィッティングとエクスポートまで進められる", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Material Curve Fitter" })).toBeVisible();

  const testData = path.resolve(import.meta.dirname, "../test-data/C5210HP_EH_rolling_direction.csv");
  await page.getByLabel("CSVファイル").setInputFiles(testData);
  await page.getByLabel("ヤング率 [MPa]").fill("104316");
  await page.getByLabel("降伏応力 [MPa]").fill("694");
  await page.getByRole("button", { name: "変換データを作成" }).click();
  await expect(page.getByRole("heading", { name: /真応力–真塑性ひずみへの変換/ })).toBeVisible();

  await page.getByLabel("硬化則").selectOption("voce");
  await page.getByLabel("終了塑性ひずみ").fill("0.12");
  await page.getByRole("button", { name: /自動フィッティング/ }).click();
  await expect(page.getByText("パラメータ調整")).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "出力データを生成" }).click();
  await expect(page.getByLabel("LS-DYNA *DEFINE_CURVE プレビュー")).toContainText("*DEFINE_CURVE");
  await expect(page.getByRole("button", { name: /CSVをダウンロード/ })).toBeVisible();
});
