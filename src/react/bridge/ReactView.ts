import { ItemView, WorkspaceLeaf } from "obsidian";
import { createRoot, Root } from "react-dom/client";
import React from "react";
import { ObsidianProvider } from "../context/ObsidianContext";
import type CheckAndCreateMDFilePlugin from "@/main";

/**
 * Base class for Obsidian ItemView that mounts a React component.
 * Subclasses must implement `createReactComponent()`.
 */
export abstract class ReactView extends ItemView {
  protected root: Root | null = null;
  protected plugin: CheckAndCreateMDFilePlugin;

  constructor(leaf: WorkspaceLeaf, plugin: CheckAndCreateMDFilePlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  async onOpen() {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("ccmd-react-root");

    this.root = createRoot(container);
    this.root.render(
      React.createElement(
        ObsidianProvider,
        {
          app: this.app,
          plugin: this.plugin,
          settings: this.plugin.settings,
        },
        this.createReactComponent()
      )
    );
  }

  async onClose() {
    this.root?.unmount();
    this.root = null;
  }

  /**
   * Return the React element to render inside this view.
   */
  protected abstract createReactComponent(): React.ReactElement;
}
