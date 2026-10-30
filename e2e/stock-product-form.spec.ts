import { expect, test, type Page } from "@playwright/test";
import { cleanupTestProduct, createTestProduct, db, movementsOf, stockOf, type TestProduct } from "./db";

// Form sản phẩm với sổ kho: tồn của phân loại đã có chỉ hiển thị, đổi qua hộp thoại Điều chỉnh;
// lưu mà làm mất phân loại còn hàng thì phải xác nhận; lưu lại nhiều lần không sinh thêm dòng sổ.

let p: TestProduct;

test.describe.configure({ mode: "serial" });
test.beforeAll(async () => {
  p = await createTestProduct({ stock: 5, withColor: true });
});
test.afterAll(() => cleanupTestProduct(p.productId));

/** Dòng trong bảng phân loại, theo nhãn ("Trắng", "Trắng · Nhỏ") */
const variantRow = (page: Page, label: string) => page.getByRole("row").filter({ has: page.getByRole("textbox", { name: `SKU ${label}`, exact: true }) });

/** Ô tên sản phẩm (nhãn "Tên sản phẩm" còn trùng với chỗ khác trên trang) */
const nameInput = (page: Page) => page.locator("#ten");

async function variantsInDb() {
  const { data, error } = await db().from("product_variants").select("id, sku, stock").eq("product_id", p.productId).order("sort_order");
  if (error) throw error;
  return data;
}

test("phân loại đã có: tồn chỉ hiển thị, điều chỉnh qua hộp thoại", async ({ page }) => {
  await page.goto(`/admin/san-pham/${p.productId}`);
  await expect(page.getByRole("heading", { name: "Sửa sản phẩm" })).toBeVisible();
  await expect(page.getByRole("spinbutton", { name: "Tồn kho Trắng" })).toHaveCount(0);

  await page.getByRole("button", { name: "Điều chỉnh tồn Trắng" }).click();
  const dialog = page.getByRole("dialog", { name: "Điều chỉnh tồn Trắng" });
  await dialog.getByLabel("Số thay đổi").fill("-2");
  await dialog.getByLabel("Lý do").selectOption({ label: "Vỡ / hỏng" });
  await expect(dialog.getByText("Tồn sau điều chỉnh: 3")).toBeVisible();
  await dialog.getByRole("button", { name: "Lưu điều chỉnh" }).click();
  await expect(dialog).toBeHidden();

  expect(await stockOf(p.variantId)).toBe(3);
  await expect(variantRow(page, "Trắng").getByText("3", { exact: true })).toBeVisible();
  expect((await movementsOf({ productId: p.productId })).at(-1)).toMatchObject({ kind: "adjust", reason: "damaged", delta: -2 });
});

test("đổi nhóm phân loại làm mất phân loại còn hàng: hủy thì không lưu, đồng ý thì lưu và ghi sổ", async ({ page }) => {
  await page.goto(`/admin/san-pham/${p.productId}`);
  await page.getByRole("button", { name: "Thêm nhóm phân loại" }).click();
  await page.getByRole("textbox", { name: "Thêm giá trị" }).last().fill("Nhỏ");
  await page.getByRole("textbox", { name: "Thêm giá trị" }).last().press("Enter");
  await page.getByRole("spinbutton", { name: "Tồn kho Trắng · Nhỏ" }).fill("4");

  let message = "";
  page.once("dialog", (d) => {
    message = d.message();
    void d.dismiss();
  });
  await page.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect.poll(() => message).toContain(`${p.name} – Trắng: còn 3`);
  expect(await variantsInDb()).toEqual([{ id: p.variantId, sku: p.sku, stock: 3 }]);

  page.once("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Đã lưu." })).toBeVisible();

  const rows = await movementsOf({ productId: p.productId });
  expect(rows).toContainEqual(expect.objectContaining({ kind: "adjust", note: "Xóa biến thể", delta: -3, sku_snapshot: p.sku }));
  expect(rows).toContainEqual(expect.objectContaining({ kind: "initial", delta: 4 }));
  const [created] = await variantsInDb();
  expect(created.stock).toBe(4);
});

test("lưu lần nữa sau khi thêm phân loại mới không sinh thêm dòng sổ", async ({ page }) => {
  await page.goto(`/admin/san-pham/${p.productId}`);
  const before = await variantsInDb();
  const count = (await movementsOf({ productId: p.productId })).length;

  // Lưu lần 1: đổi tên; lưu lần 2 ngay trên form đó (không tải lại trang)
  await nameInput(page).fill(`${p.name} A`);
  await page.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect.poll(async () => (await db().from("products").select("name").eq("id", p.productId).single()).data?.name).toBe(`${p.name} A`);
  await nameInput(page).fill(`${p.name} B`);
  await page.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect.poll(async () => (await db().from("products").select("name").eq("id", p.productId).single()).data?.name).toBe(`${p.name} B`);

  expect(await variantsInDb()).toEqual(before);
  expect(await movementsOf({ productId: p.productId })).toHaveLength(count);
});

test("phân loại mới thêm ngay trên form rồi lưu hai lần: không xóa / tạo lại", async ({ page }) => {
  await page.goto(`/admin/san-pham/${p.productId}`);
  const count = (await movementsOf({ productId: p.productId })).length;

  await page.getByRole("textbox", { name: "Thêm giá trị" }).last().fill("Vừa");
  await page.getByRole("textbox", { name: "Thêm giá trị" }).last().press("Enter");
  await page.getByRole("spinbutton", { name: "Tồn kho Trắng · Vừa" }).fill("2");
  await page.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect.poll(async () => (await variantsInDb()).length).toBe(2);
  const afterFirst = await variantsInDb();

  await nameInput(page).fill(`${p.name} C`);
  await page.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect.poll(async () => (await db().from("products").select("name").eq("id", p.productId).single()).data?.name).toBe(`${p.name} C`);

  expect(await variantsInDb()).toEqual(afterFirst);
  expect(await movementsOf({ productId: p.productId })).toHaveLength(count + 1); // chỉ Tồn đầu +2
});

test("SKU dòng mới gõ thừa khoảng trắng: lưu hai lần vẫn không xóa / tạo lại", async ({ page }) => {
  await page.goto(`/admin/san-pham/${p.productId}`);
  const count = (await movementsOf({ productId: p.productId })).length;

  await page.getByRole("textbox", { name: "Thêm giá trị" }).last().fill("Lớn");
  await page.getByRole("textbox", { name: "Thêm giá trị" }).last().press("Enter");
  await page.getByRole("textbox", { name: "SKU Trắng · Lớn", exact: true }).fill(`${p.sku}-L `);
  await page.getByRole("spinbutton", { name: "Tồn kho Trắng · Lớn" }).fill("1");
  await page.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect.poll(async () => (await variantsInDb()).length).toBe(3);
  const afterFirst = await variantsInDb();
  expect(afterFirst.map((v) => v.sku)).toContain(`${p.sku}-L`);

  await nameInput(page).fill(`${p.name} D`);
  await page.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect.poll(async () => (await db().from("products").select("name").eq("id", p.productId).single()).data?.name).toBe(`${p.name} D`);

  expect(await variantsInDb()).toEqual(afterFirst);
  expect(await movementsOf({ productId: p.productId })).toHaveLength(count + 1); // chỉ Tồn đầu +1
});