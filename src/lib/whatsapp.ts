/** Opens WhatsApp itself with the message ready to send (the web address on desktops). */
export function whatsappLink(text: string): string {
  const mobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || navigator.maxTouchPoints > 1;
  return `${mobile ? "whatsapp://send" : "https://wa.me/"}?text=${encodeURIComponent(text)}`;
}
