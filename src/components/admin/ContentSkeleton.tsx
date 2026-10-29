import { Suspense, type ReactNode } from "react";

/**
 * Bọc trang admin trong <Suspense> của riêng trang. Boundary ở layout / loading.tsx không bắt được lúc
 * chuyển giữa các trang con (layout giữ nguyên), nên thiếu bọc này thì bấm link phải chờ đọc xong dữ liệu
 * mới chuyển trang (Next báo "uncached data during … a navigation").
 */
export function withContentSkeleton<P extends object>(Page: (props: P) => Promise<ReactNode>) {
  function SuspendedPage(props: P) {
    return (
      <Suspense fallback={<ContentSkeleton />}>
        <Page {...props} />
      </Suspense>
    );
  }
  return SuspendedPage;
}

/** Khung chờ phần nội dung admin (lúc tải trang lần đầu và lúc chuyển giữa các trang) */
export function ContentSkeleton() {
  return (
    <div aria-busy="true" aria-label="Đang tải" className="flex flex-col gap-5">
      <div className="h-9 w-56 animate-pulse rounded-input bg-line/60" />
      <div className="h-28 animate-pulse rounded-2xl bg-white/70" />
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/70" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-2xl bg-white/70" />
    </div>
  );
}
