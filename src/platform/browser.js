(function () {
globalThis.Fqmail = globalThis.Fqmail || {};

const extensionBrowser = globalThis.browser || globalThis.chrome || {};

globalThis.Fqmail.platform = {
  browser: extensionBrowser,
  getStorageArea() {
    return extensionBrowser.storage?.local || null;
  },
  onMessage(listener) {
    extensionBrowser.runtime?.onMessage?.addListener(listener);
  },
};
})();
