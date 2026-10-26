import { test, expect } from "@playwright/test";
test("customer reserves multiple services, submits a deposit, and barber approves", async ({
  browser,
}) => {
  const customerContext = await browser.newContext(),
    barberContext = await browser.newContext();
  const customer = await customerContext.newPage(),
    barber = await barberContext.newPage();
  let bookingId;
  try {
    await signIn(customer, "customer@chair.test");
    await expect(customer.getByRole("dialog")).toHaveCount(0);
    await customer.goto("/shops/1");
    await customer.getByRole("checkbox").nth(0).check();
    await customer.getByRole("checkbox").nth(1).check();
    await expect(customer.locator(".summary-total")).toContainText("550 ETB");
    await customer.locator(".slot-grid button").first().click();
    await customer.getByRole("button", { name: "Reserve this chair" }).click();
    await expect(customer).toHaveURL(/checkout\/[0-9]+/);
    bookingId = customer.url().split("/").pop();
    await expect(customer.locator(".hold-timer")).toBeVisible();
    await expect(customer.locator(".bank-details")).toContainText("275 ETB");
    await customer
      .getByLabel("Transaction reference")
      .fill("E2E-" + Date.now());
    await customer
      .locator('input[name="receipt"]')
      .setInputFiles("public/images/customer-1.jpg");
    await customer.getByRole("button", { name: "Submit for approval" }).click();
    await expect(
      customer.getByRole("heading", { name: "Request sent. Looking sharp." }),
    ).toBeVisible({ timeout: 20000 });
    await customer.screenshot({
      path: "test-results/customer-request.png",
      fullPage: true,
    });
    await signIn(barber, "barber@chair.test");
    await expect(barber).toHaveURL(/portal/);
    const code = "BK-" + bookingId.padStart(6, "0");
    const row = barber.locator("tbody tr").filter({ hasText: code });
    await expect(row).toBeVisible();
    await expect(row.locator(".avatar")).toBeVisible();
    await row.getByRole("button", { name: "View receipt" }).click();
    await expect(barber.locator(".receipt-image")).toBeVisible();
    await barber.getByRole("button", { name: "Close", exact: true }).click();
    await row
      .getByRole("button", { name: "Approve booking and verify deposit" })
      .click();
    await barber
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm", exact: true })
      .click();
    await customer.reload();
    await expect(
      customer.getByRole("heading", { name: "Your chair is confirmed." }),
    ).toBeVisible();
  } finally {
    if (bookingId)
      await customer.evaluate(async (id) => {
        const headers = {
          Authorization: "Bearer " + sessionStorage.getItem("chair_token"),
          "Content-Type": "application/json",
          Accept: "application/json",
        };
        await fetch("/api/bookings/" + id + "/cancel", {
          method: "POST",
          headers,
          body: JSON.stringify({ reason: "Automated browser test cleanup" }),
        });
      }, bookingId);
    await customerContext.close();
    await barberContext.close();
  }
});
async function signIn(page, email) {
  await page.goto("/");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("ChairDemo2026!");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
}
test("discovery, customer photos and service calculator render on desktop and mobile", async ({
  page,
}) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Find your next great cut." }),
    ).toBeVisible();
    await expect(page.locator(".shop-card")).toHaveCount(3);
    await expect(page.locator(".shop-photo").first()).toBeVisible();
    expect(
      await page
        .locator("img")
        .evaluateAll((images) =>
          images.every((i) => i.complete && i.naturalWidth > 0),
        ),
    ).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: "test-results/discovery-" + width + ".png",
      fullPage: true,
    });
    await page.getByRole("link", { name: "Book a visit" }).first().click();
    await expect(
      page.getByRole("heading", { name: "Your visit" }),
    ).toBeVisible();
    await page.getByRole("checkbox").first().check();
    await expect(page.locator(".summary-total")).toContainText("350 ETB");
    await expect(page.locator(".slot-grid button").first()).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: "test-results/shop-" + width + ".png",
      fullPage: true,
    });
  }
});
test("owner CRM, revenue, service editor and team show real API data", async ({
  page,
}) => {
  await signIn(page, "owner@chair.test");
  await expect(page).toHaveURL(/portal/);
  await page.getByRole("link", { name: "Clients", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(4);
  await page.getByRole("button", { name: "View Abel Tesfaye" }).click();
  await expect(page.getByRole("dialog")).toContainText("Visit history");
  await expect(page.getByRole("dialog").locator("img")).toHaveCount(1);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("link", { name: "Shop finances" }).click();
  await expect(page.locator(".metrics")).toBeVisible();
  await expect(page.locator(".recharts-surface").first()).toBeVisible();
  await page.screenshot({
    path: "test-results/owner-revenue.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Services", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(5);
  await page.getByRole("button", { name: "Add service" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("link", { name: "Team", exact: true }).click();
  await expect(page.locator(".team-member")).toHaveCount(2);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/owner-team-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("barber working hours are editable and clients have profile images", async ({
  page,
}) => {
  await signIn(page, "barber@chair.test");
  await page.getByRole("link", { name: "Working hours" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(7);
  await page.getByLabel("Monday slot interval").fill("30");
  await page.getByRole("button", { name: "Save working hours" }).click();
  await expect(page.getByRole("status")).toContainText("saved");
  await page.getByRole("link", { name: "Clients", exact: true }).click();
  await expect(page.locator("tbody .avatar")).toHaveCount(4);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
