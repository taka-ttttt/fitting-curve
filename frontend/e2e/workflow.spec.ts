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

  await page.getByLabel("Ludwik").check();
  await page.getByLabel("Voce").check();
  await expect(page.getByLabel("開始塑性ひずみ")).toHaveAttribute("step", "0.01");
  const fitEnd = page.getByLabel("終了塑性ひずみ");
  const initialFitEnd = await fitEnd.inputValue();
  await fitEnd.fill("0.12");
  await page.getByRole("button", { name: "初期終了値に戻す" }).click();
  await expect(fitEnd).toHaveValue(initialFitEnd);
  await page.getByLabel("開始塑性ひずみ").fill("0.13");
  await fitEnd.fill("0.12");
  const fitButton = page.getByRole("button", { name: /選択した硬化則をフィット/ });
  await expect(fitButton).toBeDisabled();
  await page.getByLabel("開始塑性ひずみ").fill("0.01");
  await expect(fitButton).toBeEnabled();
  await fitButton.click();
  await expect(page.getByText("パラメータ調整")).toHaveCount(3, { timeout: 15_000 });

  await page.getByLabel("エクスポート対象硬化則").selectOption("voce");
  await page.getByRole("button", { name: "出力データを生成" }).click();
  await expect(page.getByLabel("LS-DYNA *DEFINE_CURVE プレビュー")).toContainText("*DEFINE_CURVE");
  await expect(page.getByRole("button", { name: /CSVをダウンロード/ })).toBeVisible();
});

test("0.2%オフセット法で耐力を算出して変換できる", async ({ page }) => {
  await page.goto("/");
  const testData = path.resolve(import.meta.dirname, "../test-data/C5210HP_EH_rolling_direction.csv");
  await page.getByLabel("CSVファイル").setInputFiles(testData);
  await page.getByLabel("変換基準").selectOption("proof-0.2");
  await page.getByLabel("ヤング率 [MPa]").fill("104316");
  await page.getByRole("button", { name: "変換データを作成" }).click();

  await expect(page.getByText(/算出した0.2%耐力: 693\.975 MPa/)).toBeVisible();
});
