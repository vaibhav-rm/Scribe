import { test, expect, type Page } from "@playwright/test";

/**
 * E2E tests for Scribe.
 *
 * These are INTEGRATION TESTS that require external services:
 * - A running Supabase project (auth + database) with migrations 001–006 applied
 * - A running API server on localhost:4000
 * - A running frontend on localhost:5173
 * - A configured AI provider (GEMINI_API_KEY) for the generation flow
 *
 * Supabase email confirmation must be disabled, or the test users must be
 * pre-confirmed, otherwise sign-in after registration will fail.
 *
 * Run with: npm run test:e2e (servers must be running first)
 */

const uniqueSuffix = Date.now();
const password = "TestPass123!";
const user1Email = `student1+${uniqueSuffix}@college.edu`;
const user2Email = `student2+${uniqueSuffix}@college.edu`;

let projectUrl = "";
let documentUrl = "";

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.fill('input[id="email"]', email);
  await page.fill('input[id="password"]', password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/app/);
}

async function signOut(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);
}

async function register(page: Page, email: string) {
  await page.goto("/signup");
  await page.fill('input[id="display-name"]', "Test Student");
  await page.fill('input[id="email"]', email);
  await page.fill('input[id="password"]', password);
  await page.fill('input[id="confirm-password"]', password);
  await page.click('button[type="submit"]');
  // Depending on the Supabase project's email-confirmation setting, signup
  // either lands in the app immediately or asks the user to verify first.
  await expect(page).toHaveURL(/\/(app|login)/);
  if (page.url().includes("/app")) {
    await signOut(page);
  }
}

test.describe.serial("Scribe E2E flows", () => {
  test("1. Register and sign in", async ({ page }) => {
    await register(page, user1Email);
    await register(page, user2Email);

    await signIn(page, user1Email);
    await expect(page.locator("h1")).toContainText("Dashboard");
  });

  test("2. Create a project", async ({ page }) => {
    await signIn(page, user1Email);
    await page.goto("/app/projects");
    await page.click('button:has-text("New project")');

    await page.fill('input[id="title"]', "Smart Irrigation System");
    await page.fill(
      'textarea[id="description"]',
      "An IoT-based irrigation system for water conservation",
    );
    await page.click('button:has-text("Create project")');

    await expect(page.locator("text=Smart Irrigation System")).toBeVisible();
    await page.click("text=Smart Irrigation System");
    await expect(page).toHaveURL(/\/app\/projects\/[0-9a-f-]+/);
    projectUrl = page.url();
  });

  test("3. Add a text resource", async ({ page }) => {
    await signIn(page, user1Email);
    await page.goto(projectUrl);

    await page.click('button:has-text("Add text")');
    await page.fill('input[id="resource-name"]', "Project Abstract");
    await page.fill(
      "textarea",
      "This project develops an automated irrigation system using soil moisture sensors and an Arduino microcontroller to optimize water usage in agricultural fields.",
    );
    await page.click('button:has-text("Add resource")');

    await expect(page.locator("text=Project Abstract")).toBeVisible();
  });

  test("4. Upload a template", async ({ page }) => {
    await signIn(page, user1Email);
    await page.goto("/app/templates");
    await page.click('button:has-text("Upload template")');

    // A minimal DOCX-shaped fixture. Real parsing output depends on the file
    // content; this flow verifies upload + storage + listing.
    await page.setInputFiles('input[id="template-file"]', {
      name: "template.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer: Buffer.from(
        "PK\x03\x04\x14\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\xd2\xf5\xff\xff",
      ),
    });

    await page.fill('input[id="template-title"]', "Standard Synopsis Template");
    await page.click('button[type="submit"]:has-text("Upload template")');

    await expect(page.locator("text=Standard Synopsis Template")).toBeVisible({
      timeout: 30000,
    });
  });

  test("5. Review the parsed template specification", async ({ page }) => {
    await signIn(page, user1Email);
    await page.goto("/app/templates");
    await page.click("text=Standard Synopsis Template");

    await expect(page.locator("text=Template specification")).toBeVisible();
    await expect(page.locator("textarea[aria-label='Template specification JSON']")).toBeVisible();
  });

  test("6. Generate and review a document outline", async ({ page }) => {
    await signIn(page, user1Email);
    await page.goto("/app/generate");

    await page.click('[aria-label="Project"]');
    await page.click('[role="option"]:has-text("Smart Irrigation System")');

    await page.click('[aria-label="Template"]');
    await page.click('[role="option"]:has-text("Standard Synopsis Template")');

    await page.click('button:has-text("Generate outline")');

    await expect(
      page.getByRole("button", { name: "Approve & generate document" }),
    ).toBeVisible({ timeout: 120000 });
  });

  test("7. Generate a document using the AI provider", async ({ page }) => {
    await signIn(page, user1Email);
    await page.goto("/app/generate");

    await page.click('[aria-label="Project"]');
    await page.click('[role="option"]:has-text("Smart Irrigation System")');
    await page.click('button:has-text("Generate outline")');
    const approveButton = page.getByRole("button", {
      name: "Approve & generate document",
    });
    await expect(approveButton).toBeVisible({ timeout: 120000 });

    await approveButton.click();
    await page.waitForURL(/\/app\/generations\/[0-9a-f-]+/);

    await expect(page.locator("text=Generation complete")).toBeVisible({
      timeout: 180000,
    });

    await page.click('button:has-text("Open document")');
    await page.waitForURL(/\/app\/documents\/[0-9a-f-]+/);
    documentUrl = page.url();

    await expect(page.locator("textarea").first()).toBeVisible();
  });

  test("8. Edit a section and autosave", async ({ page }) => {
    await signIn(page, user1Email);
    await page.goto(documentUrl);

    const firstSection = page.locator("textarea").first();
    await firstSection.fill(
      "This is the edited abstract for the Smart Irrigation System project.",
    );

    await expect(
      page.getByText("All changes saved", { exact: true }),
    ).toBeVisible({ timeout: 15000 });
    await expect(firstSection).toHaveValue(
      "This is the edited abstract for the Smart Irrigation System project.",
    );
  });

  test("9. Open version history and export DOCX", async ({ page }) => {
    await signIn(page, user1Email);
    await page.goto(documentUrl);

    await page.click('button:has-text("History")');
    await expect(page.locator("text=Version history")).toBeVisible();
    await expect(page.locator("text=Manual edit")).toBeVisible();
    await page.getByRole("button", { name: "Close" }).last().click();

    await page.click('button:has-text("DOCX")');
    await expect(page.getByText(/Downloading .*\.docx/i)).toBeVisible({
      timeout: 30000,
    });
  });

  test("10. Another user cannot access the project", async ({ page }) => {
    await signIn(page, user2Email);
    await page.goto(projectUrl);

    await expect(
      page.locator("text=Project not found or not accessible"),
    ).toBeVisible();
  });

  test("11. Free-tier limits are shown", async ({ page }) => {
    await signIn(page, user1Email);
    await page.goto("/app/billing");

    // The billing page renders the plans and the current usage. Exact copy can
    // change, so assert on a stable plan name rather than a specific number.
    await expect(page.locator("text=/free/i").first()).toBeVisible();
    await expect(page.locator("text=/generations/i").first()).toBeVisible();
  });

  test("12. Billing page exposes Razorpay or mock mode safely", async ({
    page,
  }) => {
    await signIn(page, user1Email);
    await page.goto("/app/billing");

    await expect(
      page.getByRole("heading", { name: "Current access" }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByRole("button", { name: /Get Student Pro|Manage access|Upgrade/i }),
    ).toBeVisible({ timeout: 30_000 });
  });
});
