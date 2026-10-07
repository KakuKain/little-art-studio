import test from "node:test";
import assert from "node:assert/strict";
import { setStatus } from "../modules/ui.js";

test("storage recovery instructions are visible without keyword matching; automatic saves stay quiet", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const nodes = {
    hint: { textContent: "" },
    notice: { textContent: "", hidden: true },
  };
  globalThis.document = { getElementById: (id) => nodes[id] };
  const message = "儲存尚未就緒，請關閉其他畫室分頁後重新整理";
  setStatus(message, { notify: true });
  assert.equal(nodes.notice.hidden, false);
  assert.equal(nodes.notice.textContent, message);
  setStatus("已保存到這台手機 ✦");
  assert.equal(nodes.hint.textContent, "已保存到這台手機 ✦");
  assert.equal(nodes.notice.textContent, message);
  t.mock.timers.tick(10000);
  assert.equal(nodes.notice.hidden, true);
  delete globalThis.document;
});
