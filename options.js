/**
 * The options page. It has no settings on purpose - the only thing here is a
 * passive way to support the add-on, plus a way to make that go away.
 *
 * `localStorage` belongs to the extension's own origin, so the 90 day snooze
 * costs no permission at all (no `storage` permission needed).
 */

import { DONATE_URL } from "./lib/config.js";
import { nextSnoozeUntil, shouldShowDonate, SNOOZE_DAYS } from "./lib/donate.js";

const STORAGE_KEY = "donateHideUntil";

function message(key, substitutions) {
  return browser.i18n.getMessage(key, substitutions) || key;
}

function readHideUntil() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    console.warn("[Attach & Reply] localStorage unavailable", error);
    return null;
  }
}

function writeHideUntil(value) {
  try {
    localStorage.setItem(STORAGE_KEY, String(value));
  } catch (error) {
    console.warn("[Attach & Reply] could not remember the snooze", error);
  }
}

function render() {
  document.title = message("extName");
  document.getElementById("name").textContent = message("extName");
  document.getElementById("description").textContent = message("extDescription");
  document.getElementById("donate-heading").textContent = message("donateHeading");
  document.getElementById("donate-text").textContent = message("donateText", [
    String(SNOOZE_DAYS),
  ]);
  document.getElementById("donate-link").textContent = message("donateButton");
  document.getElementById("donate-link").href = DONATE_URL;
  document.getElementById("donate-done").textContent = message("donateDone");
  document.getElementById("donate-card").hidden = !shouldShowDonate(
    Date.now(),
    readHideUntil()
  );
}

document.getElementById("donate-done").addEventListener("click", () => {
  writeHideUntil(nextSnoozeUntil(Date.now()));
  render();
});

render();
