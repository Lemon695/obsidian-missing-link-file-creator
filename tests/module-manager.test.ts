import test from "node:test";
import assert from "node:assert/strict";
import { ModuleManager } from "../src/core/module-manager";
import type { PluginModule } from "../src/core/types";

// ── Minimal plugin stub ──────────────────────────────────────────────────────

function makePlugin(moduleEnabled?: Record<string, boolean>) {
  return {
    settings: { moduleEnabled } as any,
    saveSettings: async () => {},
  } as any;
}

// ── Helper: build a simple test module ──────────────────────────────────────

function makeModule(id: string): PluginModule & { loadCount: number; unloadCount: number } {
  return {
    id,
    name: id,
    description: "",
    loadCount: 0,
    unloadCount: 0,
    onload() { this.loadCount++; },
    onunload() { this.unloadCount++; },
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

test("ModuleManager: register and loadAll calls onload", async () => {
  const plugin = makePlugin();
  const manager = new ModuleManager(plugin);
  const mod = makeModule("a");

  manager.register(mod);
  await manager.loadAll();

  assert.equal(mod.loadCount, 1);
  assert.equal(manager.isLoaded("a"), true);
});

test("ModuleManager: duplicate registration throws", () => {
  const plugin = makePlugin();
  const manager = new ModuleManager(plugin);
  manager.register(makeModule("x"));

  assert.throws(
    () => manager.register(makeModule("x")),
    /already registered/
  );
});

test("ModuleManager: unloadAll calls onunload in reverse order", async () => {
  const plugin = makePlugin();
  const manager = new ModuleManager(plugin);
  const order: string[] = [];

  const a = makeModule("a");
  const b = makeModule("b");
  (a as any).onunload = () => order.push("a");
  (b as any).onunload = () => order.push("b");

  manager.register(a);
  manager.register(b);
  await manager.loadAll();
  manager.unloadAll();

  assert.deepEqual(order, ["b", "a"]);
  assert.equal(manager.isLoaded("a"), false);
  assert.equal(manager.isLoaded("b"), false);
});

test("ModuleManager: disabled module is skipped in loadAll", async () => {
  const plugin = makePlugin({ skip: false });
  const manager = new ModuleManager(plugin);
  const mod = makeModule("skip");

  manager.register(mod);
  await manager.loadAll();

  assert.equal(mod.loadCount, 0);
  assert.equal(manager.isLoaded("skip"), false);
});

test("ModuleManager: isEnabled returns true for unknown id (opt-out model)", () => {
  const plugin = makePlugin();
  const manager = new ModuleManager(plugin);
  assert.equal(manager.isEnabled("anything"), true);
});

test("ModuleManager: enableModule loads a previously disabled module", async () => {
  const plugin = makePlugin({ m: false });
  const manager = new ModuleManager(plugin);
  const mod = makeModule("m");

  manager.register(mod);
  await manager.loadAll();
  assert.equal(mod.loadCount, 0);

  await manager.enableModule("m");
  assert.equal(mod.loadCount, 1);
  assert.equal(manager.isLoaded("m"), true);
});

test("ModuleManager: disableModule unloads a loaded module", async () => {
  const plugin = makePlugin();
  const manager = new ModuleManager(plugin);
  const mod = makeModule("d");

  manager.register(mod);
  await manager.loadAll();
  assert.equal(manager.isLoaded("d"), true);

  await manager.disableModule("d");
  assert.equal(mod.unloadCount, 1);
  assert.equal(manager.isLoaded("d"), false);
});

test("ModuleManager: get() returns the registered module instance", async () => {
  const plugin = makePlugin();
  const manager = new ModuleManager(plugin);
  const mod = makeModule("z");

  manager.register(mod);
  assert.strictEqual(manager.get("z"), mod);
});
