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
    page.getByRole("heading", { name: "创建你的第一个判断函数" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^Choice/ }).click();
  await expect(
    page.getByRole("heading", { name: "工单分流", exact: true }),
  ).toBeVisible();
  await page.getByLabel("content *").fill("我的订单被重复扣款，请退款");
  await page.getByRole("button", { name: "测试当前编辑", exact: true }).click();
  await expect(page.getByText("判断完成", { exact: true })).toBeVisible();
  await expect(page.locator(".answer-value")).toContainText("billing");
  await page.getByRole("button", { name: "保存与管理样例" }).click();
  await page.getByLabel("样例名称").fill("重复扣款");
  await page.getByRole("button", { name: "保存当前输入为样例" }).click();
  await expect(
    page.getByRole("button", { name: "载入", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page.getByRole("button", { name: "发布新版本", exact: true }).click();
  await page
    .getByRole("button", { name: "发布 v1 并设为默认", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.locator(".directory-status")).toContainText("已发布");
  await page.screenshot({
    path: ".playwright/editor-desktop.png",
    fullPage: true,
  });
  await page
    .locator(".simple-definition")
    .getByLabel("判断说明")
    .fill("保留未保存的修改");
  await expect(page.getByText("来自旧配置", { exact: true })).toBeVisible();
  // Creating another function leaves the first draft in memory.
  await page.getByRole("button", { name: "新增函数", exact: true }).click();
  await page.getByRole("button", { name: /^Noul/ }).click();
  await expect(
    page.getByRole("heading", { name: "证据核验", exact: true }),
  ).toBeVisible();
  await page.getByLabel("content *").fill("退款政策允许未使用套餐在七天内退款");
  await page.getByLabel("context *").fill("未使用套餐三天内可退款");
  await page.getByRole("button", { name: "测试当前编辑", exact: true }).click();
  await expect(page.locator(".answer-value")).toContainText("0.95");
  await page.screenshot({ path: ".playwright/noul.png", fullPage: true });
  await page.getByRole("button", { name: "Language / 语言" }).click();
  await expect(
    page.getByRole("button", { name: "Save draft", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "New function", exact: true }).click();
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
  await expect(page.locator(".type-noul")).toBeVisible();
  await expect(page.locator(".type-choice")).toBeVisible();
  await expect(page.locator(".type-score")).toBeVisible();
  await page.getByRole("button", {name:"Filter functions"}).click();
  await page.getByRole("combobox", {name:"Filter by primitive"}).selectOption("score");
  await expect(page.locator(".function-select")).toHaveCount(1);
  await page.getByRole("combobox", {name:"Filter by primitive"}).selectOption("all");
  await page.getByRole("button", {name:"Filter functions"}).click();
  await page.screenshot({ path: ".playwright/english.png", fullPage: true });
  await page
    .locator(".function-select")
    .filter({ hasText: "工单分流" })
    .click();
  await expect(
    page.locator(".simple-definition").getByLabel("Instructions"),
  ).toHaveValue("保留未保存的修改");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await page.getByRole("button", { name: "Language / 语言" }).click();
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.screenshot({
    path: ".playwright/editor-narrow.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.locator(".inline-connect>summary").click();
  await page.getByRole("button", { name: "创建凭证", exact: true }).click();
  await page.getByLabel("客户端名称").fill("test-service");
  await page.getByRole("dialog").getByRole("checkbox").check();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "创建凭证", exact: true })
    .click();
  const token = await page
    .getByRole("dialog")
    .locator("code.break")
    .innerText();
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page.getByLabel("客户端 Token").fill(token);
  await page
    .getByRole("textbox", { name: "业务 API 输入 JSON" })
    .fill('{"content":"退款"}');
  await page.getByRole("button", { name: "调用所选发布版本" }).click();
  await expect(page.getByLabel("客户端 Token")).toHaveValue("");
  await expect(
    page.getByText('"billing"', { exact: true }).last(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Agent 接入", exact: true }).click();
  await page.screenshot({ path: ".playwright/agents.png", fullPage: true });
  await page.locator(".inline-connect>summary").click();
  const item = page.locator(".function-item").filter({ hasText: "工单分流" });
  await item.locator("summary").click();
  await item.getByRole("button", { name: "归档函数" }).click();
  await expect(
    page.getByText("此函数已归档，业务调用已停止。可在左侧恢复。"),
  ).toBeVisible();
  await page.getByRole("button", { name: /^归档/ }).click();
  await expect(item).toContainText("已归档");
  await item.locator("summary").click();
  await item.getByRole("button", { name: "恢复归档" }).click();

  await expect(item).toContainText("已发布");
  const score = page
    .locator(".function-item")
    .filter({ hasText: "Content relevance" });
  await score.locator("summary").click();
  await score.getByRole("button", { name: "移入回收站", exact: true }).click();
  await page.getByRole("button", { name: /^回收站/ }).click();
  await expect(score).toContainText("已删除");
  await score.locator("summary").click();
  await score.getByRole("button", { name: "恢复函数", exact: true }).click();
  await expect(score).toContainText("草稿");
  await score.locator("summary").click();
  await score.getByRole("button", { name: "移入回收站", exact: true }).click();
  await expect(score).toContainText("已删除");
  await score.locator("summary").click();
  await score.getByRole("button", { name: "永久删除", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "确认永久删除" })
    .click();
  await expect(score).toHaveCount(0);
  await page.getByLabel("搜索函数").fill("证据");
  await expect(page.locator(".function-item")).toHaveCount(1);
  await page.getByLabel("搜索函数").fill("");
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
    page.getByRole("button", { name: "Save draft", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
