// Menu chính của cửa hàng (theo mockup design/Main.html)
export const MAIN_NAV = [
  { href: "/danh-muc/den", label: "Đèn" },
  { href: "/danh-muc/ghe-ban", label: "Ghế & Bàn" },
  { href: "/danh-muc/do-decor", label: "Decor" },
  { href: "/san-pham", label: "Bộ sưu tập" },
  { href: "/#ve-chung-toi", label: "Về chúng tôi" },
] as const;

// 5 ô danh mục ở trang chủ + link ở footer
export const HOME_CATEGORIES = [
  { slug: "den-ban", label: "Đèn bàn" },
  { slug: "den-san", label: "Đèn sàn" },
  { slug: "den-tha", label: "Đèn thả" },
  { slug: "ghe-ban", label: "Ghế & Bàn" },
  { slug: "do-decor", label: "Đồ decor" },
] as const;
