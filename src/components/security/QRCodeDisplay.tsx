interface QRCodeDisplayProps {
  value: string;
  size?: number;
}

// Simple QR code display using a QR code API
// In production, replace with a client-side library like qrcode.react
export default function QRCodeDisplay({ value, size = 200 }: QRCodeDisplayProps) {
  const encodedData = encodeURIComponent(value);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodedData}&format=svg&margin=8`;

  return (
    <div className="flex items-center justify-center">
      <div className="bg-white p-3 rounded-xl shadow-sm inline-block">
        <img
          src={qrUrl}
          alt="Gate entry QR code"
          width={size}
          height={size}
          className="rounded-lg"
        />
      </div>
    </div>
  );
}
