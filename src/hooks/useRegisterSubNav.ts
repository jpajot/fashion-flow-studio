import { useEffect, useRef } from "react";
import { useSubNav, SubNavItem } from "@/contexts/SubNavContext";

const PENDING_KEY = "pendingSubNavId";

export function useRegisterSubNav(
  items: SubNavItem[],
  activeId: string,
  onChange: (id: string) => void,
  pageTitle?: string,
) {
  const { registerSubNav, clearSubNav } = useSubNav();
  const appliedPending = useRef(false);

  useEffect(() => {
    if (!appliedPending.current) {
      appliedPending.current = true;
      const pending = sessionStorage.getItem(PENDING_KEY);
      if (pending && items.some((i) => i.id === pending)) {
        sessionStorage.removeItem(PENDING_KEY);
        onChange(pending);
        registerSubNav({ items, activeId: pending, onChange, pageTitle });
        return;
      }
    }
    registerSubNav({ items, activeId, onChange, pageTitle });
    return () => clearSubNav();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, pageTitle, JSON.stringify(items.map((i) => ({ id: i.id, label: i.label, count: i.count })))]);
}
