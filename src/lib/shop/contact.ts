// Link liên hệ Zalo / Messenger / Instagram. Dùng được cả ở server và client.

/** "0912 345 678" → "0912345678" */
export function normalizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, "");
}

/**
 * Zalo không hỗ trợ điền sẵn nội dung qua link, nên nút Zalo chép tin nhắn vào clipboard
 * rồi mở cuộc trò chuyện để khách dán vào.
 */
export function zaloLink(phone: string): string | null {
  const digits = normalizePhone(phone);
  return digits ? `https://zalo.me/${digits}` : null;
}

/** m.me hỗ trợ tham số ?text= để điền sẵn tin nhắn */
export function messengerLink(messengerUrl: string, text?: string): string | null {
  const base = messengerUrl.trim();
  if (!base) return null;
  if (!text) return base;
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}text=${encodeURIComponent(text)}`;
}

export function instagramLink(instagramUrl: string): string | null {
  const url = instagramUrl.trim();
  return url || null;
}

export const GENERAL_MESSAGE = "Chào shop, mình cần tư vấn ạ.";

/** Tin nhắn đặt hàng có sẵn tên SP + phân loại đã chọn */
export function buildOrderMessage(input: {
  productName: string;
  variantLabel?: string | null;
  sku?: string | null;
  price?: string | null;
  url?: string | null;
}): string {
  const lines = [`Chào shop, mình muốn đặt: ${input.productName}`];
  if (input.variantLabel) lines.push(`Phân loại: ${input.variantLabel}`);
  if (input.sku) lines.push(`Mã SP: ${input.sku}`);
  if (input.price) lines.push(`Giá: ${input.price}`);
  if (input.url) lines.push(input.url);
  return lines.join("\n");
}
