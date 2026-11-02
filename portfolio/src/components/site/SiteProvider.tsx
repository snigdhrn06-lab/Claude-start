"use client";
/** Shared client state for the public site (intro completion → hero animation start). */
import { MotionConfig } from "framer-motion";
import { createContext, useContext, useState, type ReactNode } from "react";

const Ctx = createContext<{ introDone: boolean; setIntroDone: (v: boolean) => void }>({ introDone: true, setIntroDone: () => {} });

export function SiteProvider({ children, introEnabled }: { children: ReactNode; introEnabled: boolean }) {
  const [introDone, setIntroDone] = useState(!introEnabled);
  return (
    <Ctx.Provider value={{ introDone, setIntroDone }}>
      {/* reducedMotion="user": transforms are disabled for visitors who prefer reduced motion */}
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </Ctx.Provider>
  );
}

export const useSite = () => useContext(Ctx);
