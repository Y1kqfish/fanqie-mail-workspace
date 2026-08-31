(function () {
globalThis.Fqmail = globalThis.Fqmail || {};

if (globalThis.Fqmail.fanqie.matchesReaderPage(globalThis.location)) {
  const tabAppearance = globalThis.Fqmail.tabAppearance?.create?.() || null;
  const earlyTransition = globalThis.Fqmail.earlyTransition?.instance || null;
  const controller = globalThis.Fqmail.controller.create({tabAppearance, earlyTransition});
  globalThis.Fqmail.activeController = controller;
  globalThis.Fqmail.platform.onMessage((message) => {
    if (message?.type === "fqmail:toggle") return controller.toggle();
    return undefined;
  });
  controller.start().then((started) => {
    if (started) earlyTransition?.ready?.();
    else {
      tabAppearance?.restore?.();
      earlyTransition?.release?.();
    }
  }).catch((error) => {
    console.error("[Fqmail] 启动失败");
    controller.reportStartupError?.();
    tabAppearance?.restore?.();
    earlyTransition?.release?.();
  });
}
})();
