"use client";

import { useEffect } from "react";
import { setupInteractionTracking } from "@/lib/accessibility/keyboard-navigation";

export function InteractionTracker() {
  useEffect(() => {
    if (typeof window !== "undefined") {
      setupInteractionTracking();
    }
  }, []);

  // This component doesn't render anything
  return null;
}
