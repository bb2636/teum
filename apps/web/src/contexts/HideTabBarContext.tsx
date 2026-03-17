import { createContext, useContext, useState, ReactNode } from 'react';

type HideTabBarContextValue = {
  hideTabBar: boolean;
  setHideTabBar: (hide: boolean) => void;
};

const HideTabBarContext = createContext<HideTabBarContextValue | null>(null);

export function HideTabBarProvider({ children }: { children: ReactNode }) {
  const [hideTabBar, setHideTabBar] = useState(false);
  return (
    <HideTabBarContext.Provider value={{ hideTabBar, setHideTabBar }}>
      {children}
    </HideTabBarContext.Provider>
  );
}

export function useHideTabBar() {
  const ctx = useContext(HideTabBarContext);
  if (!ctx) return { hideTabBar: false, setHideTabBar: () => {} };
  return ctx;
}
