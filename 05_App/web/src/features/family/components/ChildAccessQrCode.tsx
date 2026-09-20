import qrcode from "qrcode-generator";

// Sprint 55: tegner selv QR-matricen som inline SVG — INGEN ekstern
// webtjeneste, og PIN-koden indgår aldrig i dataene (kun samme
// /barn/:token-URL som "kopiér link"-knappen bruger). Bevidst sort på hvid
// baggrund uanset appens tema (lys/mørk) — kontrasten er afgørende for at
// en telefon/tablet-kamera reelt kan scanne koden.
interface ChildAccessQrCodeProps {
  value: string;
  size?: number;
}

export function ChildAccessQrCode({ value, size = 176 }: ChildAccessQrCodeProps) {
  const code = qrcode(0, "M");
  code.addData(value);
  code.make();

  const moduleCount = code.getModuleCount();
  const cellSize = size / moduleCount;

  const rects: string[] = [];
  for (let row = 0; row < moduleCount; row += 1) {
    for (let col = 0; col < moduleCount; col += 1) {
      if (code.isDark(row, col)) {
        rects.push(`M${col * cellSize},${row * cellSize}h${cellSize}v${cellSize}h${-cellSize}z`);
      }
    }
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`QR-kode til børneadgangslinket. Linket er ${value}`}
      style={{ borderRadius: 8, backgroundColor: "#FFFFFF" }}
    >
      <path d={rects.join(" ")} fill="#000000" />
    </svg>
  );
}
