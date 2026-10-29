import { expect, test, type Page } from "@playwright/test";
import { cleanupCustomer, db, pickVariant, stockOf, testPhone } from "./db";

// Luồng báo giá: lập → gửi → khách mở link → đồng ý → tự thành đơn (trừ kho).
// Thiếu hàng lúc khách đồng ý: dừng ở "Khách đồng ý", shop tạo đơn tay sẽ báo thiếu kho.

const phone = testPhone();
const customerName = `E2E Khách ${phone.slice(-4)}`;

test.describe.configure({ mode: "serial" });
test.use({ permissions: ["clipboard-read", "clipboard-write"] });
test.afterAll(() => cleanupCustomer(phone));

// Next giữ trang vừa rời ở dạng ẩn (để quay lại không mất dữ liệu) nên chỉ lấy ô đang hiện
const field = (page: Page, label: string) => page.getByLabel(label, { exact: true }).filter({ visible: true });

/** Lập báo giá qua kênh Messenger (không mở Zalo), gửi đi; trả về id báo giá */
async function createAndSendQuote(page: Page, sku: string, productName: string, qty: number): Promise<string> {
  await page.goto("/admin/bao-gia/moi");
  await expect(page.getByRole("heading", { name: "Lập báo giá" })).toBeVisible();

  await page.getByRole("radio", { name: "Messenger" }).check({ force: true });
  await field(page, "Tên khách *").fill(customerName);
  await field(page, "SĐT / Zalo").fill(phone);
  await field(page, "Địa chỉ giao").fill("1 Đường Test, Hà Nội");

  await page.getByPlaceholder("Gõ tên hoặc SKU để thêm sản phẩm vào báo giá…").fill(sku);
  await page.getByRole("button", { name: new RegExp(`SKU ${sku}`) }).first().click();
  await page.getByRole("spinbutton", { name: `Số lượng ${productName}` }).filter({ visible: true }).fill(String(qty));
  await field(page, "Lời nhắn cho khách").fill("Báo giá tạo bởi test tự động.");

  await page.getByRole("button", { name: "Lưu & chép lời nhắn" }).click();
  await page.waitForURL(/\/admin\/bao-gia\/[0-9a-f-]{36}/);
  await expect(page.getByRole("heading", { name: /^Báo giá BG-\d+/ })).toBeVisible();
  await expect(page.getByText("Đã gửi", { exact: true }).filter({ visible: true })).toBeVisible();
  return page.url().match(/bao-gia\/([0-9a-f-]{36})/)![1];
}

async function quoteRow(id: string) {
  const { data, error } = await db().from("quotes").select("code, status, total, public_token, order_id").eq("id", id).single();
  if (error) throw error;
  return data;
}

test("khách đồng ý báo giá → tự tạo đơn, trừ kho", async ({ page, browser }) => {
  const variant = await pickVariant(3);
  const stockBefore = await stockOf(variant.id);
  const quoteId = await createAndSendQuote(page, variant.sku, variant.productName, 2);

  const quote = await quoteRow(quoteId);
  expect(quote.status).toBe("sent");
  expect(quote.total).toBe(variant.price * 2);

  // Khách mở link (không đăng nhập)
  const guest = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const customerPage = await guest.newPage();
  await customerPage.goto(`/bg/${quote.public_token}`);
  await expect(customerPage.getByRole("heading", { name: new RegExp(`Báo giá cho ${customerName}`) })).toBeVisible();
  await expect.poll(async () => (await quoteRow(quoteId)).status).toBe("viewed");

  await customerPage.getByRole("button", { name: "Đồng ý & đặt hàng" }).click();
  await expect(customerPage.getByText(/Đã đặt hàng — mã đơn #\d+/)).toBeVisible();
  await guest.close();

  const after = await quoteRow(quoteId);
  expect(after.status).toBe("ordered");
  expect(after.order_id).toBeTruthy();
  expect(await stockOf(variant.id)).toBe(stockBefore - 2);

  const { data: order } = await db().from("orders").select("code, status, total, source_quote_id").eq("id", after.order_id!).single();
  expect(order).toMatchObject({ status: "pending", total: quote.total, source_quote_id: quoteId });

  // Admin thấy báo giá đã thành đơn và đi sang được trang đơn
  await page.reload();
  await expect(page.getByText("Đã thành đơn", { exact: true }).filter({ visible: true })).toBeVisible();
  await page.getByRole("link", { name: "Xem đơn hàng" }).click();
  await expect(page.getByRole("heading", { name: `Đơn ${order!.code}` })).toBeVisible();
  // Mã báo giá hiện ở phụ đề, lịch sử và ghi chú đơn
  await expect(page.getByText(`từ báo giá ${quote.code}`).filter({ visible: true }).first()).toBeVisible();
});

test("thiếu hàng khi khách đồng ý → giữ 'Khách đồng ý', tạo đơn tay báo thiếu kho", async ({ page, browser }) => {
  const variant = await pickVariant(1);
  const stockBefore = await stockOf(variant.id);
  const quoteId = await createAndSendQuote(page, variant.sku, variant.productName, stockBefore + 5);
  const quote = await quoteRow(quoteId);

  const guest = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const customerPage = await guest.newPage();
  await customerPage.goto(`/bg/${quote.public_token}`);
  await customerPage.getByRole("button", { name: "Đồng ý & đặt hàng" }).click();
  await expect(customerPage.getByText("Bạn đã đồng ý báo giá")).toBeVisible();
  await guest.close();

  const after = await quoteRow(quoteId);
  expect(after.status).toBe("accepted");
  expect(after.order_id).toBeNull();
  expect(await stockOf(variant.id)).toBe(stockBefore);

  await page.reload();
  await expect(page.getByText("Khách đồng ý", { exact: true }).filter({ visible: true })).toBeVisible();
  await page.getByRole("button", { name: "Chuyển thành đơn hàng" }).click();
  await page.getByRole("button", { name: "Tạo đơn", exact: true }).click();
  await expect(page.getByText(new RegExp(`SKU ${variant.sku} chỉ còn \\d+ trong kho`)).filter({ visible: true })).toBeVisible();
});

test("danh sách báo giá hiện báo giá test ở tab Đã chốt", async ({ page }) => {
  await page.goto(`/admin/bao-gia?tab=da-chot&q=${phone}`);
  await expect(page.getByRole("heading", { name: "Báo giá" })).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: customerName })).toHaveCount(2);
});
