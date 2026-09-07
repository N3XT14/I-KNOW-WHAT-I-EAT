"use client";

import { useEffect, useRef, useState } from "react";
import BottomNav from "@/components/nav/BottomNav";
import { FrameContainerContext } from "@/components/providers/FrameContainer";

export default function AppFrame({ children }: { children: React.ReactNode }) {
  const frameRef = useRef<HTMLDivElement>(null);
  // Refs don't trigger re-renders, so the context value (which needs to
  // reach the Dialog component as an actual reactive value) is mirrored
  // into state once the node exists after mount.
  const [container, setContainer] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    setContainer(frameRef.current);
  }, []);

  return (
    <div
      ref={frameRef}
      className="relative mx-auto flex h-dvh w-full max-w-md flex-col md:h-[812px] md:w-[390px] md:transform md:overflow-hidden md:rounded-[2.5rem] md:border-[10px] md:border-[var(--color-frame-bezel)] md:shadow-2xl"
    >
      <div className="hidden shrink-0 items-center justify-center bg-[var(--color-background)] py-1.5 md:flex">
        <div className="h-1 w-16 rounded-full bg-[var(--color-on-surface)]/25" />
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-[var(--color-background)]">
        <FrameContainerContext.Provider value={container}>
          {children}
        </FrameContainerContext.Provider>
      </div>
      <BottomNav />
    </div>
  );
}