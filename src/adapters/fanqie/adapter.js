(function () {
globalThis.Fqmail = globalThis.Fqmail || {};

const selectors = globalThis.Fqmail.fanqieSelectors;
const fanqie = globalThis.Fqmail.fanqie;

function matchesReaderPage(locationLike = globalThis.location) {
  const url = locationLike instanceof URL
    ? locationLike
    : (() => {
        try {
          return new URL(locationLike?.href || locationLike);
        } catch {
          return null;
        }
      })();
  return Boolean(
    url &&
    url.protocol === "https:" &&
    url.hostname === "fanqienovel.com" &&
    /^\/reader\/[^/]+/.test(url.pathname),
  );
}

function getReaderBox(documentLike) {
  return documentLike?.querySelector?.(selectors.readerBox) || null;
}

function getCurrentChapterId(locationLike = globalThis.location) {
  return fanqie.getChapterId(locationLike);
}

globalThis.Fqmail.fanqie = Object.assign(fanqie, {
  matchesReaderPage,
  getReaderBox,
  getCurrentChapterId,
});
})();
