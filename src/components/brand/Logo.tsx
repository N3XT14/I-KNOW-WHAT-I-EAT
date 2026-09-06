"use client";

import Image from "next/image";

type LogoSize = "sm" | "md" | "lg";

const ICON_SIZE: Record<LogoSize, string> = {
  sm: "h-7 w-7",
  md: "h-9 w-9",
  lg: "h-11 w-11",
};

const WORDMARK_HEIGHT: Record<LogoSize, string> = {
  sm: "h-7",
  md: "h-9",
  lg: "h-14",
};

export default function Logo({
  className = "",
  collapsed = false,
  size = "md",
}: {
  className?: string;
  collapsed?: boolean;
  size?: LogoSize;
}) {
  return (
    <span className={`flex min-w-0 items-center ${className}`}>
      {collapsed ? (
        <Image
          src="/assets/riva-icon.png"
          alt="Riva"
          width={32}
          height={32}
          className={`${ICON_SIZE[size]} shrink-0 object-contain`}
          priority
        />
      ) : (
        <Image
          src="/assets/riva-logo-vertical-bold.png"
          alt="Riva"
          width={332}
          height={339}
          className={`${WORDMARK_HEIGHT[size]} w-auto object-contain`}
          priority
        />
      )}
    </span>
  );
}