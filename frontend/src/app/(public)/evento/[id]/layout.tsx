import type { Metadata } from "next";

export const dynamic = "force-dynamic";

const SITE_NAME = "TicketV";
const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://ticketve.com";
const API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface EventMeta {
  title?: string;
  description?: string;
  image_url?: string;
}

async function getEvent(id: string): Promise<EventMeta | null> {
  try {
    const res = await fetch(`${API_URL}/events/${id}`, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    return (await res.json()) as EventMeta;
  } catch {
    return null;
  }
}

/**
 * Metadatos Open Graph / Twitter para la página de un evento.
 * Se generan en el servidor (componente servidor) para que las etiquetas
 * ya existan en el HTML inicial: WhatsApp, Facebook e Instagram no siempre
 * ejecutan JavaScript antes de generar la vista previa del enlace.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const event = await getEvent(id);
  const url = `${SITE_URL}/evento/${id}`;

  if (!event) {
    return {
      title: "Evento | TicketV",
      description: "Compra tus entradas en TicketV",
      openGraph: {
        type: "website",
        locale: "es_ES",
        url,
        siteName: SITE_NAME,
        title: "Evento | TicketV",
        description: "Compra tus entradas en TicketV",
      },
      twitter: {
        card: "summary_large_image",
        title: "Evento | TicketV",
        description: "Compra tus entradas en TicketV",
      },
    };
  }

  const title = event.title || "Evento | TicketV";
  const description =
    String(event.description || "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 160);
  const desc = description || `Entradas para ${title} en TicketV`;
  const image = event.image_url || undefined;

  return {
    title,
    description: desc,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      locale: "es_ES",
      url,
      siteName: SITE_NAME,
      title,
      description: desc,
      images: image ? [{ url: image, width: 1200, height: 630, alt: title }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: desc,
      images: image ? [image] : undefined,
    },
  };
}

export default async function EventoLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await getEvent(id);
  const jsonLd = event
    ? {
        "@context": "https://schema.org",
        "@type": "Event",
        name: event.title,
        description: event.description?.replace(/<[^>]*>/g, " ").trim().slice(0, 300),
        startDate: (event as any).start_date,
        endDate: (event as any).end_date,
        location: {
          "@type": "Place",
          name: (event as any).venue_name || undefined,
        },
        image: event.image_url || undefined,
        offers: {
          "@type": "Offer",
          price: (event as any).ticket_types?.[0]?.price,
          priceCurrency: "USD",
          availability: "https://schema.org/InStock",
          url: `https://ticketve.com/evento/${id}`,
        },
      }
    : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      {children}
    </>
  );
}
