import test from "node:test";
import assert from "node:assert/strict";
import "../src/skins/outlook/fluent-icons.js";
import "../src/skins/outlook/tokens.js";
import "../src/skins/outlook/personas.js";
import "../src/skins/outlook/components.js";
import "../src/skins/outlook/index.js";

test("Outlook skin exposes the measured M2 workspace references", () => {
  const skin = globalThis.Fqmail.outlook.create({documentLike: {
    createElement(tagName) {
      return {tagName, className: "", children: [], setAttribute() {}, append(...nodes) {this.children.push(...nodes);}, addEventListener() {}};
    },
    createElementNS(namespaceURI, tagName) {
      return {namespaceURI, tagName, children: [], classList: {add() {}}, setAttribute() {}, append(...nodes) {this.children.push(...nodes);}};
    },
  }});
  for (const ref of ["topbar", "searchBox", "appRail", "ribbon", "folderPane", "messageListPane", "readerPane", "utilityRail", "prevButton", "nextButton", "restoreButton", "toggleButton", "status"]) {
    assert.ok(skin.refs[ref], ref);
  }
});
