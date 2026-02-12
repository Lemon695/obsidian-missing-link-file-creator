import React from "react";
import { WorkspaceLeaf } from "obsidian";
import CheckAndCreateMDFilePlugin from "../main";
import { ReactView } from "@/react/bridge/ReactView";
import { ActiveMissingLinksPanel } from "@/react/views/ActiveMissingLinksPanel";
import { t } from "@/i18n/locale";

export const ACTIVE_SIDE_VIEW_TYPE = "ccmd-active-side-view";

export class ActiveMissingLinksView extends ReactView {
    constructor(leaf: WorkspaceLeaf, plugin: CheckAndCreateMDFilePlugin) {
        super(leaf, plugin);
    }

    getViewType() {
        return ACTIVE_SIDE_VIEW_TYPE;
    }

    getDisplayText() {
        return t('sideViewDisplayText');
    }

    getIcon() {
        return "file-text";
    }

    protected createReactComponent(): React.ReactElement {
        return React.createElement(ActiveMissingLinksPanel);
    }
}
