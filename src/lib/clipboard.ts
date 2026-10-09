/**
 * Copies text during a tap. Uses the old selection-based copy, which completes
 * synchronously (iOS Safari drops async clipboard writes when the page loses focus
 * right after the tap), and the Clipboard API as well. Returns true if it worked.
 */
export function copyText(text: string): boolean {
  let ok = false;
  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.top = "0";
  field.style.opacity = "0";
  field.style.fontSize = "16px"; // avoids the zoom-in on focus in iOS Safari
  document.body.appendChild(field);
  try {
    field.focus();
    field.select();
    field.setSelectionRange(0, text.length);
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  field.remove();
  navigator.clipboard?.writeText(text).catch(() => {});
  return ok || Boolean(navigator.clipboard);
}
