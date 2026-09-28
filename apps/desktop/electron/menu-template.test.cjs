const test = require("node:test");
const assert = require("node:assert/strict");
const { createApplicationMenuTemplate } = require("./menu-template.cjs");

const roles = (menu) => menu.flatMap((item) => item.submenu || []).map((item) => item.role).filter(Boolean);

test("provides the approved production menu without development tools", () => {
  const menu = createApplicationMenuTemplate({ appName: "TaskFlow", isDevelopment: false, platform: "win32" });
  const allRoles = roles(menu);
  assert.deepEqual(menu.map((item) => item.label || item.role), ["File", "Edit", "View", "windowMenu"]);
  assert.ok(allRoles.includes("close"));
  assert.ok(allRoles.includes("quit"));
  assert.ok(allRoles.includes("undo"));
  assert.ok(allRoles.includes("paste"));
  assert.ok(allRoles.includes("selectAll"));
  assert.ok(allRoles.includes("togglefullscreen"));
  assert.equal(allRoles.includes("reload"), false);
  assert.equal(allRoles.includes("toggleDevTools"), false);
});

test("adds reload and developer tools only in development", () => {
  const menu = createApplicationMenuTemplate({ appName: "TaskFlow", isDevelopment: true, platform: "linux" });
  assert.ok(roles(menu).includes("reload"));
  assert.ok(roles(menu).includes("toggleDevTools"));
  const viewMenu = menu.find((item) => item.label === "View");
  const devTools = viewMenu.submenu.find((item) => item.role === "toggleDevTools");
  assert.equal(devTools.accelerator, "Ctrl+Shift+I");
});

test("includes the standard macOS application and window menus", () => {
  const menu = createApplicationMenuTemplate({ appName: "TaskFlow", isDevelopment: false, platform: "darwin" });
  assert.equal(menu[0].label, "TaskFlow");
  assert.equal(menu.at(-1).role, "windowMenu");
  assert.ok(roles(menu).includes("services"));
});
