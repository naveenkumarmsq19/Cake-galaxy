import test from "node:test";
import assert from "node:assert/strict";
import { readSirenPreference, writeSirenPreference, sirenPreferenceKey } from "../../web/src/components/adminAlertPreferences.js";

test("Admin order siren choice persists through simulated browser refresh", () => {
  const persisted = new Map();
  const localStorage = {
    getItem: key => persisted.get(key) ?? null,
    setItem: (key, value) => persisted.set(key, value)
  };
  assert.equal(readSirenPreference(localStorage), false);
  assert.equal(writeSirenPreference(localStorage, true), true);
  assert.equal(persisted.get(sirenPreferenceKey), "enabled");
  assert.equal(readSirenPreference(localStorage), true);
  // Refresh creates a new component but continues to read the same browser storage.
  assert.equal(readSirenPreference(localStorage), true);
  assert.equal(writeSirenPreference(localStorage, false), true);
  assert.equal(readSirenPreference(localStorage), false);
  assert.equal(persisted.get(sirenPreferenceKey), "muted");
});

test("Unavailable browser storage fails closed without crashing the Admin page", () => {
  const blocked = {
    getItem() { throw new Error("storage blocked"); },
    setItem() { throw new Error("storage blocked"); }
  };
  assert.equal(readSirenPreference(blocked), false);
  assert.equal(writeSirenPreference(blocked, true), false);
  assert.equal(readSirenPreference(undefined), false);
});
