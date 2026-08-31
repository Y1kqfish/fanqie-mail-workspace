import test from "node:test";
import assert from "node:assert/strict";
import "../src/skins/outlook/tokens.js";

test("Outlook tokens expose the measured Fluent baseline and are frozen", () => {
  const t = globalThis.Fqmail.outlookTokens;
  assert.equal(t.colorBrand, "#0f6cbd");
  assert.equal(t.colorNeutralForeground1, "#242424");
  assert.equal(t.colorNeutralStroke1, "#d1d1d1");
  assert.equal(t.radiusSmall, "4px");
  assert.equal(t.commandHeight, "32px");
  assert.equal(Object.isFrozen(t), true);
  assert.deepEqual({
    topbarHeight: t.topbarHeight,
    appRailWidth: t.appRailWidth,
    ribbonHeight: t.ribbonHeight,
    contentTop: t.contentTop,
    folderOuterWidth: t.folderOuterWidth,
    messageListWidth: t.messageListWidth,
    utilityWidth: t.utilityWidth,
    taskbarHeight: t.taskbarHeight,
    outlookShadow: t.outlookShadow,
  }, {
    topbarHeight: "48px",
    appRailWidth: "40px",
    ribbonHeight: "77px",
    contentTop: "125px",
    folderOuterWidth: "214px",
    messageListWidth: "351px",
    utilityWidth: "305px",
    taskbarHeight: undefined,
    outlookShadow: "rgba(0, 0, 0, .133) 0 1.6px 3.6px, rgba(0, 0, 0, .11) 0 .3px .9px",
  });
});
