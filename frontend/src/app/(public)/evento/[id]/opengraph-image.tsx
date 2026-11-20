import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "TicketV";
export const revalidate = 300;

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://api.ticketve.com";

interface EventMeta {
  title?: string;
  description?: string;
  image_url?: string;
  start_date?: string;
  venue?: { name?: string; city?: string } | null;
}

const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const DAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

async function getEvent(id: string): Promise<EventMeta | null> {
  try {
    const res = await fetch(`${API_URL}/events/${id}`, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    return (await res.json()) as EventMeta;
  } catch {
    return null;
  }
}

/** Descarga una imagen remota y la devuelve como data URL para embeberla en el PNG. */
async function toDataUrl(url?: string): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const type = res.headers.get("content-type") || "image/png";
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length) return null;
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

/** Logo de marca (vive en /public, disponible también en la imagen Docker final). */
async function readLogo(): Promise<string | null> {
  try {
    const buf = await readFile(join(process.cwd(), "public/brand/logo-ticketv-on-dark.png"));
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

function formatDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const day = DAYS[d.getDay()] ?? "";
  const month = MONTHS[d.getMonth()] ?? "";
  return `${day} ${d.getDate()} de ${month} de ${d.getFullYear()}`;
}

/**
 * Imagen Open Graph (1200x630) generada por evento: banner horizontal del
 * evento + título + fecha/lugar + logo TicketV. Es la imagen que muestran
 * WhatsApp, Facebook e Instagram al compartir el enlace de /evento/[id].
 */
export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = (await getEvent(id)) ?? {};

  const title = event.title || "Evento en TicketV";
  const banner = await toDataUrl(event.image_url);
  const logo = await readLogo();

  const when = formatDate(event.start_date);
  const where = [event.venue?.name, event.venue?.city].filter(Boolean).join(" · ");
  const subtitle = [when, where].filter(Boolean).join("   ·   ");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#0B0B0F",
        }}
      >
        {banner ? (
          <div style={{ width: "100%", height: 300, display: "flex", overflow: "hidden" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={banner}
              width={1200}
              height={300}
              style={{ objectFit: "cover", objectPosition: "center" }}
            />
          </div>
        ) : (
          <div
            style={{
              width: "100%",
              height: 300,
              display: "flex",
              backgroundImage: "linear-gradient(135deg, #FFB600 0%, #FF8A00 100%)",
            }}
          />
        )}

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "36px 56px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} width={100} height={34} style={{ objectFit: "contain" }} />
            ) : (
              <div style={{ fontSize: 32, color: "#FFB600" }}>TicketV</div>
            )}
            <div style={{ fontSize: 24, color: "#9A9AA5" }}>ticketve.com</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 50, color: "#FFFFFF", lineHeight: 1.15 }}>{title}</div>
            {subtitle ? (
              <div style={{ marginTop: 14, fontSize: 26, color: "#CFCFD6" }}>{subtitle}</div>
            ) : null}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
