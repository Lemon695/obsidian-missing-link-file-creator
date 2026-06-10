import { useEffect } from "react";
import { Events, EventRef } from "obsidian";

/**
 * Subscribe to an Obsidian event and auto-cleanup on unmount.
 * Works with app.vault, app.workspace, app.metadataCache, etc.
 */
export function useObsidianEvent(
  emitter: Events,
  eventName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  callback: (...args: any[]) => void,
  deps: unknown[] = []
) {
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ref: EventRef = (emitter as any).on(eventName, callback);
    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (emitter as any).offref(ref);
    };
  }, [emitter, eventName, ...deps]);
}
