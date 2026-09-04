const fs = require("node:fs");
const path = require("node:path");
const { net, protocol } = require("electron");
const { pathToFileURL } = require("node:url");

const APP_SCHEME = "taskflow-app";
const APP_ORIGIN = `${APP_SCHEME}://app`;

function registerAppScheme() {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: APP_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
      },
    },
  ]);
}

function isFileInside(directory, candidate) {
  const relative = path.relative(directory, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function resolveRendererFile(rendererDirectory, requestUrl) {
  const url = new URL(requestUrl);
  if (url.hostname !== "app") return null;

  let pathname;

  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return null;
  }

  const requestedPath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const candidate = path.resolve(rendererDirectory, requestedPath);

  if (!isFileInside(rendererDirectory, candidate)) return null;
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  if (path.extname(requestedPath)) return null;

  // Preserve the existing browser-history routes in the packaged application.
  return path.join(rendererDirectory, "index.html");
}

async function installAppProtocol(rendererDirectory) {
  await protocol.handle(APP_SCHEME, (request) => {
    const filePath = resolveRendererFile(rendererDirectory, request.url);
    if (!filePath) return new Response("Not found", { status: 404 });
    return net.fetch(pathToFileURL(filePath).toString());
  });
}

module.exports = {
  APP_ORIGIN,
  installAppProtocol,
  registerAppScheme,
  resolveRendererFile,
};
