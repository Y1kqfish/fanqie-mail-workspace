(function () {
  globalThis.Fqmail = globalThis.Fqmail || {};

  const MESSAGE_PREFIX = "fqmail:catalog-session-";

  function create({runtime = globalThis.Fqmail.platform?.browser?.runtime || globalThis.browser?.runtime || globalThis.chrome?.runtime} = {}) {
    async function send(action, payload = {}) {
      if (typeof runtime?.sendMessage !== "function") throw new Error("目录会话不可用");
      return runtime.sendMessage({type: MESSAGE_PREFIX + action, ...payload});
    }

    return {
      save(payload) { return send("save", payload); },
      restore(payload) { return send("restore", payload); },
      clear() { return send("clear"); },
    };
  }

  globalThis.Fqmail.catalogSession = {create};
})();
