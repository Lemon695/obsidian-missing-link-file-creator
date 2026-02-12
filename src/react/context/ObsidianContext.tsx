import React, { createContext, useContext, useSyncExternalStore } from "react";
import { App, TFile } from "obsidian";
import type CheckAndCreateMDFilePlugin from "@/main";
import type { CreateFileSettings } from "@/settings/settings";

export interface ObsidianContextValue {
  app: App;
  plugin: CheckAndCreateMDFilePlugin;
  settings: CreateFileSettings;
  activeFile: TFile | null;
}

const ObsidianContext = createContext<ObsidianContextValue | null>(null);

export function useObsidian(): ObsidianContextValue {
  const ctx = useContext(ObsidianContext);
  if (!ctx) throw new Error("useObsidian must be used within ObsidianProvider");
  return ctx;
}

export function useActiveFile(app: App): TFile | null {
  return useSyncExternalStore(
    (callback) => {
      const ref = app.workspace.on("active-leaf-change", callback);
      return () => app.workspace.offref(ref);
    },
    () => app.workspace.getActiveFile()
  );
}

interface ObsidianProviderProps {
  app: App;
  plugin: CheckAndCreateMDFilePlugin;
  settings: CreateFileSettings;
  children?: React.ReactNode;
}

export function ObsidianProvider({ app, plugin, settings, children }: ObsidianProviderProps) {
  const activeFile = useActiveFile(app);

  return React.createElement(
    ObsidianContext.Provider,
    { value: { app, plugin, settings, activeFile } },
    children
  );
}
