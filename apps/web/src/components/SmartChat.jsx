/**
 * Keep the chat pinned to its newest message only while the customer
 * is already reading near the bottom. A customer reviewing older messages
 * should not be unexpectedly moved by an incoming reply.
 */
export function isNearChatBottom({
  scrollHeight,
  scrollTop,
  clientHeight,
}, threshold = 72) {
  if (![scrollHeight, scrollTop, clientHeight, threshold].every(Number.isFinite) || threshold < 0) {
    return false;
  }
  return scrollHeight - scrollTop - clientHeight <= threshold;
}

/** Scroll the conversation container to its newest message. */
export function scrollChatToBottom(feed) {
  if (!feed) return;
  feed.scrollTop = feed.scrollHeight;
}
