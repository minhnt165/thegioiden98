import "server-only";

import sanitizeHtml from "sanitize-html";

// Mô tả sản phẩm là HTML đơn giản từ trình soạn thảo ở admin. Luôn lọc trước khi render.
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ["p", "br", "strong", "b", "em", "i", "u", "ul", "ol", "li", "a", "h3", "blockquote"],
  allowedAttributes: { a: ["href", "target", "rel"] },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: "noopener noreferrer" }),
  },
};

export function sanitizeRichText(html: string | null | undefined): string {
  return html ? sanitizeHtml(html, OPTIONS).trim() : "";
}

/** Tách đoạn đầu (trích dẫn lớn ở mục "Câu chuyện") khỏi phần còn lại */
export function splitStory(html: string | null | undefined): { quote: string | null; body: string } {
  const clean = sanitizeRichText(html);
  const match = clean.match(/^<p>([\s\S]*?)<\/p>/);
  if (!match) return { quote: null, body: clean };
  const quote = sanitizeHtml(match[1], { allowedTags: [], allowedAttributes: {} }).trim();
  return { quote: quote || null, body: clean.slice(match[0].length).trim() };
}

/** Bỏ toàn bộ thẻ, lấy chữ thuần (dùng làm mô tả ngắn khi chưa có) */
export function plainText(html: string | null | undefined, maxLength = 200): string {
  const text = sanitizeHtml(html ?? "", { allowedTags: [], allowedAttributes: {} }).replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trimEnd()}…` : text;
}
