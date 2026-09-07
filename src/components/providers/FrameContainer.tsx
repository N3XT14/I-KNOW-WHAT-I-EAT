"use client";

import { createContext, useContext } from "react";

// Radix's Dialog.Portal renders into document.body by default — a DOM
// *sibling* of the phone-frame div, not a descendant. That means neither
// the frame's `overflow-hidden`/rounded clipping nor its `transform`
// (which exists specifically to give fixed-position descendants a
// containing block) ever applied to dialogs: they were always painting
// over the whole browser viewport, just happening to roughly line up with
// the frame by coincidence of both being centered. This context exposes
// the frame's actual DOM node so Dialog.tsx can portal into it instead,
// making dialogs genuinely confined to the phone screen on desktop.
export const FrameContainerContext = createContext<HTMLDivElement | null>(null);

export function useFrameContainer() {
  return useContext(FrameContainerContext);
}