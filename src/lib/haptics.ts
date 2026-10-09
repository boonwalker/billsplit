/**
 * Haptic feedback via the phone's vibration motor.
 *
 * Android browsers support the Vibration API with free patterns. iOS Safari does not; there the
 * only way to the Taptic Engine is the native switch control (`<input type="checkbox" switch>`,
 * iOS 18+), which gives one light tick each time it toggles. A pattern is played there as a
 * series of such ticks at the start of every pulse.
 */

/** Alternating on/off durations in milliseconds, as for `navigator.vibrate`. */
type Pattern = number[];

let iosSwitch: HTMLLabelElement | null = null;

function tickIos() {
  if (!iosSwitch) {
    const label = document.createElement("label");
    label.setAttribute("aria-hidden", "true");
    label.style.cssText = "position:fixed;left:-100px;top:0;width:1px;height:1px;opacity:0;overflow:hidden;pointer-events:none";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("switch", "");
    input.tabIndex = -1;
    label.append(input);
    document.body.append(label);
    iosSwitch = label;
  }
  iosSwitch.click();
}

export function vibrate(pattern: Pattern): void {
  try {
    if (typeof navigator.vibrate === "function") {
      navigator.vibrate(pattern);
      return;
    }
    let at = 0;
    pattern.forEach((ms, i) => {
      if (i % 2 === 0) window.setTimeout(tickIos, at);
      at += ms;
    });
  } catch {
    // No vibration motor or not allowed: the visual transition has to do.
  }
}

/**
 * A QR code was recognised and the bill opens: a short double tap, a brief pause and a
 * fuller pulse to finish – like a lock clicking into place.
 */
export function confirmScan(): void {
  // Scanning in the app and then joining the bill is one moment: confirm it only once.
  if (Date.now() - lastConfirm < 5000) return;
  lastConfirm = Date.now();
  vibrate([14, 55, 14, 110, 45]);
}

let lastConfirm = 0;
