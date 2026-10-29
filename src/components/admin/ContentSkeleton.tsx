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
