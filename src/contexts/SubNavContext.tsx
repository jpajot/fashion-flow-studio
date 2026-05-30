import { createContext, useContext, useState, useCallback, ReactNode } from "react";

export type SubNavItem = {
  id: string;
  label: string;
  icon?: any;
  count?: number;
  countVariant?: "red" | "default";
};

export type SubNavValue = {
  items: SubNavItem[];
  activeId: string;
  onChange: (id: string) => void;
  pageTitle?: string;
};

type Ctx = {
  subNav: SubNavValue | null;
  registerSubNav: (nav: SubNavValue) => void;
  clearSubNav: () => void;
};

const SubNavContext = createContext<Ctx | null>(null);

export function SubNavProvider({ children }: { children: ReactNode }) {
  const [subNav, setSubNav] = useState<SubNavValue | null>(null);
  const registerSubNav = useCallback((nav: SubNavValue) => setSubNav(nav), []);
  const clearSubNav = useCallback(() => setSubNav(null), []);
  return (
    <SubNavContext.Provider value={{ subNav, registerSubNav, clearSubNav }}>
      {children}
    </SubNavContext.Provider>
  );
}

export function useSubNav() {
  const ctx = useContext(SubNavContext);
  if (!ctx) throw new Error("useSubNav must be used within SubNavProvider");
  return ctx;
}
