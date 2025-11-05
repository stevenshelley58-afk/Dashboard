/** Loading skeleton components */

export function SyncStatusSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="border border-gray-200 rounded-lg p-4 bg-gray-50 animate-pulse"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-4 w-24 bg-gray-300 rounded" />
                <div className="h-4 w-16 bg-gray-300 rounded" />
                <div className="h-4 w-20 bg-gray-300 rounded" />
              </div>
              <div className="flex items-center gap-4">
                <div className="h-4 w-32 bg-gray-300 rounded" />
                <div className="h-4 w-24 bg-gray-300 rounded" />
                <div className="h-4 w-36 bg-gray-300 rounded" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="h-6 w-48 bg-gray-300 rounded mb-4 animate-pulse" />
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-gray-100 rounded-lg p-4 animate-pulse">
            <div className="h-4 w-24 bg-gray-300 rounded mb-2" />
            <div className="h-8 w-32 bg-gray-300 rounded" />
          </div>
        ))}
      </div>
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-end gap-2">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <div className="h-3 w-20 bg-gray-300 rounded animate-pulse" />
                <div className="h-3 w-24 bg-gray-300 rounded animate-pulse" />
              </div>
              <div className="w-full bg-gray-200 rounded-full h-8 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 animate-pulse">
      <div className="h-6 w-32 bg-gray-300 rounded mb-4" />
      <div className="space-y-3">
        <div className="h-4 w-full bg-gray-200 rounded" />
        <div className="h-4 w-3/4 bg-gray-200 rounded" />
        <div className="h-4 w-1/2 bg-gray-200 rounded" />
      </div>
    </div>
  );
}

