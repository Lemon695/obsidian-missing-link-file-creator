export class App {}

export class Notice {
  message: string;
  timeout?: number;
  noticeEl: { innerHTML: string };

  constructor(message: string, timeout?: number) {
    this.message = message;
    this.timeout = timeout;
    this.noticeEl = { innerHTML: "" };
  }
}

export class TAbstractFile {
  path: string = "";
}

export class TFile extends TAbstractFile {
  basename: string = "";
  extension: string = "";
  name: string = "";
  stat: { ctime: number; mtime: number; size: number } = { ctime: 0, mtime: 0, size: 0 };
  vault: any = null;
  parent: TFolder | null = null;
}

export class TFolder extends TAbstractFile {
  children: TAbstractFile[] = [];
  isRoot(): boolean { return false; }
}

export class Modal {
  app: App;
  contentEl: any = { createEl: () => ({}), createDiv: () => ({}) };
  titleEl: any = { setText: () => {} };
  containerEl: any = {};

  constructor(app: App) {
    this.app = app;
  }
  open() {}
  close() {}
}

export class Setting {
  constructor(_containerEl: HTMLElement) {}
  setName(_name: string): this { return this; }
  setDesc(_desc: string): this { return this; }
  setHeading(): this { return this; }
  addText(_cb: (text: any) => void): this { return this; }
  addToggle(_cb: (toggle: any) => void): this { return this; }
  addButton(_cb: (button: any) => void): this { return this; }
  addDropdown(_cb: (dropdown: any) => void): this { return this; }
}

export class Vault {}

export type EventRef = {};
export function normalizePath(path: string): string { return path; }
export function getLanguage(): string { return 'en-GB'; }
