import { expect, test } from "@playwright/test";
import { acceptQuoteAsGuest, adminDb, cleanupCustomer, cleanupTestProduct, createTestProduct, db, testPhone, type TestProduct } from "./db";

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

test("admin chưa có họ tên: dòng của admin hiện 'Admin', không nhầm thành khách / hệ thống", async ({ page }) => {
  const admin = await adminDb();
  const adminId = (await admin.auth.getUser()).data.user!.id;
  await db().from("profiles").update({ full_name: null }).eq("id", adminId);
  try {
    await admin.rpc("admin_adjust_stock", { p_variant_id: p.variantId, p_delta: 1, p_reason: "count" });
    const created = await admin.rpc("admin_save_order", {
      p: {
        customer: { name: `E2E Khách ${phone.slice(-4)}`, phone, address: "" },
        channel: "zalo",
        payment: "cod",
        discount: 0,
        shipping_fee: 0,
        note: "",
        items: [{ variant_id: p.variantId, qty: 1, unit_price: 100000 }],
      },
    });
    expect(created.error).toBeNull();
    const receipt = await admin.rpc("admin_create_stock_receipt", { p: { note: "E2E không tên", items: [{ variant_id: p.variantId, qty: 1 }] } });
    expect(receipt.error).toBeNull();

    await page.goto(`/admin/kho?tab=lich-su&loai=ban&q=${encodeURIComponent((created.data as { code: string }).code)}`);
    await expect(rowsWith(page, p.sku).getByText("Admin", { exact: true })).toBeVisible();
    await page.goto(`/admin/kho?tab=lich-su&loai=dieu-chinh&q=${encodeURIComponent(p.sku)}`);
    await expect(rowsWith(page, "Kiểm kê lệch").getByText("Admin", { exact: true })).toBeVisible();
    await page.goto(`/admin/kho/nhap/${(receipt.data as { id: string }).id}`);
    await expect(page.getByText(/· Admin$/).filter({ visible: true })).toBeVisible();
  } finally {
    await db().from("profiles").update({ full_name: "E2E Admin" }).eq("id", adminId);
  }
});

test("dòng Bán từ link báo giá hiện người làm 'Khách (link báo giá)', có link tới đơn", async ({ page }) => {
  await acceptQuoteAsGuest({ phone, variantId: p.variantId, productName: p.name });
  await page.goto(`/admin/kho?tab=lich-su&loai=ban&q=${encodeURIComponent(p.sku)}`);
  // Test trước có thêm một dòng Bán của admin cho cùng SKU
  const row = rowsWith(page, p.sku).filter({ hasText: "Khách (link báo giá)" });
  await expect(row).toHaveCount(1);
  await expect(row.getByRole("link", { name: /^Đơn #\d+$/ })).toBeVisible();
});
