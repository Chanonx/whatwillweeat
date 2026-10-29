import { Skeleton } from "./ui";

/** โครงหน้ากลุ่มระหว่างโหลด — วางตำแหน่งเหมือนของจริง หน้าจะไม่กระตุกตอนข้อมูลมา */
export function GroupSkeleton() {
  return (
    <main className="mx-auto min-h-dvh max-w-md px-5 pt-4" aria-busy="true" aria-label="กำลังโหลด">
      <div className="mb-6 flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-4 w-12" />
      </div>
      <div className="mb-8 flex gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex w-12 flex-col items-center gap-2">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-3 w-10" />
          </div>
        ))}
      </div>
      <div className="mb-8 grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-1 rounded-full" />
        ))}
      </div>
      <Skeleton className="mb-2 h-7 w-48" />
      <Skeleton className="mb-6 h-4 w-64" />
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-12 rounded-xl" />
        ))}
      </div>
    </main>
  );
}

export function DashboardSkeleton() {
  return (
    <main className="mx-auto min-h-dvh max-w-md px-5 py-6" aria-busy="true" aria-label="กำลังโหลด">
      <div className="mb-10 flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-full" />
        <Skeleton className="h-4 w-28" />
      </div>
      <Skeleton className="mb-6 h-8 w-36" />
      <div className="space-y-4 border-y border-line py-4">
        {[0, 1].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
    </main>
  );
}

export function JoinSkeleton() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5" aria-busy="true" aria-label="กำลังโหลด">
      <Skeleton className="mb-3 h-4 w-32" />
      <Skeleton className="mb-3 h-9 w-56" />
      <Skeleton className="mb-8 h-4 w-20" />
      <Skeleton className="h-12 rounded-xl" />
    </main>
  );
}
