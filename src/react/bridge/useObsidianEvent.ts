import { useEffect } from "react";
import { App, Events, EventRef } from "obsidian";

/**
 * Subscribe to an Obsidian event and auto-cleanup on unmount.
 * Works with app.vault, app.workspace, app.metadataCache, etc.
 */
export function useObsidianEvent(
  emitter: Events,
  eventName: string,
  callback: (...args: any[]) => void,
  deps: any[] = []
) {
  useEffect(() => {
    const ref: EventRef = (emitter as any).on(eventName, callback);
    return () => {
      (emitter as any).offref(ref);
    };
  }, [emitter, eventName, ...deps]);
}
