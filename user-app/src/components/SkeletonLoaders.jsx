const Skeleton = ({ className }) => (
  <div className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded-xl ${className}`} />
);

export const ProductCardSkeleton = () => (
  <div className="bg-white dark:bg-gray-800 rounded-3xl p-4 shadow-soft border border-transparent">
    <div className="flex items-center gap-5">
      <Skeleton className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl flex-shrink-0" />
      <div className="flex-1 min-w-0 flex flex-col h-full py-1">
        <div className="mb-auto">
          <Skeleton className="h-5 w-3/4 mb-2" />
          <Skeleton className="h-3 w-1/2" />
        </div>
        <div className="flex items-end justify-between mt-4">
          <div className="flex flex-col gap-1">
            <Skeleton className="h-2 w-16" />
            <Skeleton className="h-6 w-24" />
          </div>
          <Skeleton className="h-8 w-28 rounded-full" />
        </div>
      </div>
    </div>
  </div>
);

export const CategorySkeleton = () => (
  <div className="flex flex-col items-center gap-2">
    <Skeleton className="w-16 h-16 rounded-2xl" />
    <Skeleton className="h-3 w-12" />
  </div>
);
