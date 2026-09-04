const { Menu, app } = require("electron");
const { createApplicationMenuTemplate } = require("./menu-template.cjs");

function installApplicationMenu({ isDevelopment }) {
  const template = createApplicationMenuTemplate({
    appName: app.name,
    isDevelopment,
    platform: process.platform,
  });

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

module.exports = { installApplicationMenu };
