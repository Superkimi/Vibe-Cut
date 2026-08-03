import { expect, test } from "@playwright/test";
import { stat } from "node:fs/promises";
import path from "node:path";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("main")).toBeVisible();
});

test("opens the full editor workspace and imports local media", async ({
  page,
}) => {
  await expect(page.getByText("Vibe Cut", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Media" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Vibe" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(
    page.getByRole("region", { name: "Timeline" }),
  ).toBeVisible();

  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(
    path.join(process.cwd(), "tests/fixtures/sample.svg"),
  );

  await expect
    .poll(
      async () => {
        if (await page.getByTitle("sample.svg").count()) {
          return "imported";
        }
        return (await page.getByRole("status").textContent()) ?? "pending";
      },
      { timeout: 2_500 },
    )
    .toBe("imported");
  await expect(
    page.getByRole("button", { name: /sample\.svg, starts at/ }),
  ).toBeVisible();
  await expect(page.getByText("image 0:05", { exact: true })).toBeVisible();
});

test("switches the editor between English and Chinese and persists the choice", async ({
  page,
}) => {
  await page.getByRole("button", { name: "中文", exact: true }).click();
  await expect(page.getByRole("heading", { name: "素材" })).toBeVisible();
  await expect(page.getByRole("region", { name: "时间线" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "检查器" })).toBeVisible();
  await expect(page.getByPlaceholder("裁掉前 2 秒，然后加一条居中的标题……")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh");

  await page.reload();
  await expect(page.getByRole("heading", { name: "素材" })).toBeVisible();

  await page.getByRole("button", { name: "English", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Media" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Timeline" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("creates, reviews, and atomically applies an AI edit plan", async ({
  page,
}) => {
  await page.route("**/api/ai/plan", async (route) => {
    const input = route.request().postDataJSON() as {
      project: { revision: number };
    };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        plan: {
          schemaVersion: 1,
          id: "e2e-plan",
          baseRevision: input.project.revision,
          title: "Mark the hook",
          explanation: "Adds a marker where the opening hook begins.",
          warnings: [],
          operations: [
            {
              op: "addMarker",
              id: "hook-marker",
              time: 0,
              label: "Hook",
              color: "#8c7ac4",
            },
          ],
        },
      }),
    });
  });

  await page.getByText("Model settings").click();
  await page.getByLabel("API key").fill("test-key");
  await page
    .getByLabel("Describe a video edit")
    .fill("Mark the opening hook");
  await page.getByLabel("Create edit plan").click();

  await expect(
    page.getByRole("heading", { name: "Mark the hook" }),
  ).toBeVisible();
  await expect(page.getByText("addMarker")).toBeVisible();
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.getByText(/Applied 1 timeline changes/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Undo" })).toBeEnabled();
});

test("previews an imported audio clip in sync with transport playback", async ({
  page,
}) => {
  await page
    .locator('input[type="file"]')
    .setInputFiles(path.join(process.cwd(), "tests/fixtures/sample.wav"));
  await expect(page.getByText("audio 0:03", { exact: true })).toBeVisible();
  const audio = page.getByLabel("Audio preview for sample.wav");
  await expect(audio).toHaveCount(1);

  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect
    .poll(async () => audio.evaluate((element: HTMLAudioElement) => element.paused))
    .toBe(false);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect
    .poll(async () => audio.evaluate((element: HTMLAudioElement) => element.paused))
    .toBe(true);
});

test("changes canvas presets and opens the export workflow", async ({
  page,
}) => {
  await page.getByRole("tab", { name: "Inspector" }).click();
  await page.getByRole("button", { name: "Shorts 9:16" }).click();
  await expect(page.getByLabel("Width")).toHaveValue("1080");
  await expect(page.getByLabel("Height")).toHaveValue("1920");

  await page.getByRole("button", { name: "Export", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Export video" }),
  ).toBeVisible();
  await expect(page.getByText("1080 x 1920, 30 fps")).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("directly repositions a canvas layer and keeps it editable", async ({
  page,
}) => {
  await page
    .locator('input[type="file"]')
    .setInputFiles(path.join(process.cwd(), "tests/fixtures/sample.svg"));
  const layer = page.getByRole("button", { name: "Select sample.svg" });
  await expect(layer).toBeVisible();
  if ((page.viewportSize()?.width ?? 1_000) < 800) {
    await layer.focus();
    await layer.press("ArrowRight");
    await layer.press("ArrowDown");
  } else {
    const box = await layer.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      box!.x + box!.width / 2 + 40,
      box!.y + box!.height / 2 + 24,
      { steps: 4 },
    );
    await page.mouse.up();
  }

  await page.getByRole("tab", { name: "Inspector" }).click();
  await expect
    .poll(async () =>
      Number(
        await page
          .getByRole("spinbutton", { name: "X", exact: true })
          .inputValue(),
      ),
    )
    .toBeGreaterThan(0);
  await expect
    .poll(async () =>
      Number(
        await page
          .getByRole("spinbutton", { name: "Y", exact: true })
          .inputValue(),
      ),
    )
    .toBeGreaterThan(0);
  await expect(page.getByRole("button", { name: "Undo" })).toBeEnabled();
});

test("renders and downloads a real encoded video", async ({
  browserName,
  page,
}) => {
  test.skip(
    browserName !== "chromium",
    "Headless WebKit does not expose the production WebCodecs encoder.",
  );

  await page
    .locator('input[type="file"]')
    .setInputFiles(path.join(process.cwd(), "tests/fixtures/sample.svg"));
  await expect(page.getByTitle("sample.svg")).toBeVisible();

  await page.getByRole("tab", { name: "Inspector" }).click();
  const width = page.getByLabel("Width");
  await width.fill("320");
  await width.blur();
  const height = page.getByLabel("Height");
  await height.fill("180");
  await height.blur();
  await page.getByLabel("Frame rate").selectOption("24");

  await page.getByRole("button", { name: "Export", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Export video" });
  await expect(dialog.getByText("320 x 180, 24 fps")).toBeVisible();

  const downloadPromise = page.waitForEvent("download", { timeout: 90_000 });
  await dialog.getByRole("button", { name: "Export", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^Untitled-cut\.(mp4|webm)$/);
  const downloadedPath = await download.path();
  expect(downloadedPath).not.toBeNull();
  expect((await stat(downloadedPath!)).size).toBeGreaterThan(1_000);
  await expect(dialog.getByText("Export downloaded")).toBeVisible();
});
