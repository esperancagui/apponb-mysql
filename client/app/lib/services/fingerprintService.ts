/**
 * Browser fingerprinting service using FingerprintJS (open-source).
 *
 * Generates a stable visitor ID to detect repeat trial signups
 * from the same browser/device.
 */

import FingerprintJS from "@fingerprintjs/fingerprintjs";

let cachedVisitorId: string | null = null;

/**
 * Returns a stable visitor ID for the current browser.
 * The ID persists across sessions on the same device/browser.
 */
export async function getVisitorId(): Promise<string> {
  if (cachedVisitorId) return cachedVisitorId;

  try {
    const fp = await FingerprintJS.load();
    const result = await fp.get();
    cachedVisitorId = result.visitorId;
    return cachedVisitorId;
  } catch {
    // If fingerprinting fails, return empty string — backend will skip the check
    return "";
  }
}
