/* eslint-disable @next/next/no-img-element -- next/og (satori) no admite next/image */
import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/** Tamaño estándar de la tarjeta social (Open Graph / Twitter). */
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";
export const OG_ALT = "TicketV — Descubrí eventos y comprá tus entradas";

const AMBER = "#FFB600";
const TAGLINE = "Descubrí eventos y comprá tus entradas de forma fácil y segura.";
const SITE_URL = "ticketve.com";

/**
 * Genera la tarjeta social del sitio (fondo oscuro con glow ámbar + logo).
 * Se usa tanto para `opengraph-image` como para `twitter-image`.
 */
export async function renderOgImage() {
  const [font, logo] = await Promise.all([
    readFile(join(process.cwd(), "src/app/fonts/GeistSans-Regular.ttf")),
    readFile(join(process.cwd(), "public/brand/logo-ticketv-on-dark.png")),
  ]);
  const logoData = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0B0B0F",
          backgroundImage:
            "linear-gradient(135deg, #0B0B0F 0%, #141419 55%, #1E1809 100%)",
          position: "relative",
          padding: "0 90px",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -180,
            left: 180,
            width: 840,
            height: 560,
            display: "flex",
            backgroundImage:
              "radial-gradient(circle, rgba(255,182,0,0.32) 0%, rgba(255,182,0,0.10) 45%, rgba(255,182,0,0) 72%)",
          }}
        />
        <img src={logoData} width={520} height={177} alt="" />
        <div
          style={{
            marginTop: 46,
            width: 900,
            display: "flex",
            justifyContent: "center",
            fontSize: 36,
            lineHeight: 1.4,
            color: "#D4D4D8",
            textAlign: "center",
          }}
        >
          {TAGLINE}
        </div>
        <div
          style={{
            marginTop: 42,
            display: "flex",
            fontSize: 26,
            letterSpacing: 2,
            color: AMBER,
          }}
        >
          {SITE_URL}
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [{ name: "Geist", data: font, style: "normal", weight: 400 }],
    }
  );
}
