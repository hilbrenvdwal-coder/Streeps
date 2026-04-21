import React, { createContext, useContext, useState, ReactNode } from 'react';

interface HomeReadyContextType {
  homeReady: boolean;
  setHomeReady: (ready: boolean) => void;
}

const HomeReadyContext = createContext<HomeReadyContextType>({
  homeReady: false,
  setHomeReady: () => {},
});

export function HomeReadyProvider({ children }: { children: ReactNode }) {
  const [homeReady, setHomeReady] = useState(false);
  return (
    <HomeReadyContext.Provider value={{ homeReady, setHomeReady }}>
      {children}
    </HomeReadyContext.Provider>
  );
}

export function useHomeReady() {
  return useContext(HomeReadyContext);
}
