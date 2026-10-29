import { defineConfig } from "@playwright/test";

// Test E2E chạy trên dev server (cổng 4000) và DB Supabase trong .env.
// Test tự tạo khách / báo giá / đơn có tên "E2E …" và tự dọn sau khi chạy.
try {
  process.loadEnvFile(".env.local");
} catch {}
try {
  process.loadEnvFile(".env");
} catch {}

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:4000";

export default defineConfig({
  testDir: "e2e",
  // Các test sửa chung một DB (kho, đơn) nên chạy lần lượt
  workers: 1,
  fullyParallel: false,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  reporter: [["list"]],
  use: {
    baseURL,
    // Dùng Chrome cài sẵn trên máy, không phải tải trình duyệt của Playwright
    channel: "chrome",
    locale: "vi-VN",
    timezoneId: "Asia/Ho_Chi_Minh",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "admin",
      dependencies: ["setup"],
      testIgnore: /auth\.setup\.ts/,
      use: { storageState: "e2e/.auth/admin.json" },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: baseURL,
    // Thường đã chạy sẵn `npm run dev`: dùng luôn, không mở server thứ hai
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
