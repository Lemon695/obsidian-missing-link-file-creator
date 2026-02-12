import { App, Modal } from "obsidian";
import { createRoot, Root } from "react-dom/client";
import React from "react";
import { ObsidianProvider } from "../context/ObsidianContext";
import type CheckAndCreateMDFilePlugin from "@/main";

/**
 * Base class for Obsidian Modal that mounts a React component.
 * Subclasses must implement `createReactComponent()`.
 */
export abstract class ReactModal extends Modal {
  protected root: Root | null = null;
  protected plugin: CheckAndCreateMDFilePlugin;

  constructor(app: App, plugin: CheckAndCreateMDFilePlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("ccmd-react-root");

    this.root = createRoot(contentEl);
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

  onClose() {
    this.root?.unmount();
    this.root = null;
    this.contentEl.empty();
  }

  /**
   * Return the React element to render inside this modal.
   */
  protected abstract createReactComponent(): React.ReactElement;
}
