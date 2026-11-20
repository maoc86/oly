/* eslint-disable @next/next/no-img-element -- next/og (satori) no admite next/image */
import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";
export const OG_ALT = "Oly Official — Ropa deportiva para mujeres";

const PINK = "#EC4899";
const TAGLINE = "Ropa deportiva para mujeres que entrenan sin límites.";
const SITE_URL = "olyofficial.com";

export async function renderOgImage() {
  const font = await readFile(join(process.cwd(), "src/app/fonts/GeistSans-Regular.ttf"));

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
          backgroundColor: "#08080A",
          backgroundImage:
            "linear-gradient(135deg, #08080A 0%, #14141A 55%, #2A0E1E 100%)",
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
              "radial-gradient(circle, rgba(236,72,153,0.32) 0%, rgba(139,92,246,0.12) 45%, rgba(0,0,0,0) 72%)",
          }}
        />
        <div style={{ display: "flex", alignItems: "baseline", fontSize: 96, fontWeight: 900, letterSpacing: -3, color: "#ffffff" }}>
          Oly<span style={{ color: PINK }}>.</span>
        </div>
        <div
          style={{
            marginTop: 40,
            width: 900,
            display: "flex",
            justifyContent: "center",
            fontSize: 34,
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
            color: PINK,
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
