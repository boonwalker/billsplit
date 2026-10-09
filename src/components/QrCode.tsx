import QRCode from "qrcode";
import { useEffect, useState } from "react";

export default function QrCode({ value, label }: { value: string; label: string }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    QRCode.toString(value, { type: "svg", errorCorrectionLevel: "M", margin: 1, color: { dark: "#0d1f17", light: "#ffffff" } })
      .then(setSvg)
      .catch(() => setSvg(""));
  }, [value]);
  // The SVG markup is generated locally by the qrcode library from our own URL.
  return <div className="qr" role="img" aria-label={label} dangerouslySetInnerHTML={{ __html: svg }} />;
}
