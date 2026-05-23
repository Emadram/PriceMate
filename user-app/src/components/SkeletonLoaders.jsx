const Skeleton = ({ className }) => (
  <div className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded-xl ${className}`} />
);

export const ProductCardSkeleton = () => (
  <div className="bg-white dark:bg-gray-800 rounded-2xl sm:rounded-3xl p-2.5 sm:p-4 shadow-soft border border-transparent">
    <div className="flex items-center gap-2.5 sm:gap-4 md:gap-5">
      <Skeleton className="w-[4.25rem] h-[4.25rem] sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-xl sm:rounded-2xl flex-shrink-0" />
      <div className="flex-1 min-w-0 flex flex-col h-full py-0.5 sm:py-1">
        <div className="mb-auto">
          <Skeleton className="h-4.5 w-3/4 mb-2" />
          <Skeleton className="h-3 w-1/2" />
        </div>
        <div className="flex flex-col gap-2.5 mt-3 sm:mt-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1">
            <Skeleton className="h-2 w-16" />
            <Skeleton className="h-6 w-24" />
          </div>
          <Skeleton className="h-8 w-full sm:w-28 rounded-full" />
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
