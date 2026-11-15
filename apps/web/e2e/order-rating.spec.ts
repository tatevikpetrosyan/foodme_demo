import { test, expect, type APIRequestContext } from "@playwright/test";
import { registerCustomerViaApi } from "./auth";

// SCRUM-7: a customer rates a delivered order from "My orders".
const API = process.env.VITE_API_BASE_URL || "http://localhost:8081";

/** Creates a takeaway order for the customer, then moves it to DELIVERED as admin. */
async function createDeliveredOrder(request: APIRequestContext, customerToken: string) {
  const chefs = await (await request.get(`${API}/api/chef/active?page=0&size=12`)).json();
  const chef = chefs.exploreChefResponseDtoList[0];
  const detail = await (await request.get(`${API}/api/chef/${chef.id}`)).json();
  const dish = detail.dishes[0];

  const orderRes = await request.post(`${API}/api/order`, {
    headers: { Authorization: `Bearer ${customerToken}` },
    data: {
      chefId: chef.id,
      receiverName: "E2E Customer",
      receiverPhoneNumber: "+37490000000",
      receiverEmail: "rating-e2e@example.com",
      paymentType: "CASH",
      deliveryMethod: "TAKEAWAY",
      note: "order rating e2e",
      createOrderDishes: [{ dishId: dish.id, quantity: 1 }],
    },
  });
  expect(orderRes.ok()).toBeTruthy();
  const order = await orderRes.json();

  const adminRes = await request.post(`${API}/admin/auth/login`, {
    data: { username: "admin", password: "admin123" },
  });
  expect(adminRes.ok()).toBeTruthy();
  const { token: adminToken } = await adminRes.json();

  // The create response has no id, so find the order (newest first) in the admin list.
  const adminHeaders = { Authorization: `Bearer ${adminToken}` };
  const newOrders = await (
    await request.get(`${API}/admin/order?status=NEW&page=0&size=50`, { headers: adminHeaders })
  ).json();
  const created = newOrders.list.find((o: { number: string }) => o.number === order.number);
  expect(created, `order ${order.number} in the admin list`).toBeTruthy();

  // NEW -> ACCEPTED -> DELIVERED, the only path to a delivered order.
  for (const status of ["ACCEPTED", "DELIVERED"]) {
    const res = await request.patch(`${API}/admin/order/${created.id}/status`, {
      headers: adminHeaders,
      data: { status },
    });
    expect(res.ok(), `admin sets order ${order.number} to ${status}`).toBeTruthy();
  }
  return order as { number: string };
}

test.describe("Order rating", () => {
  test("customer rates a delivered order from My orders", async ({ page, request }) => {
    const { token, email } = await registerCustomerViaApi(request, API);
    const order = await createDeliveredOrder(request, token);

    // Sign in through the UI as that customer, then land on My orders.
    await page.goto("/login?next=/orders");
    const signIn = page.getByRole("form", { name: "Sign in" });
    await signIn.getByLabel("Email").fill(email);
    await signIn.getByLabel("Password").fill("secret123");
    await signIn.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/orders/);

    const row = page.getByTestId(`order-${order.number}`);
    await expect(row).toBeVisible();

    // Open the dialog from this order's row.
    await row.getByRole("button", { name: "Rate order" }).click();
    const dialog = page.getByRole("dialog", { name: `Rate order ${order.number}` });
    await expect(dialog).toBeVisible();

    // Submit stays disabled until a star is picked.
    const submit = dialog.getByRole("button", { name: "Submit rating" });
    await expect(submit).toBeDisabled();

    // The radio inputs are visually hidden; the user clicks the star (its label).
    await dialog.locator("label", { hasText: "4 stars, Good" }).click();
    await expect(dialog.getByRole("radio", { name: "4 stars, Good" })).toBeChecked();
    await dialog.getByLabel(/Comment/).fill("Warm and tasty, thanks!");
    await submit.click();

    // The dialog closes and the stars replace the button.
    await expect(dialog).toBeHidden();
    await expect(row.getByRole("img", { name: "Rated 4 out of 5" })).toBeVisible();
    await expect(row.getByRole("button", { name: "Rate order" })).toHaveCount(0);

    // The rating is saved: it is still there after a reload.
    await page.reload();
    await expect(page.getByTestId(`order-${order.number}`).getByRole("img", { name: "Rated 4 out of 5" })).toBeVisible();
  });
});
