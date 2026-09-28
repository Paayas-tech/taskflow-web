function createApplicationMenuTemplate({ appName, isDevelopment, platform }) {
  return [
    ...(platform === "darwin"
      ? [
          {
            label: appName,
            submenu: [
              { role: "about" },
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ],
          },
        ]
      : []),
    {
      label: "File",
      submenu: [
        { label: "Close Window", role: "close" },
        { type: "separator" },
        { label: `Quit ${appName}`, role: "quit" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        ...(platform === "darwin" ? [{ role: "pasteAndMatchStyle" }] : []),
        { role: "delete" },
        { type: "separator" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        ...(isDevelopment
          ? [
              { role: "reload" },
              {
                role: "toggleDevTools",
                accelerator: platform === "darwin" ? "Cmd+Alt+I" : "Ctrl+Shift+I",
              },
              { type: "separator" },
            ]
          : []),
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    { role: "windowMenu" },
  ];
}

module.exports = { createApplicationMenuTemplate };
