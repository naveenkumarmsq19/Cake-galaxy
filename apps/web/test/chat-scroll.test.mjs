import test from "node:test";
import assert from "node:assert/strict";
import { isNearChatBottom, scrollChatToBottom } from "../src/components/chatScroll.mjs";

test("new conversation fits in panel and is already at bottom", () => {
  assert.equal(isNearChatBottom({scrollHeight:300,scrollTop:0,clientHeight:400}),true);
});

test("incoming reply auto-scrolls when customer is already near latest message", () => {
  assert.equal(isNearChatBottom({scrollHeight:1000,scrollTop:528,clientHeight:400}),true);
  assert.equal(isNearChatBottom({scrollHeight:1000,scrollTop:527,clientHeight:400}),false);
});

test("incoming reply does not yank customer away from older messages", () => {
  assert.equal(isNearChatBottom({scrollHeight:1500,scrollTop:250,clientHeight:400}),false);
});

test("reaching bottom again re-enables automatic scrolling", () => {
  const pane={scrollHeight:1500,scrollTop:1100,clientHeight:400};
  assert.equal(isNearChatBottom(pane),true);
});

test("bad scroll geometry must not unexpectedly trigger scrolling", () => {
  assert.equal(isNearChatBottom({scrollHeight:NaN,scrollTop:0,clientHeight:400}),false);
  assert.equal(isNearChatBottom({scrollHeight:900,scrollTop:0,clientHeight:400},-1),false);
});

test("chat scroll helper reveals latest reply even when previously scrolled up", () => {
  const pane = { scrollHeight: 1200, scrollTop: 100, clientHeight: 360 };
  scrollChatToBottom(pane);
  assert.equal(pane.scrollTop, 1200);
});

test("chat scroll helper safely handles an unmounted panel", () => {
  assert.doesNotThrow(() => scrollChatToBottom(null));
});
