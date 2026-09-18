import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
test("single workspace: three primitives, bilingual drafts, publish and call, archive/restore/delete", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(
    "/#bootstrap=" + readFileSync(".playwright/bootstrap", "utf8"),
  );
  await expect(
    page.getByRole("heading", { name: "Create your first function" }),
  ).toBeVisible();
  await page.locator(".rail-bottom").getByRole("button", { name: "API docs" }).click();
  await expect(page.locator(".api-table").getByText("/v1/systemone")).toBeVisible();
  await expect(
    page.locator(".api-table").getByText("/v1/functions/:key/invoke"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.locator(".rail-bottom").getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("heading", { name: "TypeSafe", exact: true })).toBeVisible();
  await page.screenshot({ path: ".playwright/settings.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: ".playwright/settings-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.getByRole("button", { name: "Local service", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Local service", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Backup and export", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Backup and export", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add function" }).click();
  await page.getByRole("button", { name: /^Choice/ }).click();
  await expect(
    page.getByRole("heading", { name: "Ticket routing", exact: true }),
  ).toBeVisible();
  await page.getByLabel("content *").fill("Please refund the duplicate charge");
  await page.getByRole("button", { name: "Run preview", exact: true }).click();
  await expect(page.getByText("Done", { exact: true })).toBeVisible();
  await expect(page.locator(".answer-value")).toContainText("billing");
  await page.getByRole("button", { name: "Save cases" }).click();
  await page.getByLabel("Case name").fill("Duplicate charge");
  await page.getByRole("button", { name: "Save current input as a case" }).click();
  await expect(page.getByRole("button", { name: "Load", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Publish version", exact: true }).click();
  await page
    .getByRole("button", { name: "Publish v1 and make default", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.locator(".directory-status")).toContainText("Published");
  await page.screenshot({
    path: ".playwright/editor-desktop.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight <= innerHeight + 1,
    ),
  ).toBe(true);
  await page
    .locator(".simple-definition")
    .getByLabel("Instructions")
    .fill("Keep unsaved edits");
  await expect(page.getByText("Stale preview", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add function" }).click();
  await page.getByRole("button", { name: /^Noul/ }).click();
  await expect(
    page.getByRole("heading", { name: "Evidence check", exact: true }),
  ).toBeVisible();
  await page.getByLabel("content *").fill("Refunds are allowed within seven days for unused plans");
  await page.getByLabel("context *").fill("Unused plans may be refunded within three days");
  await page.getByRole("button", { name: "Run preview", exact: true }).click();
  await expect(page.locator(".answer-value")).toContainText("0.95");
  await page.screenshot({ path: ".playwright/noul.png", fullPage: true });
  await page.getByRole("button", { name: "Add function" }).click();
  await page.getByRole("button", { name: /^Score/ }).click();
  await expect(
    page.locator(".simple-definition").getByLabel("Function name"),
  ).toHaveValue("Content relevance");
  await page
    .getByLabel("content *")
    .fill("Building evaluation sets for AI products");
  await page.getByLabel("context *").fill("AI product development");
  await page.getByRole("button", { name: "Run preview", exact: true }).click();
  await expect(page.locator(".answer-value")).toContainText("1");
  await expect(page.locator(".score-legend .chosen")).toContainText("Partly");
  await expect(page.locator(".type-tags .type-noul")).toBeVisible();
  await expect(page.locator(".type-tags .type-choice")).toBeVisible();
  await expect(page.locator(".type-tags .type-score")).toBeVisible();
  await page.getByRole("button", { name: "Filter functions" }).click();
  await page.getByRole("combobox", { name: "Filter by primitive" }).selectOption("score");
  await expect(page.locator(".function-select")).toHaveCount(1);
  await page.getByRole("combobox", { name: "Filter by primitive" }).selectOption("all");
  await page.getByRole("button", { name: "Filter functions" }).click();
  await page.screenshot({ path: ".playwright/english.png", fullPage: true });
  await page
    .locator(".function-select")
    .filter({ hasText: "Ticket routing" })
    .click();
  await expect(
    page.locator(".simple-definition").getByLabel("Instructions"),
  ).toHaveValue("Keep unsaved edits");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await page.getByRole("button", { name: "Language / 语言" }).click();
  await expect(
    page.getByRole("button", { name: "保存草稿", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Language / 语言" }).click();
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.screenshot({
    path: ".playwright/editor-narrow.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <= innerWidth &&
        document.documentElement.scrollHeight <= innerHeight + 1,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Connections", exact: true }).click();
  await page.getByRole("button", { name: "Create credential", exact: true }).click();
  await page.getByLabel("Client name").fill("test-service");
  await page.getByRole("dialog").getByRole("checkbox", { name: "Ticket routing" }).check();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Create credential", exact: true })
    .click();
  const token = await page
    .getByRole("dialog")
    .locator("code.break")
    .innerText();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByLabel("Client token").fill(token);
  await page
    .getByRole("textbox", { name: "Business API input JSON" })
    .fill('{"content":"refund"}');
  await page.getByRole("button", { name: "Call selected release" }).click();
  await expect(page.getByLabel("Client token")).toHaveValue("");
  await expect(
    page.getByText('"billing"', { exact: true }).last(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Agents", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Jev Workbench skill" })).toBeVisible();
  await page.screenshot({ path: ".playwright/agents.png", fullPage: true });
  const item = page.locator(".function-item").filter({ hasText: "Ticket routing" });
  await item.locator(".function-select").click();
  await item.locator("summary").click();
  await item.getByRole("button", { name: "Archive function" }).click();
  await expect(
    page.getByText("This function is archived. Calls are paused. Unarchive it from the list."),
  ).toBeVisible();
  await page.locator(".group-heading").filter({ hasText: "Archive" }).click();
  await expect(item).toContainText("Archived");
  await item.locator("summary").click();
  await item.getByRole("button", { name: "Unarchive" }).click();
  await expect(item).toContainText("Published");
  const score = page
    .locator(".function-item")
    .filter({ hasText: "Content relevance" });
  await score.locator("summary").click();
  await score.getByRole("button", { name: "Move to Trash", exact: true }).click();
  await page.getByRole("button", { name: /^Trash/ }).click();
  await expect(score).toContainText("Deleted");
  await score.locator("summary").click();
  await score.getByRole("button", { name: "Restore", exact: true }).click();
  await expect(score).toContainText("Draft");
  await score.locator("summary").click();
  await score.getByRole("button", { name: "Move to Trash", exact: true }).click();
  await expect(score).toContainText("Deleted");
  await score.locator("summary").click();
  await score.getByRole("button", { name: "Delete permanently", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm delete" })
    .click();
  await expect(score).toHaveCount(0);
  await page.getByLabel("Search functions").fill("Evidence");
  await expect(page.locator(".function-item")).toHaveCount(1);
  await page.getByLabel("Search functions").fill("");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: ".playwright/mobile.png", fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Language / 语言" }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "保存草稿", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
