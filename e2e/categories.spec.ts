import { expect, test, type Page } from "@playwright/test";
import { db } from "./db";

// Danh mục: thêm danh mục con (đường dẫn tự sinh), hiện trên cửa hàng, đổi tên, đổi thứ tự, xóa; danh mục trên menu bị khóa

const suffix = String(Date.now()).slice(-6);
const name = `E2E Danh mục ${suffix}`;
const slug = `e2e-danh-muc-${suffix}`;

test.describe.configure({ mode: "serial" });
test.afterAll(async () => {
  await db().from("categories").delete().like("slug", "e2e-%");
});

const field = (page: Page, label: string) => page.getByLabel(label, { exact: true }).filter({ visible: true });
const row = (page: Page, text: string) => page.getByRole("listitem").filter({ hasText: text }).filter({ visible: true });

test("thêm, đổi tên, sắp thứ tự và xóa danh mục", async ({ page, browser }) => {
  await page.goto("/admin/danh-muc");
  await expect(page.getByRole("heading", { name: "Danh mục", level: 1 })).toBeVisible();

  await field(page, "Tên danh mục *").fill(name);
  await expect(page.getByRole("textbox", { name: "Đường dẫn *" })).toHaveValue(slug);
  await page.getByRole("combobox", { name: "Thuộc danh mục" }).selectOption({ label: "Đèn" });
  await field(page, "Mô tả").fill("Danh mục tạo bởi test tự động.");
  await page.getByRole("button", { name: "Thêm danh mục", exact: true }).click();
  await expect(page.getByText(`Đã thêm danh mục “${name}”.`)).toBeVisible();
  await expect(row(page, `/danh-muc/${slug}`)).toBeVisible();

  // Cửa hàng thấy ngay danh mục mới (cache "categories" được làm mới)
  const guest = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const shop = await guest.newPage();
  await shop.goto(`/danh-muc/${slug}`);
  await expect(shop.getByRole("heading", { name, level: 1 })).toBeVisible();

  // Danh mục mới nằm cuối nhóm "Đèn": đưa lên một bậc
  const { data: before } = await db().from("categories").select("sort_order").eq("slug", slug).single();
  await page.getByRole("button", { name: `Đưa ${name} lên` }).click();
  await expect.poll(async () => (await db().from("categories").select("sort_order").eq("slug", slug).single()).data?.sort_order).toBeLessThan(before!.sort_order);

  // Đổi tên: đường dẫn giữ nguyên
  await row(page, `/danh-muc/${slug}`).getByRole("button", { name: "Sửa" }).click();
  await field(page, "Tên danh mục *").fill(`${name} mới`);
  await page.getByRole("button", { name: "Lưu danh mục" }).click();
  await expect(page.getByText("Đã lưu danh mục.")).toBeVisible();
  await shop.reload();
  await expect(shop.getByRole("heading", { name: `${name} mới`, level: 1 })).toBeVisible();
  await guest.close();

  // Xóa
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Xóa danh mục" }).click();
  await expect(page.getByText(`Đã xóa danh mục “${name} mới”.`)).toBeVisible();
  await expect(row(page, `/danh-muc/${slug}`)).toHaveCount(0);
});

test("danh mục trên menu cửa hàng không đổi được đường dẫn và không xóa được", async ({ page }) => {
  await page.goto("/admin/danh-muc");
  await row(page, "/danh-muc/den-ban").getByRole("button", { name: "Sửa" }).click();
  await expect(page.getByRole("textbox", { name: "Đường dẫn *" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Xóa danh mục" })).toHaveCount(0);
});
