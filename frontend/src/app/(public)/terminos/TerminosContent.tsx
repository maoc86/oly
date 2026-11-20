"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  FileText, ShieldCheck, Building2, UserRound, Ticket, Wallet,
  QrCode, RotateCcw, Ban, Copyright, Lock, Scale, RefreshCw, Gavel,
  Mail, Info, AlertTriangle, ChevronRight,
} from "lucide-react";
import { useSiteConfig } from "@/lib/siteConfig";

/** Fecha de la última revisión del documento. */
const UPDATED = "Octubre de 2026";

interface Section {
  id: string;
  icon: LucideIcon;
  title: string;
  body: ReactNode;
}

export default function TerminosContent() {
  const { config } = useSiteConfig();
  const company = config.company_name || "TicketV";
  const email = config.company_email || "soporte@ticketv.com";

  const sections: Section[] = [
    {
      id: "aceptacion",
      icon: FileText,
      title: "1. Aceptación de los términos",
      body: (
        <>
          <p>
            Al acceder, navegar o realizar una compra en <strong>{company}</strong> aceptás de forma
            plena y sin reservas estos Términos y Condiciones, junto con las políticas que los
            complementen. Si no estás de acuerdo con ellos, te pedimos abstenerte de usar la
            plataforma.
          </p>
          <p>
            Podemos actualizar estos términos cuando sea necesario. La versión vigente será siempre
            la publicada en esta página, con su fecha de actualización.
          </p>
        </>
      ),
    },
    {
      id: "rol",
      icon: Building2,
      title: `2. Qué es ${company} y cuál es su rol`,
      body: (
        <>
          <p>
            <strong>{company}</strong> es una plataforma tecnológica que conecta a quienes organizan
            eventos (<em>Organizadores</em>) con las personas que desean comprar entradas
            (<em>Usuarios</em> o <em>compradores</em>).
          </p>
          <p>
            No organizamos, producimos ni operamos los eventos. Nuestra labor es ofrecer las
            herramientas de publicación, venta, cobro y emisión de boletos. El contenido, la fecha,
            el horario, la sede y las condiciones del evento son responsabilidad exclusiva del
            Organizador.
          </p>
          <Callout icon={Info} tone="info">
            En pocas palabras: el evento lo organiza un tercero; nosotros somos el medio de venta y
            cobro.
          </Callout>
        </>
      ),
    },
    {
      id: "cuenta",
      icon: UserRound,
      title: "3. Registro y cuenta del usuario",
      body: (
        <>
          <p>Para comprar necesitás crear una cuenta. El registro es gratuito.</p>
          <ul>
            <li>Declarás que la información que suministrás es verdadera, completa y actualizada.</li>
            <li>
              Si sos persona natural, debés tener al menos 18 años. Si actuás por una persona
              jurídica, debés contar con facultades suficientes para hacerlo.
            </li>
            <li>
              Sos responsable de resguardar tu usuario y contraseña, y de toda actividad realizada
              desde tu cuenta.
            </li>
            <li>
              Podemos suspender o cancelar cuentas ante indicios de fraude, uso indebido o
              incumplimiento de estos términos.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "compra",
      icon: Ticket,
      title: "4. Compra de entradas",
      body: (
        <>
          <p>
            Antes de pagar, revisá con atención el evento, la fecha, la hora, la sede, el sector o
            asiento y la cantidad de entradas.
          </p>
          <ul>
            <li>La disponibilidad no está garantizada hasta que el pago sea confirmado.</li>
            <li>
              Cada evento puede fijar un límite de entradas por persona. Si se excede, la orden puede
              cancelarse sin previo aviso.
            </li>
            <li>
              La confirmación de la compra con el pago procesado constituye una oferta vinculante
              para el comprador.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "precios",
      icon: Wallet,
      title: "5. Precios, cargos por servicio e impuestos",
      body: (
        <>
          <p>
            El precio de la entrada puede incluir un cargo por servicio por el uso de la plataforma,
            así como los impuestos aplicables según la normativa vigente.
          </p>
          <p>
            Antes de confirmar la compra verás el detalle de lo que pagás: precio base, cargo por
            servicio e impuestos. Al continuar, aceptás dicho importe.
          </p>
          <Callout icon={AlertTriangle} tone="warning">
            El cargo por servicio corresponde a un servicio ya prestado y no es reembolsable, salvo
            que la ley disponga lo contrario.
          </Callout>
        </>
      ),
    },
    {
      id: "pagos",
      icon: Wallet,
      title: "6. Formas de pago y confirmación",
      body: (
        <>
          <p>Los métodos de pago disponibles se muestran al momento de finalizar la compra.</p>
          <ul>
            <li>
              Tu compra queda <strong>pendiente</strong> hasta que se verifique y confirme el pago.
            </li>
            <li>
              En métodos manuales (transferencia, pago móvil, criptomonedas o efectivo) puede
              pedírtese indicar una referencia y/o adjuntar el comprobante de pago.
            </li>
            <li>
              Las reservas de asientos son temporales: si el pago no se confirma dentro del plazo
              indicado, la reserva se libera y la orden puede anularse.
            </li>
            <li>La confirmación puede depender de la verificación bancaria correspondiente.</li>
          </ul>
        </>
      ),
    },
    {
      id: "boletos",
      icon: QrCode,
      title: "7. Emisión y uso de los boletos",
      body: (
        <>
          <ul>
            <li>
              Emitimos boletos electrónicos con código QR, salvo que el evento indique otra
              modalidad (boleto físico o retiro en taquilla).
            </li>
            <li>
              El código QR es de un solo uso e intransferible. Su custodia es responsabilidad
              exclusiva del comprador.
            </li>
            <li>
              No nos hacemos responsables por la pérdida, el robo, el daño o el uso indebido del
              código, ni por la reventa realizada fuera de canales autorizados.
            </li>
            <li>
              En caso de robo, se puede evaluar una reimpresión presentando la denuncia
              correspondiente y notificando con antelación al evento.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "devoluciones",
      icon: RotateCcw,
      title: "8. Cancelaciones, reprogramaciones y reembolsos",
      body: (
        <>
          <p>
            Solo procede reembolso cuando el Organizador cancela o reprograma el evento, o cuando
            así lo disponga la ley.
          </p>
          <ul>
            <li>
              El monto a reembolsar corresponde al <strong>precio base</strong> de la entrada. El
              cargo por servicio no es reembolsable por tratarse de un servicio ya prestado.
            </li>
            <li>
              No hay reembolso si no asistís, si no usás el boleto adquirido, o si el evento se
              reprograma por causas de fuerza mayor.
            </li>
            <li>
              El medio y el plazo del reembolso dependen del método de pago utilizado y de los
              procesos administrativos del Organizador.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "eventos-cancelados",
      icon: Ban,
      title: "9. Eventos cancelados o reprogramados",
      body: (
        <>
          <p>
            Si el Organizador cancela o reprograma un evento, te notificaremos a través de los datos
            registrados en tu cuenta.
          </p>
          <p>
            Las condiciones del reembolso se rigen por la sección anterior y por lo que disponga el
            Organizador del evento.
          </p>
        </>
      ),
    },
    {
      id: "prohibiciones",
      icon: Ban,
      title: "10. Usos prohibidos",
      body: (
        <>
          <p>No está permitido:</p>
          <ul>
            <li>Revender entradas sin autorización del Organizador.</li>
            <li>Usar bots, scripts u otros medios automatizados para comprar o reservar.</li>
            <li>Cometer fraude o usar datos o medios de pago de terceros sin su consentimiento.</li>
            <li>Intentar vulnerar, sobrecargar o interferir con la seguridad de la plataforma.</li>
            <li>Publicar o difundir contenido ilícito o engañoso.</li>
          </ul>
          <p>
            El incumplimiento puede derivar en la cancelación de órdenes, la suspensión de la cuenta
            y las acciones legales que correspondan.
          </p>
        </>
      ),
    },
    {
      id: "propiedad",
      icon: Copyright,
      title: "11. Propiedad intelectual",
      body: (
        <>
          <p>
            Los contenidos, marcas, logotipos, textos, imágenes, diseños y software de la plataforma
            pertenecen a <strong>{company}</strong> o a sus licenciantes.
          </p>
          <p>
            No podés copiarlos, reproducirlos, almacenarlos, modificarlos ni usarlos sin autorización
            previa y por escrito.
          </p>
        </>
      ),
    },
    {
      id: "datos",
      icon: Lock,
      title: "12. Protección de datos personales",
      body: (
        <>
          <p>
            Tratamos tus datos personales para gestionar tu registro, tus compras, la emisión de
            boletos y las notificaciones relacionadas con ellas.
          </p>
          <ul>
            <li>
              Podemos compartir la información necesaria con el Organizador del evento y con
              proveedores de pago, únicamente para completar la operación.
            </li>
            <li>No vendemos ni cedemos tus datos a terceros con fines ajenos a la compra.</li>
            <li>
              Podés solicitar acceso, corrección o eliminación de tus datos escribiendo a{" "}
              <a href={`mailto:${email}`} className="font-medium text-brand-700 hover:underline">
                {email}
              </a>
              .
            </li>
          </ul>
          <Callout icon={ShieldCheck} tone="info">
            Usamos tus datos de contacto (incluidos teléfono y cédula) para emitir boletos y
            comunicarnos con vos sobre tu compra.
          </Callout>
        </>
      ),
    },
    {
      id: "responsabilidad",
      icon: Scale,
      title: "13. Limitación de responsabilidad y fuerza mayor",
      body: (
        <>
          <ul>
            <li>
              No respondemos por actos u omisiones de los Organizadores ni de terceros vinculados al
              evento.
            </li>
            <li>No garantizamos la disponibilidad ininterrumpida ni libre de errores del sitio.</li>
            <li>
              Quedamos liberados de responsabilidad ante hechos de fuerza mayor, entendidos como
              acontecimientos extraordinarios, imprevisibles e irresistibles (desastres naturales,
              crisis sanitarias, alteraciones del orden público, entre otros).
            </li>
            <li>
              En la medida permitida por la ley, nuestra responsabilidad se limita al monto del cargo
              por servicio efectivamente cobrado.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "modificaciones",
      icon: RefreshCw,
      title: "14. Modificaciones de estos términos",
      body: (
        <>
          <p>
            Podemos modificar estos Términos y Condiciones en cualquier momento. Publicaremos la
            versión actualizada en esta página con su nueva fecha.
          </p>
          <p>
            El uso de la plataforma después de una actualización implica la aceptación de los cambios.
            Te recomendamos revisar esta página periódicamente.
          </p>
        </>
      ),
    },
    {
      id: "ley",
      icon: Gavel,
      title: "15. Ley aplicable y contacto",
      body: (
        <>
          <p>
            Estos Términos y Condiciones se rigen por las leyes de la República Bolivariana de
            Venezuela.
          </p>
          <p>
            Cualquier controversia derivada de su interpretación o aplicación se someterá a los
            tribunales competentes de Venezuela.
          </p>
          <p>
            Para consultas sobre estos términos escribinos a{" "}
            <a href={`mailto:${email}`} className="font-medium text-brand-700 hover:underline">
              {email}
            </a>
            .
          </p>
        </>
      ),
    },
  ];

  return (
    <div className="bg-white">
      {/* Encabezado */}
      <section className="relative overflow-hidden bg-ink-950 text-white">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 -right-16 w-80 h-80 rounded-full bg-brand-500/15 blur-3xl" />
          <div className="absolute -bottom-28 left-1/4 w-96 h-96 rounded-full bg-accent-500/10 blur-3xl" />
        </div>
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-20">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-brand-400">
            <ShieldCheck className="w-4 h-4" /> Legal
          </span>
          <h1 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">
            Términos y Condiciones
          </h1>
          <p className="mt-4 text-lg text-gray-300 max-w-2xl">
            Las reglas que rigen el uso de {company} y la compra de entradas en nuestra plataforma.
          </p>
          <p className="mt-3 text-sm text-gray-400">Última actualización: {UPDATED}</p>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
        <div className="grid gap-10 lg:grid-cols-[260px_1fr]">
          {/* Índice lateral (escritorio) */}
          <aside className="hidden lg:block">
            <div className="lg:sticky lg:top-24">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4">
                En esta página
              </p>
              <nav>
                <ol className="space-y-1 border-l border-gray-200">
                  {sections.map((s) => (
                    <li key={s.id}>
                      <a
                        href={`#${s.id}`}
                        className="block pl-3 -ml-px border-l-2 border-transparent text-sm text-gray-500 hover:text-brand-800 hover:border-brand-500 transition-colors py-1"
                      >
                        {s.title.replace(/^\d+\.\s*/, "")}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>

              <div className="mt-6 rounded-2xl border border-gray-100 bg-gray-50 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <Mail className="w-4 h-4" /> ¿Dudas?
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Escribinos y te ayudamos con tu compra.
                </p>
                <a
                  href={`mailto:${email}`}
                  className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline break-all"
                >
                  {email}
                </a>
              </div>
            </div>
          </aside>

          {/* Contenido */}
          <div className="min-w-0">
            {/* Resumen */}
            <div className="rounded-2xl border border-brand-200 bg-brand-50 p-5 sm:p-6">
              <p className="flex items-center gap-2 font-bold text-ink-900">
                <ShieldCheck className="w-5 h-5 text-brand-700" /> En resumen
              </p>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2 text-sm text-ink-700">
                <li className="flex gap-2">
                  <ChevronRight className="w-4 h-4 mt-0.5 text-brand-700 shrink-0" />
                  <span>{company} es un intermediario de venta; el evento lo organiza un tercero.</span>
                </li>
                <li className="flex gap-2">
                  <ChevronRight className="w-4 h-4 mt-0.5 text-brand-700 shrink-0" />
                  <span>Tu compra se confirma cuando se verifica el pago.</span>
                </li>
                <li className="flex gap-2">
                  <ChevronRight className="w-4 h-4 mt-0.5 text-brand-700 shrink-0" />
                  <span>El cargo por servicio no es reembolsable.</span>
                </li>
                <li className="flex gap-2">
                  <ChevronRight className="w-4 h-4 mt-0.5 text-brand-700 shrink-0" />
                  <span>El código QR de tu boleto es personal e intransferible.</span>
                </li>
              </ul>
            </div>

            {/* Índice (móvil) */}
            <details className="mt-6 lg:hidden rounded-2xl border border-gray-200 bg-white p-4">
              <summary className="cursor-pointer text-sm font-semibold text-gray-900">
                Ver contenido
              </summary>
              <ol className="mt-3 space-y-1.5 text-sm">
                {sections.map((s) => (
                  <li key={s.id}>
                    <a href={`#${s.id}`} className="text-gray-600 hover:text-brand-800">
                      {s.title.replace(/^\d+\.\s*/, "")}
                    </a>
                  </li>
                ))}
              </ol>
            </details>

            {/* Secciones */}
            <div className="mt-8 space-y-10">
              {sections.map((s) => (
                <section key={s.id} id={s.id} className="scroll-mt-28">
                  <div className="flex items-start gap-3">
                    <span className="grid place-items-center w-10 h-10 shrink-0 rounded-xl bg-ink-900 text-brand-400">
                      <s.icon className="w-5 h-5" />
                    </span>
                    <h2 className="text-xl font-bold text-gray-900 pt-1.5">{s.title}</h2>
                  </div>
                  <div className="mt-4 space-y-3 text-[15px] leading-relaxed text-gray-600 [&_ul]:space-y-2 [&_ul]:pl-5 [&_ul]:list-disc [&_strong]:text-gray-900">
                    {s.body}
                  </div>
                </section>
              ))}
            </div>

            {/* Cierre */}
            <div className="mt-12 rounded-2xl border border-gray-100 bg-gray-50 p-6 text-center">
              <p className="text-gray-700">
                Al usar {company} confirmás que leíste y aceptás estos Términos y Condiciones.
              </p>
              <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:justify-center">
                <Link
                  href="/eventos"
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-brand-500 text-ink-900 hover:bg-brand-400 transition-colors"
                >
                  Explorar eventos
                </Link>
                <a
                  href={`mailto:${email}`}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors"
                >
                  <Mail className="w-4 h-4" /> Contactar soporte
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Callout({
  icon: Icon,
  tone,
  children,
}: {
  icon: LucideIcon;
  tone: "info" | "warning";
  children: ReactNode;
}) {
  const styles =
    tone === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : "border-gray-200 bg-gray-50 text-gray-700";
  return (
    <div className={`flex items-start gap-2.5 rounded-xl border p-3.5 text-sm ${styles}`}>
      <Icon className="w-4 h-4 mt-0.5 shrink-0" />
      <p>{children}</p>
    </div>
  );
}
