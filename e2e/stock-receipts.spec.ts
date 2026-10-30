import { expect, test } from "@playwright/test";
import { cleanupTestProduct, createTestProduct, stockOf, type TestProduct } from "./db";

// Phiếu nhập kho: lập phiếu (tìm cả sản phẩm nháp), cộng kho, xem phiếu, có trong danh sách và lịch sử.

let p: TestProduct;

test.describe.configure({ mode: "serial" });
test.beforeAll(async () => {
  p = await createTestProduct({ stock: 2 }); // sản phẩm test để nháp
});
test.afterAll(() => cleanupTestProduct(p.productId));

test("lập phiếu nhập → cộng kho, mở trang phiếu, có trong danh sách và lịch sử", async ({ page }) => {
  const before = await stockOf(p.variantId);
  await page.goto("/admin/kho");
  await page.getByRole("link", { name: "+ Tạo phiếu nhập" }).click();
  await expect(page.getByRole("heading", { name: "Tạo phiếu nhập" })).toBeVisible();

  await page.getByPlaceholder("Gõ tên hoặc SKU để thêm vào phiếu…").fill(p.sku);
  await page.getByRole("button", { name: new RegExp(`SKU ${p.sku}`) }).first().click();
  await page.getByRole("spinbutton", { name: `Số lượng ${p.sku}` }).fill("4");
  await expect(page.getByText(`Tồn sau nhập: ${before + 4}`)).toBeVisible();
  await page.getByLabel("Ghi chú (nhà cung cấp, số hóa đơn…)").fill("E2E nhập hàng");
  await page.getByRole("button", { name: "Lưu phiếu nhập" }).click();

  await page.waitForURL(/\/admin\/kho\/nhap\/[0-9a-f-]{36}$/);
  const heading = page.getByRole("heading", { name: /^Phiếu nhập PN-\d{4,}$/ });
  await expect(heading).toBeVisible();
  const code = (await heading.textContent())!.replace("Phiếu nhập ", "");
  expect(await stockOf(p.variantId)).toBe(before + 4);
  // Next giữ trang form vừa rời ở dạng ẩn nên chỉ lấy phần tử đang hiện
  await expect(page.getByRole("row").filter({ hasText: p.sku }).filter({ visible: true })).toContainText("4");
  await expect(page.getByText("E2E nhập hàng", { exact: true }).filter({ visible: true })).toBeVisible();

  // Danh sách phiếu: tìm theo ghi chú không dấu
  await page.goto(`/admin/kho?q=${encodeURIComponent("e2e nhap hang")}`);
  const row = page.getByRole("row").filter({ hasText: code });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText(p.name);

  // Lịch sử: dòng Nhập hàng link tới phiếu
  await page.goto(`/admin/kho?tab=lich-su&loai=nhap&q=${encodeURIComponent(p.sku)}`);
  await page.getByRole("link", { name: code }).click();
  await expect(page.getByRole("heading", { name: `Phiếu nhập ${code}` })).toBeVisible();
});

test("phiếu rỗng báo lỗi, không lưu", async ({ page }) => {
  await page.goto("/admin/kho/nhap/moi");
  await page.getByRole("button", { name: "Lưu phiếu nhập" }).click();
  await expect(page.getByText("Thêm ít nhất 1 sản phẩm vào phiếu.")).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/kho\/nhap\/moi$/);
});

test("chọn lại phân loại đã có trong phiếu thì cộng thêm 1", async ({ page }) => {
  await page.goto("/admin/kho/nhap/moi");
  const search = page.getByPlaceholder("Gõ tên hoặc SKU để thêm vào phiếu…");
  for (let i = 0; i < 2; i++) {
    await search.fill(p.sku);
    await page.getByRole("button", { name: new RegExp(`SKU ${p.sku}`) }).first().click();
  }
  await expect(page.getByRole("spinbutton", { name: `Số lượng ${p.sku}` })).toHaveValue("2");
});

test("mã phiếu không tồn tại → trang không tìm thấy", async ({ page }) => {
  await page.goto("/admin/kho/nhap/00000000-0000-0000-0000-000000000000");
  await expect(page.getByRole("heading", { name: "Phiếu nhập PN-" })).toHaveCount(0);
  await expect(page.getByText(/không tìm thấy/i).first()).toBeVisible();
});
