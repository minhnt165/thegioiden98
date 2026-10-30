import { expect, test } from "@playwright/test";
import { acceptQuoteAsGuest, adminDb, cleanupCustomer, cleanupTestProduct, createTestProduct, testPhone, type TestProduct } from "./db";

// Màn Kho, tab Lịch sử: tìm không dấu, lọc loại, khối "Lịch sử kho" ở trang sản phẩm, nhãn người làm.

const phone = testPhone();
let p: TestProduct;

test.describe.configure({ mode: "serial" });
test.beforeAll(async () => {
  p = await createTestProduct({ stock: 5 });
  const { error } = await (await adminDb()).rpc("admin_adjust_stock", { p_variant_id: p.variantId, p_delta: -1, p_reason: "damaged" });
  if (error) throw error;
});
test.afterAll(async () => {
  await cleanupCustomer(phone);
  await cleanupTestProduct(p.productId);
});

const rowsWith = (page: import("@playwright/test").Page, text: string) => page.getByRole("row").filter({ hasText: text });

test("menu có mục Kho", async ({ page }) => {
  await page.goto("/admin");
  await page.getByRole("navigation", { name: "Menu quản trị" }).getByRole("link", { name: "Kho" }).first().click();
  await expect(page.getByRole("heading", { name: "Kho", level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Lịch sử" })).toBeVisible();
});

test("tab Lịch sử: tìm không dấu, lọc theo loại", async ({ page }) => {
  // "E2E Đèn bàn 1234" → gõ "e2e den ban 1234"
  const folded = p.name.replace("Đèn bàn", "den ban").toLowerCase();
  await page.goto(`/admin/kho?tab=lich-su&q=${encodeURIComponent(folded)}`);
  await expect(rowsWith(page, p.sku)).toHaveCount(2);
  await expect(rowsWith(page, p.sku).filter({ hasText: "Tồn đầu" })).toHaveCount(1);

  await page.goto(`/admin/kho?tab=lich-su&loai=dieu-chinh&q=${encodeURIComponent(p.sku)}`);
  await expect(rowsWith(page, p.sku)).toHaveCount(1);
  await expect(rowsWith(page, p.sku).filter({ hasText: "Vỡ / hỏng" })).toHaveCount(1);
  await expect(rowsWith(page, p.sku).filter({ hasText: "E2E Admin" })).toHaveCount(1);
});

test("trang sản phẩm có khối Lịch sử kho, Xem tất cả lọc theo sản phẩm", async ({ page }) => {
  await page.goto(`/admin/san-pham/${p.productId}`);
  await expect(page.getByRole("heading", { name: "Lịch sử kho" })).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "Vỡ / hỏng" })).toHaveCount(1);

  await page.getByRole("link", { name: "Xem tất cả" }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/kho\\?tab=lich-su&sp=${p.productId}$`));
  await expect(page.getByRole("row").filter({ hasText: p.sku })).toHaveCount(2);
  await expect(page.getByText(`Sản phẩm: ${p.name}`)).toBeVisible();
});

test("dòng Bán từ link báo giá hiện người làm 'Khách (link báo giá)', có link tới đơn", async ({ page }) => {
  await acceptQuoteAsGuest({ phone, variantId: p.variantId, productName: p.name });
  await page.goto(`/admin/kho?tab=lich-su&loai=ban&q=${encodeURIComponent(p.sku)}`);
  const row = rowsWith(page, p.sku);
  await expect(row).toHaveCount(1);
  await expect(row.getByText("Khách (link báo giá)")).toBeVisible();
  await expect(row.getByRole("link", { name: /^Đơn #\d+$/ })).toBeVisible();
});
