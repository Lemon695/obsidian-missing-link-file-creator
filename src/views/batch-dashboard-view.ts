import React from "react";
import { WorkspaceLeaf } from "obsidian";
import CheckAndCreateMDFilePlugin from "../main";
import { ReactView } from "@/react/bridge/ReactView";
import { DashboardPanel } from "@/react/views/DashboardPanel";
import { t } from "@/i18n/locale";

export const DASHBOARD_VIEW_TYPE = "ccmd-dashboard-view";

export class MissingLinksDashboardView extends ReactView {
	constructor(leaf: WorkspaceLeaf, plugin: CheckAndCreateMDFilePlugin) {
		super(leaf, plugin);
	}

	getViewType() {
		return DASHBOARD_VIEW_TYPE;
	}

	getDisplayText() {
		return t('dashboardTitle');
	}

	getIcon() {
		return "layout-dashboard";
	}

	protected createReactComponent(): React.ReactElement {
		return React.createElement(DashboardPanel);
	}
}
