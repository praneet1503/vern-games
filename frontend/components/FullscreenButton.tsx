"use client";

import React from "react";

type Props = {
  targetId: string;
};

type FullscreenRequestable = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
  msRequestFullscreen?: () => Promise<void> | void;
};

export default function FullscreenButton({ targetId }: Props) {
  const enterFullscreen = async () => {
    try {
      const el = document.getElementById(targetId);
      if (!el) {
        console.warn("Fullscreen target not found:", targetId);
        return;
      }

      const requestable = el as FullscreenRequestable;
      const request =
        requestable.requestFullscreen ??
        requestable.webkitRequestFullscreen ??
        requestable.msRequestFullscreen;

      if (request) {
        await request.call(requestable);
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch (err) {
      console.error("Failed to enter fullscreen", err);
    }
  };

  return (
    <button
      type="button"
      className="fullscreen-btn"
      onClick={enterFullscreen}
      aria-label="Enter fullscreen"
      title="Enter fullscreen"
    >
      ⤢
    </button>
  );
}
