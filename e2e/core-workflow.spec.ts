import path from "node:path";
import { expect, test } from "@playwright/test";

test("Anmeldung, Import, Umsatzansicht und mobile Einstellungen funktionieren zusammen", async ({ page }) => {
  await page.goto("/anmelden");
  await page.getByLabel("Benutzername").fill("e2e-admin");
  await page.getByRole("textbox", { name: /^Passwort / }).fill("Finanzplaner-Test-2026");
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: /Ausgaben|Finanzen|Überblick/i }).first()).toBeVisible();

  await page.goto("/einstellungen/import");
  await page.locator('input[type="file"]').setInputFiles(path.resolve(".github/fixtures/sparkasse-e2e.csv"));
  await expect(page.getByText("sparkasse-e2e.csv")).toBeVisible();
  await page.getByRole("button", { name: "Datei lokal prüfen" }).click();
  await expect(page.getByRole("heading", { name: /Importvorschau/ })).toBeVisible();
  await expect(page.getByText("2", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "2 Umsätze importieren" }).click();
  await expect(page).toHaveURL(/\/umsaetze/);
  await expect(page.getByText("E2E SUPERMARKT")).toBeVisible();
  await expect(page.getByText("E2E TELEKOM")).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/einstellungen");
  await expect(page.getByRole("heading", { name: "Einstellungen" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Mein Profil/ })).toBeVisible();
  await page.getByRole("link", { name: /Mein Profil/ }).click();
  await expect(page.getByLabel("E-Mail-Adresse")).toBeVisible();
  await expect(page.getByLabel("Aktuelles Passwort zur Bestätigung")).toBeVisible();
});
