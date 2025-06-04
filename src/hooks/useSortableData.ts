import { useState, useMemo } from "react";

export type SortDirection = "asc" | "desc";

export interface SortConfig<T> {
  key: keyof T;
  direction: SortDirection;
}

export function useSortableData<T>(items: T[], defaultConfig?: SortConfig<T>) {
  const [sortConfig, setSortConfig] = useState<SortConfig<T> | undefined>(defaultConfig);

  const sortedItems = useMemo(() => {
    if (!sortConfig) return items;
    const { key, direction } = sortConfig;
    return [...items].sort((a: any, b: any) => {
      if (a[key] < b[key]) return direction === "asc" ? -1 : 1;
      if (a[key] > b[key]) return direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [items, sortConfig]);

  const requestSort = (key: keyof T) => {
    let direction: SortDirection = "asc";
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  return { items: sortedItems, requestSort, sortConfig };
}
