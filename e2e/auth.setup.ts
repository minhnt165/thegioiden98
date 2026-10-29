import { expect, test as setup } from "@playwright/test";
import { adminCredentials, ensureAdminUser } from "./db";

// Đăng nhập một lần bằng tài khoản admin test, lưu phiên cho các test admin dùng lại
setup("đăng nhập admin", async ({ page }) => {
  await ensureAdminUser();
  const { email, password } = adminCredentials();

  await page.goto("/admin/dang-nhap");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mật khẩu").fill(password);
  await page.getByRole("button", { name: /Đăng nhập/ }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  await page.context().storageState({ path: "e2e/.auth/admin.json" });
});
