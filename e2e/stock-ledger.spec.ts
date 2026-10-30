import { expect, test } from "@playwright/test";
import {
  acceptQuoteAsGuest,
  adminDb,
  cleanupCustomer,
  cleanupTestProduct,
  createTestProduct,
  db,
  movementsOf,
  stockOf,
  testPhone,
  testProductPayload,
  type TestProduct,
} from "./db";

// Sổ kho ở tầng DB: mọi đường đổi tồn (lưu sản phẩm, điều chỉnh, phiếu nhập, đơn, link báo giá, sửa thẳng bảng)
// đều có dòng trong stock_movements. Gọi hàm admin_* bằng phiên admin test, đọc kết quả bằng service role.

const phone = testPhone();
let p: TestProduct;
let variantId: string;
let adminId: string;

test.describe.configure({ mode: "serial" });
test.afterAll(async () => {
  await cleanupCustomer(phone);
  if (p) await cleanupTestProduct(p.productId);
});

const order = (id: string | null, qty: number) => ({
  ...(id ? { id } : {}),
  customer: { name: `E2E Khách ${phone.slice(-4)}`, phone, address: "1 Đường Test, Hà Nội" },
  channel: "zalo",
  payment: "cod",
  discount: 0,
  shipping_fee: 0,
  note: "",
  items: [{ variant_id: variantId, qty, unit_price: 100000 }],
});

test("biến thể mới có tồn → dòng Tồn đầu", async () => {
  const admin = await adminDb();
  adminId = (await admin.auth.getUser()).data.user!.id;
  p = await createTestProduct({ stock: 5 });

  const rows = await movementsOf({ productId: p.productId });
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ kind: "initial", delta: 5, stock_after: 5, sku_snapshot: p.sku, name_snapshot: p.name, created_by: adminId });
});

test("lưu sản phẩm không đổi tồn biến thể cũ", async () => {
  const admin = await adminDb();
  const { error } = await admin.rpc("admin_save_product", { p: testProductPayload(p, [{ id: p.variantId, sku: p.sku, stock: 99 }]) });
  expect(error).toBeNull();
  expect(await stockOf(p.variantId)).toBe(5);
  expect(await movementsOf({ productId: p.productId })).toHaveLength(1);
});

test("xóa biến thể còn tồn → Điều chỉnh −N 'Xóa biến thể'", async () => {
  const admin = await adminDb();
  const { error } = await admin.rpc("admin_save_product", { p: testProductPayload(p, [{ id: null, sku: `${p.sku}-B`, stock: 2 }]) });
  expect(error).toBeNull();

  const rows = await movementsOf({ productId: p.productId });
  expect(rows).toContainEqual(
    expect.objectContaining({ kind: "adjust", reason: "other", note: "Xóa biến thể", delta: -5, stock_after: 0, variant_id: null, sku_snapshot: p.sku }),
  );
  expect(rows).toContainEqual(expect.objectContaining({ kind: "initial", delta: 2, stock_after: 2, sku_snapshot: `${p.sku}-B` }));

  const { data } = await db().from("product_variants").select("id").eq("product_id", p.productId).single();
  variantId = data!.id;
});

test("điều chỉnh: trừ được, không cho âm, Khác phải có ghi chú, không cho 0", async () => {
  const admin = await adminDb();
  const ok = await admin.rpc("admin_adjust_stock", { p_variant_id: variantId, p_delta: -1, p_reason: "damaged" });
  expect(ok.error).toBeNull();
  expect(ok.data).toBe(1);

  const negative = await admin.rpc("admin_adjust_stock", { p_variant_id: variantId, p_delta: -5, p_reason: "count" });
  expect(negative.error?.message).toBe("Tồn sau điều chỉnh không được âm (hiện còn 1).");
  const noNote = await admin.rpc("admin_adjust_stock", { p_variant_id: variantId, p_delta: 1, p_reason: "other" });
  expect(noNote.error?.message).toBe('Chọn "Khác" thì cần ghi chú lý do.');
  const zero = await admin.rpc("admin_adjust_stock", { p_variant_id: variantId, p_delta: 0, p_reason: "count" });
  expect(zero.error?.message).toBe("Nhập số thay đổi khác 0.");

  expect(await stockOf(variantId)).toBe(1);
  const last = (await movementsOf({ productId: p.productId })).at(-1);
  expect(last).toMatchObject({ kind: "adjust", reason: "damaged", delta: -1, stock_after: 1, variant_id: variantId, created_by: adminId });
});

test("phiếu nhập: mã PN-xxxx, cộng kho, gộp dòng trùng, ghi sổ Nhập hàng", async () => {
  const admin = await adminDb();
  const before = await stockOf(variantId);
  const { data, error } = await admin.rpc("admin_create_stock_receipt", {
    p: { note: "E2E nhập", items: [{ variant_id: variantId, qty: 2 }, { variant_id: variantId, qty: 3 }] },
  });
  expect(error).toBeNull();
  const receipt = data as { id: string; code: string };
  expect(receipt.code).toMatch(/^PN-\d{4,}$/);
  expect(await stockOf(variantId)).toBe(before + 5);

  expect(await movementsOf({ receiptId: receipt.id })).toEqual([
    expect.objectContaining({ kind: "receipt", delta: 5, stock_after: before + 5, note: receipt.code, created_by: adminId }),
  ]);
  const { data: items } = await db().from("stock_receipt_items").select("qty, sku_snapshot").eq("receipt_id", receipt.id);
  expect(items).toEqual([{ qty: 5, sku_snapshot: `${p.sku}-B` }]);

  const empty = await admin.rpc("admin_create_stock_receipt", { p: { note: "E2E rỗng", items: [] } });
  expect(empty.error?.message).toBe("Phiếu nhập cần ít nhất 1 sản phẩm.");
  const zeroQty = await admin.rpc("admin_create_stock_receipt", { p: { note: "E2E 0", items: [{ variant_id: variantId, qty: 0 }] } });
  expect(zeroQty.error?.message).toBe("Số lượng nhập phải từ 1 đến 100000.");
});

test("tạo đơn → Bán; sửa đơn → Hủy / trả + Bán; hủy đơn → Hủy / trả", async () => {
  const admin = await adminDb();
  const start = await stockOf(variantId);

  const created = await admin.rpc("admin_save_order", { p: order(null, 2) });
  expect(created.error).toBeNull();
  const { id, code } = created.data as { id: string; code: string };
  expect(await movementsOf({ orderId: id })).toEqual([
    expect.objectContaining({ kind: "sale", delta: -2, stock_after: start - 2, created_by: adminId }),
  ]);

  const edited = await admin.rpc("admin_save_order", { p: order(id, 1) });
  expect(edited.error).toBeNull();
  const afterEdit = await movementsOf({ orderId: id });
  expect(afterEdit).toHaveLength(3);
  expect(afterEdit[1]).toMatchObject({ kind: "return", delta: 2, note: `Sửa đơn ${code}` });
  expect(afterEdit[2]).toMatchObject({ kind: "sale", delta: -1, stock_after: start - 1 });

  const cancelled = await admin.rpc("admin_set_order_status", { p_ids: [id], p_status: "cancelled" });
  expect(cancelled.error).toBeNull();
  expect((await movementsOf({ orderId: id })).at(-1)).toMatchObject({ kind: "return", delta: 1, note: "Hủy đơn", stock_after: start });
  expect(await stockOf(variantId)).toBe(start);
});

test("khách đồng ý trên link báo giá → Bán, người làm trống", async () => {
  const orderId = await acceptQuoteAsGuest({ phone, variantId, productName: p.name });
  expect(await movementsOf({ orderId })).toEqual([expect.objectContaining({ kind: "sale", delta: -1, created_by: null })]);
});

test("sửa thẳng bảng (service role) vẫn ghi sổ", async () => {
  const stock = await stockOf(variantId);
  await db().from("product_variants").update({ stock: stock + 1 }).eq("id", variantId);
  expect((await movementsOf({ productId: p.productId })).at(-1)).toMatchObject({
    kind: "adjust",
    reason: "other",
    note: "Sửa trực tiếp",
    delta: 1,
    stock_after: stock + 1,
    created_by: null,
  });
});
