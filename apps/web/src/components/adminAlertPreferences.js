// The audible-alert preference belongs to this browser profile, not to an order.
// It survives refreshes, while a muted preference remains muted.
export const sirenPreferenceKey = "cakegalaxy.admin.siren-enabled";

export function readSirenPreference(storage) {
  try { return storage?.getItem(sirenPreferenceKey) === "enabled"; }
  catch { return false; } // Private mode or disabled storage.
}

export function writeSirenPreference(storage, enabled) {
  try { storage?.setItem(sirenPreferenceKey, enabled ? "enabled" : "muted"); return true; }
  catch { return false; }
}
