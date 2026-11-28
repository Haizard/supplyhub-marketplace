import { expect, type Page, test } from "@playwright/test";

/**
 * The marketplace networks share one account. These tests cover the routes that
 * cross a visibility boundary: a public detail page for guests, the sign-in wall
 * in front of logistics registration, and the member/non-member split on a
 * company profile.
 *
 * They expect the demo seed (npm run db:seed && npm run db:seed:marketplaces).
 */
const PRODUCE_LISTING_ID = "a4000000-0000-4000-8000-000000000003"; // Hass avocado, Mbeya
const LOGISTICS_COMPANY_ID = "b2000000-0000-4000-8000-000000000001"; // Kilimanjaro Freight Co.

const DEMO_PASSWORD = "SupplyHub!2026";
const COMPANY_MEMBER = "logistics@supplyhub.test";
const NON_MEMBER = "customer@supplyhub.test";

async function signIn(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  // Password verification runs against the database, so allow more than the default 5s.
  await expect(page).not.toHaveURL(/\/sign-in/, { timeout: 30_000 });
}

test.describe("guest marketplace detail pages", () => {
  test("a guest can read a produce listing without being asked to sign in", async ({ page }) => {
    await page.goto(`/agriculture/marketplace/${PRODUCE_LISTING_ID}`);

    await expect(page).toHaveURL(new RegExp(`/agriculture/marketplace/${PRODUCE_LISTING_ID}$`));
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Avocado");
    await expect(page.getByText("Export grade")).toBeVisible();
    await expect(page.getByText(/Mbalizi packhouse/).first()).toBeVisible();
  });

  test("a guest sees the public profile of an approved company", async ({ page }) => {
    await page.goto(`/logistics/${LOGISTICS_COMPANY_ID}`);

    await expect(page.getByRole("heading", { level: 1 })).toContainText("Kilimanjaro Freight Co.");
    await expect(page.getByText("Request a delivery").first()).toBeVisible();
    // The management console is member-only.
    await expect(page.getByRole("navigation", { name: "Company sections" })).toHaveCount(0);
  });

  test("an unknown produce listing shows the not-found page", async ({ page }) => {
    await page.goto("/agriculture/marketplace/00000000-0000-4000-8000-000000000000");

    // The shell streams before notFound() runs, so assert the rendered page, not the status.
    await expect(page.getByText(/404 · Page not found/i).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: /We could not find that page/i })).toBeVisible();
    await expect(page).not.toHaveURL(/\/sign-in/);
  });
});

test.describe("logistics registration", () => {
  test("a signed-out visitor is redirected to sign in and returned to the form", async ({
    page,
  }) => {
    await page.goto("/workspace/logistics/new");

    await expect(page).toHaveURL(/\/sign-in\?/);
    const url = new URL(page.url());
    expect(url.searchParams.get("next")).toBe("/workspace/logistics/new");

    await expect(page.getByRole("heading", { name: /sign in to your registry/i })).toBeVisible();
    await expect(page.locator('input[name="next"]')).toHaveValue("/workspace/logistics/new");
  });
});

test.describe("company profile is split by membership", () => {
  test("an active member gets the management console", async ({ page }) => {
    await signIn(page, COMPANY_MEMBER);
    await page.goto(`/logistics/${LOGISTICS_COMPANY_ID}`);

    const sections = page.getByRole("navigation", { name: "Company sections" });
    await expect(sections).toBeVisible();
    await expect(sections.getByRole("link", { name: "Dispatch", exact: true })).toBeVisible();
    await expect(sections.getByRole("link", { name: "Fleet", exact: true })).toBeVisible();
    // Members manage the company; they are not shown the public booking pitch.
    await expect(page.getByText("Request a delivery")).toHaveCount(0);
  });

  test("a signed-in non-member gets the public profile", async ({ page }) => {
    await signIn(page, NON_MEMBER);
    await page.goto(`/logistics/${LOGISTICS_COMPANY_ID}`);

    await expect(page.getByText("Request a delivery").first()).toBeVisible();
    await expect(page.getByText(/Run this company\?/)).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Company sections" })).toHaveCount(0);
  });
});
