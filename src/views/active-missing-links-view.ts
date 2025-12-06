import { ItemView, WorkspaceLeaf, ButtonComponent, Notice, TFile } from "obsidian";
import CheckAndCreateMDFilePlugin from "../main";
import { MissingLinkData } from "@/utils/file-operations";
import { t } from "@/i18n/locale";

export const ACTIVE_SIDE_VIEW_TYPE = "ccmd-active-side-view";

export class ActiveMissingLinksView extends ItemView {
    plugin: CheckAndCreateMDFilePlugin;
    private missingLinks: MissingLinkData[] = [];
    private container: HTMLElement;
    private currentFile: TFile | null = null;
    private activeFileLabel: HTMLElement;

    constructor(leaf: WorkspaceLeaf, plugin: CheckAndCreateMDFilePlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType() {
        return ACTIVE_SIDE_VIEW_TYPE;
    }

    getDisplayText() {
        return t('sideViewDisplayText');
    }

    getIcon() {
        return "file-text"; // Icon representing a file
    }

    async onOpen() {
        // Use contentEl instead of accessing children directly for better stability
        this.container = this.contentEl;
        this.container.empty();
        this.container.addClass("ccmd-active-view");

        this.renderHeader();
        this.renderContent();

        // Initial load
        this.updateForActiveFile();

        // Listen for active leaf changes
        this.registerEvent(
            this.app.workspace.on('active-leaf-change', () => {
                this.updateForActiveFile();
            })
        );

        // Also listen for file modifications (in case links are added/removed)
        this.registerEvent(
            this.app.vault.on('modify', (file) => {
                if (this.currentFile && file.path === this.currentFile.path) {
                    // Small debounce could be good, but direct update is responsive
                    this.updateForActiveFile();
                }
            })
        );
    }

    renderHeader() {
        const header = this.container.createDiv({ cls: "ccmd-active-header" });
        header.createEl("h4", { text: t('sideViewHeader') });

        const controls = header.createDiv({ cls: "ccmd-active-controls" });

        new ButtonComponent(controls)
            .setIcon("refresh-cw")
            .setTooltip(t('sideViewRefresh'))
            .onClick(() => this.updateForActiveFile());

        this.activeFileLabel = this.container.createDiv({ cls: "ccmd-active-file-label" });
        this.activeFileLabel.setText(t('sideViewNoActiveFile'));
    }

    renderContent() {
        const content = this.container.createDiv({ cls: "ccmd-active-content" });
        content.empty();
    }

    async updateForActiveFile() {
        const activeFile = this.app.workspace.getActiveFile();
        this.currentFile = activeFile;

        if (!activeFile) {
            this.activeFileLabel.setText(t('sideViewNoActiveFile'));
            this.missingLinks = [];
            this.renderList();
            return;
        }

        this.activeFileLabel.setText(activeFile.basename);

        // We need to scan specifically for this file.
        // Since we don't have a "scanSingleFile" method optimized for just returning MissingLinkData[] for one file
        // (scanVault does all), we can reuse scanVault BUT that is expensive.
        // Better: FileOperations.getLinksFromContent or similar?
        // Actually FileOperations has logic inside checkAndCreateMDFiles or checkAndCreateMDFilesInFolder.
        // But those CREATE files. We just want to LIST.
        // Let's use scanVaultForMissingLinks but we really should optimize it to filter early if possible. 
        // For now, to ensure consistency, we scan all (or if we can, refine FileOperations to scan one).
        // Wait, scanVaultForMissingLinks scans the WHOLE vault to check existence.
        // For a single file, checking if its links exist is cheaper.

        // Let's implement a lightweight scanner here or in FileOperations? 
        // For "Big Tech" quality, we should probably add `scanFileForMissingLinks(file)` to FileOperations.
        // But to save time and stick to existing tools, let's call the main scan and filter.
        // Note: Scanning 10k files just to show 1 file's links is bad performance.
        // HOWEVER, `scanVaultForMissingLinks` iterates all files.

        // Optimization: We will just parse the content of the active file using `app.metadataCache` or `read()`.
        // Obsidian's `metadataCache.getFileCache(file)?.links` gives us links!
        // We just need to check if they point to non-existent files.

        const links = this.app.metadataCache.getFileCache(activeFile)?.links || [];
        const unresolvedLinks: MissingLinkData[] = [];

        // Use Manager if available
        const ignoreList = this.plugin.ignoreListManager
            ? this.plugin.ignoreListManager.getIgnoreList()
            : (this.plugin.settings.ignoreList || []);

        for (const link of links) {
            const linkPath = link.link;
            // Resolve link
            const sourcePath = activeFile.path;
            const resolvedFile = this.app.metadataCache.getFirstLinkpathDest(linkPath, sourcePath);

            if (!resolvedFile) {
                // It is missing!
                if (ignoreList.includes(linkPath)) continue;

                // Calculate global occurrence count
                let count = 0;
                const allUnresolved = this.app.metadataCache.unresolvedLinks;
                for (const filePath in allUnresolved) {
                    if (allUnresolved[filePath][linkPath]) {
                        count += allUnresolved[filePath][linkPath];
                    }
                }

                // Match rule for this link
                const baseName = linkPath.split('/').pop() || linkPath;
                const frontmatter = this.app.metadataCache.getFileCache(activeFile)?.frontmatter;
                const ruleMatch = this.plugin.fileOperations.matchRule(
                    baseName,
                    { frontmatter, sourcePath: activeFile.path }
                );

                unresolvedLinks.push({
                    filePath: linkPath,
                    aliases: new Set(),
                    sourceFiles: new Set([activeFile.path]),
                    occurrenceCount: count,
                    ruleMatch: ruleMatch.matched && ruleMatch.rule ? {
                        name: ruleMatch.rule.name,
                        templatePath: ruleMatch.templatePath
                    } : undefined
                });
            }
        }

        this.missingLinks = unresolvedLinks;
        this.renderList();
    }

    renderList() {
        const content = this.container.querySelector(".ccmd-active-content") as HTMLElement;
        if (!content) return;
        content.empty();

        if (!this.currentFile) {
            content.createEl("div", { cls: "ccmd-empty-state", text: t('sideViewEmptyNoActive') });
            return;
        }

        if (this.missingLinks.length === 0) {
            const empty = content.createDiv({ cls: "ccmd-empty-state" });
            empty.createDiv({ cls: "ccmd-empty-state-icon" }).setText("🎉");
            empty.createDiv({ text: t('sideViewEmptyAllClear') });
            return;
        }

        const list = content.createDiv({ cls: "ccmd-active-list" });

        this.missingLinks.forEach(link => {
            const item = list.createDiv({ cls: "ccmd-active-item" });

            // Name & Badge Container
            const nameContainer = item.createDiv({ cls: "ccmd-active-name-container" });

            // Name
            const name = nameContainer.createDiv({ cls: "ccmd-active-name" });
            name.setText(link.filePath);

            // Count Badge
            let badgeClass = "ccmd-badge-low";
            if (link.occurrenceCount >= 10) badgeClass = "ccmd-badge-critical";
            else if (link.occurrenceCount >= 5) badgeClass = "ccmd-badge-high";
            else if (link.occurrenceCount >= 3) badgeClass = "ccmd-badge-medium";

            nameContainer.createSpan({
                cls: `ccmd-count-badge ${badgeClass} ccmd-active-badge`,
                text: link.occurrenceCount.toString()
            }).setAttr("title", t('dashboardColRef') + ": " + link.occurrenceCount);

            // Actions
            const actions = item.createDiv({ cls: "ccmd-active-actions" });

            // Create
            const createBtn = new ButtonComponent(actions)
                .setIcon("plus")
                .setClass("clickable-icon")
                .setTooltip(t('sideViewCreateTooltip'))
                .onClick(async () => {
                    createBtn.setDisabled(true);
                    try {
                        const result = await this.plugin.fileOperations.createSingleFileFromLink(
                            link.filePath,
                            this.currentFile?.path
                        );

                        if (result.success) {
                            const fileName = result.path?.split('/').pop()?.replace('.md', '') || link.filePath;
                            
                            // Use i18n for success message
                            const message = link.ruleMatch?.name
                                ? t('sideViewCreatedWithRule', { file: fileName, rule: link.ruleMatch.name })
                                : t('sideViewCreatedNoRule', { file: fileName });
                            
                            new Notice(message);
                            
                            // Delay refresh to allow notice to show and avoid button destruction
                            setTimeout(() => {
                                this.updateForActiveFile();
                            }, 100);
                        } else {
                            new Notice(result.message || t('sideViewCreateFailed'));
                            createBtn.setDisabled(false);
                        }
                    } catch (e) {
                        new Notice(t('failedToCreateFileMessage', { message: e.message }));
                        createBtn.setDisabled(false);
                    }
                });

            // Ignore
            new ButtonComponent(actions)
                .setIcon("eye-off")
                .setClass("clickable-icon")
                .setTooltip(t('sideViewIgnoreTooltip'))
                .onClick(async () => {
                    await this.plugin.fileOperations.addToIgnoreList(link.filePath);
                    this.updateForActiveFile();
                    new Notice(t('sideViewIgnored', { file: link.filePath }));
                });
        });
    }

    async onClose() {
        // Clean up
    }
}
