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
