import { expect, test, type Page } from "@playwright/test";
import { cleanupCustomer, testPhone } from "./db";

// Khách hàng: thêm tay, sửa ghi chú, chặn trùng SĐT, tạo đơn điền sẵn khách, xóa khách chưa có lịch sử

const phone = testPhone();
const customerName = `E2E Khách ${phone.slice(-4)}`;

test.describe.configure({ mode: "serial" });
test.afterAll(() => cleanupCustomer(phone));

// Next giữ trang vừa rời ở dạng ẩn (để quay lại không mất dữ liệu) nên chỉ lấy ô đang hiện
const field = (page: Page, label: string) => page.getByLabel(label, { exact: true }).filter({ visible: true });
const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true }).filter({ visible: true });

test("thêm khách, sửa ghi chú, chặn trùng SĐT, tạo đơn điền sẵn khách, xóa khách", async ({ page }) => {
  await page.goto("/admin/khach-hang/moi");
  await field(page, "Tên khách *").fill(customerName);
  await field(page, "SĐT / Zalo").fill(phone);
  await field(page, "Địa chỉ giao").fill("2 Đường Test, Hà Nội");
  await button(page, "Thêm khách").click();

  await page.waitForURL(/\/admin\/khach-hang\/[0-9a-f-]{36}$/);
  const customerUrl = page.url();
  await expect(page.getByRole("heading", { name: customerName })).toBeVisible();
  await expect(page.getByText("Khách chưa có đơn nào.").filter({ visible: true })).toBeVisible();

  await field(page, "Ghi chú về khách").fill("Khách test tự động");
  await button(page, "Lưu thông tin").click();
  await expect(page.getByText("Đã lưu thông tin khách.").filter({ visible: true })).toBeVisible();

  // Danh sách tìm được theo SĐT
  await page.goto(`/admin/khach-hang?q=${phone}`);
  await expect(page.getByRole("link", { name: customerName })).toBeVisible();

  // Khách thứ hai trùng SĐT bị chặn
  await page.goto("/admin/khach-hang/moi");
  await field(page, "Tên khách *").fill(`${customerName} trùng`);
  await field(page, "SĐT / Zalo").fill(phone.replace(/^(\d{4})/, "$1 "));
  await button(page, "Thêm khách").click();
  await expect(page.getByText(`Số điện thoại này đã thuộc khách “${customerName}”.`).filter({ visible: true })).toBeVisible();

  // Tạo đơn từ trang khách: form điền sẵn khách
  await page.goto(customerUrl);
  await page.getByRole("link", { name: "+ Tạo đơn" }).click();
  await expect(page.getByRole("heading", { name: "Tạo đơn thủ công" })).toBeVisible();
  await expect(field(page, "Tên khách *")).toHaveValue(customerName);

  // Khách chưa có đơn / báo giá thì xóa được
  await page.goto(customerUrl);
  page.once("dialog", (d) => d.accept());
  await button(page, "Xóa khách").click();
  await page.waitForURL(/\/admin\/khach-hang$/);
});
