import { ItemView, WorkspaceLeaf, ButtonComponent, Notice, SearchComponent, DropdownComponent } from "obsidian";
import CheckAndCreateMDFilePlugin from "../main";
import { t } from "@/i18n/locale";
import { MissingLinkData } from "@/utils/file-operations";

export const DASHBOARD_VIEW_TYPE = "ccmd-dashboard-view";

export class MissingLinksDashboardView extends ItemView {
	plugin: CheckAndCreateMDFilePlugin;
	private missingLinks: Map<string, MissingLinkData> = new Map();
	private selectedLinks: Set<string> = new Set();
	private container: HTMLElement;

	// Dashboard State
	private searchQuery: string = "";
	private sortField: 'count' | 'name' = 'count';
	private sortDirection: 'asc' | 'desc' = 'desc';
	private currentPage: number = 1;
	private itemsPerPage: number = 50;
	private viewMode: 'list' | 'folder' = 'list';
	private scopeMode: 'vault' | 'active' = 'vault';

	constructor(leaf: WorkspaceLeaf, plugin: CheckAndCreateMDFilePlugin) {
		super(leaf);
		this.plugin = plugin;
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

	async onOpen() {
		this.container = this.containerEl.children[1] as HTMLElement;
		this.container.empty();
		this.container.addClass("ccmd-dashboard-view");

		this.renderHeader();
		this.refreshData();

		// Keyboard Shortcuts
		this.scope?.register(["Mod"], "f", (evt) => {
			evt.preventDefault();
			const searchInput = this.container.querySelector("input[type='search']") as HTMLInputElement;
			if (searchInput) {
				searchInput.focus();
				searchInput.select();
			}
			return false;
		});

		this.scope?.register(["Mod"], "enter", (evt) => {
			evt.preventDefault();
			this.createSelectedFiles();
			return false;
		});

		this.scope?.register(["Mod", "Shift"], "r", (evt) => {
			evt.preventDefault();
			this.refreshData();
			new Notice(t('dashboardRefreshTooltip')); // Using tooltip text for notice roughly
			return false;
		});

		// Auto-refresh on file change if in "active" scope
		this.registerEvent(
			this.app.workspace.on('active-leaf-change', () => {
				if (this.scopeMode === 'active') {
					this.refreshData();
				}
			})
		);
	}

	renderHeader() {
		const header = this.container.createDiv({ cls: "ccmd-dashboard-header" });

		// Row 1: Title and Primary Actions
		const row1 = header.createDiv({ cls: "ccmd-header-row ccmd-header-primary" });

		const titleGroup = row1.createDiv({ cls: "ccmd-dashboard-title-group" });
		titleGroup.createEl("h2", { text: t('dashboardTitle') });

		const primaryActions = row1.createDiv({ cls: "ccmd-header-actions" });

		// CTA: Create Selected
		const createBtn = new ButtonComponent(primaryActions)
			.setIcon("check-square")
			.setButtonText(t('dashboardCreateSelected'))
			.setTooltip(t('dashboardCreateSelectedTooltip'))
			.onClick(() => this.createSelectedFiles());
		createBtn.buttonEl.addClass("mod-cta"); // Obsidian's primary button class
		createBtn.buttonEl.addClass("ccmd-cta-btn"); // Custom styling

		// Refresh
		new ButtonComponent(primaryActions)
			.setIcon("refresh-cw")
			.setTooltip(t('dashboardRefreshTooltip'))
			.onClick(() => this.refreshData());


		// Row 2: Toolbar (Search & Filter)
		const row2 = header.createDiv({ cls: "ccmd-header-row ccmd-header-toolbar" });

		// Search (Flex grow)
		const searchContainer = row2.createDiv({ cls: "ccmd-search-container" });
		new SearchComponent(searchContainer)
			.setPlaceholder(t('dashboardSearchPlaceholder'))
			.onChange((value) => {
				this.searchQuery = value;
				this.currentPage = 1; // Reset to first page
				this.renderList();
			});

		const toolbarRight = row2.createDiv({ cls: "ccmd-toolbar-right" });

		// Scope Toggle (Vault vs Active)
		const scopeBtn = new ButtonComponent(toolbarRight)
			.setIcon(this.scopeMode === 'vault' ? "vault" : "file-text")
			.setTooltip(this.scopeMode === 'vault' ? t('dashboardScopeVault') : t('dashboardScopeActive'))
			.onClick(() => {
				this.scopeMode = this.scopeMode === 'vault' ? 'active' : 'vault';
				scopeBtn.setIcon(this.scopeMode === 'vault' ? "vault" : "file-text");
				scopeBtn.setTooltip(this.scopeMode === 'vault' ? t('dashboardScopeVault') : t('dashboardScopeActive'));
				// Trigger refresh logic to re-filter
				// We might not need a full scan if we cache, but for now scan is cheap enough or we optimize later.
				// Actually scope affects filtering, not necessarily raw scan, BUT scanVaultForMissingLinks scans everything.
				// Optimization: We could keep full list in memory and just filter. 
				// Let's rely on getFilteredAndSortedData doing the filtering.
				this.currentPage = 1;
				this.renderList();

				const modeText = this.scopeMode === 'vault' ? t('dashboardScopeVault') : t('dashboardScopeActive');
				new Notice(t('dashboardScopeSwitched', { scope: modeText }));
			});
		// Add active class if active mode for visual cue
		if (this.scopeMode === 'active') scopeBtn.buttonEl.addClass("is-active");

		// Sort
		new DropdownComponent(toolbarRight)
			.addOption("count-desc", t('dashboardSortCountDesc'))
			.addOption("count-asc", t('dashboardSortCountAsc'))
			.addOption("name-asc", t('dashboardSortNameAsc'))
			.addOption("name-desc", t('dashboardSortNameDesc'))
			.setValue(`${this.sortField}-${this.sortDirection}`)
			.onChange((value) => {
				const [field, direction] = value.split('-');
				this.sortField = field as 'count' | 'name';
				this.sortDirection = direction as 'asc' | 'desc';
				this.renderList();
			});

		// View Mode Toggle
		const viewBtn = new ButtonComponent(toolbarRight)
			.setIcon(this.viewMode === 'list' ? "folder" : "list")
			.setTooltip(this.viewMode === 'list' ? t('dashboardGroupByFolder') : t('dashboardListView'))
			.onClick(() => {
				this.viewMode = this.viewMode === 'list' ? 'folder' : 'list';
				viewBtn.setIcon(this.viewMode === 'list' ? "folder" : "list");
				viewBtn.setTooltip(this.viewMode === 'list' ? t('dashboardGroupByFolder') : t('dashboardListView'));
				this.currentPage = 1;
				this.renderList();
			});
	}

	async refreshData() {
		const content = this.getOrCreateContentContainer();
		content.empty();

		// Skeleton Loading
		const skeletonContainer = content.createDiv({ cls: "ccmd-skeleton-container" });
		for (let i = 0; i < 5; i++) {
			skeletonContainer.createDiv({ cls: "ccmd-skeleton-item" });
		}

		// Clear selection on refresh
		this.selectedLinks.clear();

		// Use setTimeout to allow UI to render skeleton before blocking operation
		// (optional optimization, normally await scans are fast enough or async)
		try {
			// Small delay to make skeleton visible if scan is instant (UX feel)
			// await new Promise(r => setTimeout(r, 600)); 
			this.missingLinks = await this.plugin.fileOperations.scanVaultForMissingLinks();
			this.renderList();
		} catch (e) {
			content.empty();
			content.createEl("div", { cls: "ccmd-error", text: t('dashboardScanError', { message: e.message }) });
		}
	}

	getOrCreateContentContainer(): HTMLElement {
		let content = this.container.querySelector(".ccmd-dashboard-content") as HTMLElement;
		if (!content) {
			content = this.container.createDiv({ cls: "ccmd-dashboard-content" });
		}
		return content;
	}

	async createSelectedFiles() {
		if (this.selectedLinks.size === 0) {
			new Notice(t('dashboardNoLinksSelected'));
			return;
		}

		await this.createFiles(Array.from(this.selectedLinks));
	}

	async createFiles(keys: string[]) {
		let createdCount = 0;
		let failedCount = 0;
		const total = keys.length;
		const createdFiles: Array<{name: string, rule?: string}> = [];

		for (const key of keys) {
			const data = this.missingLinks.get(key);
			if (!data) {
				failedCount++;
				console.error(`Missing data for key: ${key}`);
				continue;
			}

			try {
				const filePath = data.filePath;
				const sourceFile = this.app.workspace.getActiveFile();
				
				const result = await this.plugin.fileOperations.createSingleFileFromLink(
					filePath,
					sourceFile?.path
				);

				if (result.success) {
					createdCount++;
					this.missingLinks.delete(key);
					this.selectedLinks.delete(key);
					
					const fileName = result.path?.split('/').pop()?.replace('.md', '') || filePath;
					createdFiles.push({
						name: fileName,
						rule: data.ruleMatch?.name
					});
					console.log(`Created: ${result.path || filePath}`);
				} else {
					failedCount++;
					console.error(`Failed to create ${filePath}:`, result.message);
				}
			} catch (e) {
				failedCount++;
				console.error(`Error creating ${key}:`, e);
			}
		}

		// Show detailed success messages
		if (createdCount > 0) {
			createdFiles.forEach(file => {
				const message = file.rule
					? t('sideViewCreatedWithRule', { file: file.name, rule: file.rule })
					: t('sideViewCreatedNoRule', { file: file.name });
				new Notice(message, 3000);
			});
		}
		
		if (failedCount > 0) {
			new Notice(`Failed to create ${failedCount} file(s). Check console for details.`);
		}
		
		this.renderList();
	}


	getFilteredAndSortedData(): MissingLinkData[] {
		let items = Array.from(this.missingLinks.values());

		// 1. Filter by Scope
		if (this.scopeMode === 'active') {
			const activeFile = this.app.workspace.getActiveFile();
			if (activeFile) {
				items = items.filter(item => item.sourceFiles.has(activeFile.path));
			} else {
				// No active file? Show empty
				items = [];
			}
		}

		// 2. Filter by Search
		if (this.searchQuery) {
			const query = this.searchQuery.toLowerCase();
			items = items.filter(item => {
				const key = item.filePath.toLowerCase();
				const name = key.split('/').pop() || "";
				return key.includes(query) || name.includes(query);
			});
		}

		// 3. Sort
		items.sort((a, b) => {
			let result = 0;
			if (this.sortField === 'count') {
				result = a.occurrenceCount - b.occurrenceCount;
			} else {
				// Name sort
				const nameA = a.filePath.split('/').pop() || a.filePath;
				const nameB = b.filePath.split('/').pop() || b.filePath;
				result = nameA.localeCompare(nameB);
			}
			return this.sortDirection === 'asc' ? result : -result;
		});

		return items;
	}

	renderList() {
		if (this.viewMode === 'folder') {
			this.renderGroupedList();
		} else {
			this.renderFlatList();
		}
	}

	renderFlatList() {
		const content = this.getOrCreateContentContainer();
		content.empty();

		const allItems = this.getFilteredAndSortedData();

		if (allItems.length === 0) {
			this.renderEmptyState(content);
			return;
		}

		// Pagination Logic for Flat List
		const totalItems = allItems.length;
		const totalPages = Math.ceil(totalItems / this.itemsPerPage);

		if (this.currentPage > totalPages) this.currentPage = totalPages;
		if (this.currentPage < 1) this.currentPage = 1;

		const startIndex = (this.currentPage - 1) * this.itemsPerPage;
		const endIndex = Math.min(startIndex + this.itemsPerPage, totalItems);
		const currentItems = allItems.slice(startIndex, endIndex);

		// --- List Container ---
		const listContainer = content.createDiv({ cls: "ccmd-dashboard-list" });

		// Header
		const headerRow = listContainer.createDiv({ cls: "ccmd-list-header" });
		const checkAllEl = headerRow.createDiv({ cls: "col-checkbox" }).createEl("input", { type: "checkbox" });

		const isAllPageSelected = currentItems.length > 0 && currentItems.every(item =>
			this.selectedLinks.has(this.getLinkKey(item))
		);
		checkAllEl.checked = isAllPageSelected;

		checkAllEl.addEventListener("change", (e) => {
			const checked = (e.target as HTMLInputElement).checked;
			currentItems.forEach(item => {
				const key = this.getLinkKey(item);
				if (checked) {
					this.selectedLinks.add(key);
				} else {
					this.selectedLinks.delete(key);
				}
			});
			this.renderList();
		});

		headerRow.createDiv({ cls: "col-name", text: t('dashboardColName') });
		headerRow.createDiv({ cls: "col-count", text: t('dashboardColRef') });
		headerRow.createDiv({ cls: "col-path", text: t('dashboardColPath') });
		headerRow.createDiv({ cls: "col-actions", text: t('dashboardColActions') });

		// Items
		currentItems.forEach((data) => {
			this.renderListItem(listContainer, data, checkAllEl, currentItems);
		});

		// Footer
		this.renderFooter(content, startIndex + 1, endIndex, totalItems, totalPages);
	}

	renderGroupedList() {
		const content = this.getOrCreateContentContainer();
		content.empty();

		const allItems = this.getFilteredAndSortedData();

		if (allItems.length === 0) {
			this.renderEmptyState(content);
			return;
		}

		// Grouping Logic
		const groups = new Map<string, MissingLinkData[]>();
		allItems.forEach(item => {
			const folder = item.filePath.includes('/')
				? item.filePath.substring(0, item.filePath.lastIndexOf('/'))
				: "(Root)";
			if (!groups.has(folder)) groups.set(folder, []);
			groups.get(folder)?.push(item);
		});

		// Sort Groups (Always A-Z for folders)
		const sortedFolders = Array.from(groups.keys()).sort((a, b) => a.localeCompare(b));

		// Pagination for Groups
		const totalGroups = sortedFolders.length;
		const groupsPerPage = 10; // Show 10 folders per page
		const totalPages = Math.ceil(totalGroups / groupsPerPage);

		if (this.currentPage > totalPages) this.currentPage = totalPages;
		if (this.currentPage < 1) this.currentPage = 1;

		const startIndex = (this.currentPage - 1) * groupsPerPage;
		const endIndex = Math.min(startIndex + groupsPerPage, totalGroups);
		const currentFolders = sortedFolders.slice(startIndex, endIndex);

		const listContainer = content.createDiv({ cls: "ccmd-dashboard-list" });

		currentFolders.forEach(folder => {
			const itemsInGroup = groups.get(folder) || [];

			// Group Header
			const groupDetails = listContainer.createEl("details", { cls: "ccmd-group-details" });
			groupDetails.open = true; // Default open

			const summary = groupDetails.createEl("summary", { cls: "ccmd-group-summary" });

			// Group Checkbox
			const checkGroupEl = summary.createEl("input", { type: "checkbox", cls: "ccmd-group-checkbox" });
			checkGroupEl.addEventListener("click", (e) => e.stopPropagation()); // Prevent folding

			const isGroupSelected = itemsInGroup.every(item => this.selectedLinks.has(this.getLinkKey(item)));
			checkGroupEl.checked = isGroupSelected;

			checkGroupEl.addEventListener("change", (e) => {
				const checked = (e.target as HTMLInputElement).checked;
				itemsInGroup.forEach(item => {
					const key = this.getLinkKey(item);
					if (checked) this.selectedLinks.add(key);
					else this.selectedLinks.delete(key);
				});
				this.renderList();
			});

			summary.createSpan({ cls: "ccmd-group-name", text: folder });
			summary.createSpan({ cls: "ccmd-group-count", text: `(${itemsInGroup.length} items)` });

			// Group Content
			const groupContent = groupDetails.createDiv({ cls: "ccmd-group-content" });

			// Minimal Header for Group items? Or just items
			// Let's reuse item rendering but simple
			itemsInGroup.forEach(data => {
				this.renderListItem(groupContent, data, checkGroupEl, itemsInGroup);
			});
		});

		// Footer - Count reflects GROUPS or ITEMS? 
		// "Showing X-Y of Z Folders"
		this.renderFooter(content, startIndex + 1, endIndex, totalGroups, totalPages, t('dashboardUnitFolders'));
	}

	renderEmptyState(content: HTMLElement) {
		const emptyState = content.createDiv({ cls: "ccmd-empty-state" });
		if (this.searchQuery) {
			emptyState.createDiv({ cls: "ccmd-empty-state-icon" }).setText("🔍");
			emptyState.createDiv({ cls: "ccmd-empty-state-title" }).setText(t('dashboardNoMatchesTitle'));
			emptyState.createDiv({ cls: "ccmd-empty-state-desc" }).setText(t('dashboardNoMatchesDesc', { query: this.searchQuery }));
		} else {
			emptyState.createDiv({ cls: "ccmd-empty-state-icon" }).setText("🎉");
			emptyState.createDiv({ cls: "ccmd-empty-state-title" }).setText(t('dashboardAllClearTitle'));
			emptyState.createDiv({ cls: "ccmd-empty-state-desc" }).setText(t('dashboardAllClearDesc'));
		}
	}

	renderListItem(container: HTMLElement, data: MissingLinkData, parentCheckbox: HTMLInputElement, siblings: MissingLinkData[]) {
		const key = data.filePath;
		const row = container.createDiv({ cls: "ccmd-list-item" });

		// Checkbox
		const checkEl = row.createDiv({ cls: "col-checkbox" }).createEl("input", { type: "checkbox" });
		checkEl.checked = this.selectedLinks.has(key);
		checkEl.addEventListener("change", (e) => {
			const checked = (e.target as HTMLInputElement).checked;
			if (checked) {
				this.selectedLinks.add(key);
			} else {
				this.selectedLinks.delete(key);
			}
			// Update parent checkbox state
			const isAllSiblingsSelected = siblings.every(i => this.selectedLinks.has(this.getLinkKey(i)));
			parentCheckbox.checked = isAllSiblingsSelected;
		});

		// Name
		const nameCol = row.createDiv({ cls: "col-name" });
		const displayName = key.split('/').pop() || key;
		nameCol.createEl("span", { text: displayName, cls: "ccmd-link-name" })
			.setAttr("title", key);

		if (data.aliases.size > 0) {
			nameCol.createEl("span", { text: ` (+${data.aliases.size} aliases)`, cls: "ccmd-alias-count" });
		}

		// Badge
		const countCol = row.createDiv({ cls: "col-count" });
		const count = data.occurrenceCount;
		let badgeClass = "ccmd-badge-low";
		if (count >= 10) badgeClass = "ccmd-badge-critical";
		else if (count >= 5) badgeClass = "ccmd-badge-high";
		else if (count >= 3) badgeClass = "ccmd-badge-medium";

		countCol.createEl("span", { cls: `ccmd-count-badge ${badgeClass}`, text: count.toString() })
			.setAttr("title", "Referenced in:\n" + Array.from(data.sourceFiles).join("\n"));

		// Path
		row.createDiv({ cls: "col-path", text: data.filePath });

		// Actions
		const actionsCol = row.createDiv({ cls: "col-actions" });

		new ButtonComponent(actionsCol)
			.setIcon("eye-off")
			.setTooltip(t('sideViewIgnoreTooltip'))
			.setClass("ccmd-action-btn")
			.onClick(async () => {
				await this.plugin.fileOperations.addToIgnoreList(key);
				this.missingLinks.delete(key);
				this.selectedLinks.delete(key);
				this.renderList();
				new Notice(t('sideViewIgnored', { file: displayName }));
			});

		new ButtonComponent(actionsCol)
			.setIcon("plus")
			.setTooltip(t('sideViewCreateTooltip'))
			.setClass("ccmd-action-btn")
			.onClick(async () => {
				await this.createFiles([key]);
			});
	}

	private getLinkKey(data: MissingLinkData): string {
		return data.filePath;
	}

	renderFooter(container: HTMLElement, start: number, end: number, total: number, totalPages: number, unit: string = t('dashboardUnitLinks')) {
		const footer = container.createDiv({ cls: "ccmd-dashboard-footer" });

		// Info
		footer.createDiv({ cls: "ccmd-pagination-info", text: t('dashboardShowingRows', { start: start.toString(), end: end.toString(), total: total.toString(), unit: unit }) });

		// Controls
		const controls = footer.createDiv({ cls: "ccmd-pagination-controls" });

		new ButtonComponent(controls)
			.setIcon("chevron-left")
			.setDisabled(this.currentPage <= 1)
			.onClick(() => {
				this.currentPage--;
				this.renderList();
			});

		controls.createSpan({ cls: "ccmd-page-text", text: t('dashboardPageInfo', { current: this.currentPage.toString(), total: totalPages.toString() }) });

		new ButtonComponent(controls)
			.setIcon("chevron-right")
			.setDisabled(this.currentPage >= totalPages)
			.onClick(() => {
				this.currentPage++;
				this.renderList();
			});
	}

	async onClose() {
		// Cleanup
	}
}

