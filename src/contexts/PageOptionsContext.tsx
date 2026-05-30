import { createContext, useContext, useState, ReactNode } from "react";

export type PageOptionItem = {
  label?: string;
  icon?: any;
  onClick?: () => void;
  className?: string;
  badge?: string | number;
  divider?: boolean;
  custom?: ReactNode;
};

export type PageOptionsValue = {
  items: PageOptionItem[];
  customContent?: ReactNode;
  filterBadge?: boolean;
};

type Ctx = {
  options: PageOptionsValue | null;
  setOptions: (o: PageOptionsValue | null) => void;
};

const PageOptionsContext = createContext<Ctx | null>(null);

export function PageOptionsProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<PageOptionsValue | null>(null);
  return (
    <PageOptionsContext.Provider value={{ options, setOptions }}>
      {children}
    </PageOptionsContext.Provider>
  );
}

export function usePageOptions() {
  const ctx = useContext(PageOptionsContext);
  if (!ctx) throw new Error("usePageOptions must be used within PageOptionsProvider");
  return ctx;
}
