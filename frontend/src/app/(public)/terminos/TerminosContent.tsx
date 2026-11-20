"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  FileText, ShieldCheck, Building2, UserRound, Shirt, Wallet,
  CreditCard, Truck, RotateCcw, Ban, Copyright, Lock, Scale, RefreshCw, Gavel,
  Mail, Info, AlertTriangle, ChevronRight,
} from "lucide-react";
import { useSiteConfig } from "@/lib/siteConfig";

/** Fecha de la última revisión del documento. */
const UPDATED = "Noviembre de 2026";

interface Section {
  id: string;
  icon: LucideIcon;
  title: string;
  body: ReactNode;
}

export default function TerminosContent() {
  const { config } = useSiteConfig();
  const company = config.company_name || "Oly Official";
  const email = config.company_email || "hola@olyofficial.com";

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
            complementen. Si no estás de acuerdo con ellos, te pedimos abstenerte de usar la tienda.
          </p>
          <p>
            Podemos actualizar estos términos cuando sea necesario. La versión vigente será siempre
            la publicada en esta página, con su fecha de actualización.
          </p>
        </>
      ),
    },
    {
      id: "quienes-somos",
      icon: Building2,
      title: `2. Quiénes somos`,
      body: (
        <>
          <p>
            <strong>{company}</strong> es una tienda online dedicada a la venta de ropa deportiva,
            principalmente para mujer. Vendemos de forma directa nuestros propios productos a través
            de esta plataforma.
          </p>
          <p>
            A lo largo de estos términos, nos referimos a <strong>{company}</strong> como
            &ldquo;la tienda&rdquo;, &ldquo;nosotros&rdquo; o &ldquo;nos&rdquo;, y a quien compra como
            &ldquo;el cliente&rdquo; o &ldquo;vos&rdquo;.
          </p>
          <Callout icon={Info} tone="info">
            Somos el vendedor directo de los productos: comprás directamente a {company}, no a un
            tercero.
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
      id: "productos",
      icon: Shirt,
      title: "4. Productos, tallas y disponibilidad",
      body: (
        <>
          <p>
            Hacemos nuestro mayor esfuerzo por mostrar imágenes, descripciones, tallas y colores de
            forma fiel. Sin embargo, los colores pueden variar levemente según la pantalla de tu
            dispositivo.
          </p>
          <ul>
            <li>
              La disponibilidad de cada producto depende del stock de la talla y el color elegidos.
              Si un artículo se agota, podés consultarnos por reposición.
            </li>
            <li>
              Te recomendamos revisar la guía de tallas y las medidas antes de comprar, ya que los
              cambios de talla están sujetos a las condiciones de la sección de cambios y devoluciones.
            </li>
            <li>Las promociones u ofertas están vigentes mientras se muestren en la tienda.</li>
          </ul>
        </>
      ),
    },
    {
      id: "precios",
      icon: Wallet,
      title: "5. Precios y moneda",
      body: (
        <>
          <p>Los precios se publican en dólares estadounidenses (USD).</p>
          <p>
            Para tu comodidad, podés ver el equivalente en bolívares (Bs.) usando la tasa de cambio
            vigente al momento de la consulta. El monto en bolívares se calcula con la tasa activa de
            la tienda y puede variar hasta que se confirme el pago.
          </p>
          <p>
            Antes de confirmar el pedido verás el detalle del total, incluidos los impuestos
            aplicables y el costo de envío.
          </p>
          <Callout icon={AlertTriangle} tone="warning">
            El total a pagar es el que se muestra en el resumen final del checkout al momento de tu
            compra.
          </Callout>
        </>
      ),
    },
    {
      id: "pedidos-pago",
      icon: CreditCard,
      title: "6. Pedidos y forma de pago",
      body: (
        <>
          <p>Los métodos de pago disponibles se muestran al finalizar la compra.</p>
          <ul>
            <li>
              Tu pedido queda en estado <strong>pendiente</strong> hasta que verifiquemos y
              confirmemos el pago.
            </li>
            <li>
              En métodos manuales (transferencia bancaria, pago móvil, criptomonedas o efectivo)
              puede pedírtese indicar una referencia y/o adjuntar el comprobante de pago.
            </li>
            <li>
              La confirmación del pedido puede depender de la verificación bancaria correspondiente.
              Solo después de confirmar el pago apartamos el stock y preparamos el envío.
            </li>
            <li>
              Nos reservamos el derecho de cancelar órdenes que no hayan sido pagadas o cuyo pago no
              pueda verificarse.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "envios",
      icon: Truck,
      title: "7. Envíos y entregas",
      body: (
        <>
          <p>
            Realizamos envíos dentro del territorio venezolano. El costo y el tiempo estimado de
            entrega se muestran al elegir el método de envío en el checkout.
          </p>
          <ul>
            <li>Los tiempos de entrega son estimados y pueden variar por causas ajenas a nosotros.</li>
            <li>
              Es tu responsabilidad indicar correctamente la dirección, la ciudad y el estado de
              entrega. No nos hacemos responsables por entregas fallidas por datos incompletos o
              incorrectos.
            </li>
            <li>
              Una vez que el paquete se entrega al transportista, el riesgo del envío se transfiere a
              tu cargo, salvo que elijas una modalidad con seguro.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "cambios-devoluciones",
      icon: RotateCcw,
      title: "8. Cambios y devoluciones",
      body: (
        <>
          <p>Queremos que estés satisfecha con tu compra. Aplican las siguientes reglas:</p>
          <ul>
            <li>
              Podés solicitar un <strong>cambio de talla</strong> dentro de los 7 días calendario
              siguientes a la entrega, siempre que la prenda esté sin usar, sin lavar y con sus
              etiquetas originales.
            </li>
            <li>
              Los gastos de envío asociados al cambio corren por cuenta del cliente, salvo que el
              producto presente un defecto de fabricación.
            </li>
            <li>
              Si el producto llega con un <strong>defecto de fabricación</strong> o no corresponde a
              lo que compraste, comunicalo dentro de las 48 horas siguientes a la entrega para
              gestionar el cambio o la devolución.
            </li>
            <li>
              No se aceptan devoluciones por talla ni por cambio de opinión. En caso de proceder un
              reembolso, se hará por el mismo medio de pago utilizado.
            </li>
          </ul>
          <Callout icon={Info} tone="info">
            Para iniciar un cambio o reportar un defecto, escribinos a{" "}
            <a href={`mailto:${email}`} className="font-medium underline">{email}</a> con tu número de
            pedido y una foto del producto.
          </Callout>
        </>
      ),
    },
    {
      id: "prohibiciones",
      icon: Ban,
      title: "9. Usos prohibidos",
      body: (
        <>
          <p>No está permitido:</p>
          <ul>
            <li>Usar bots, scripts u otros medios automatizados para comprar o acaparar stock.</li>
            <li>Cometer fraude o usar datos o medios de pago de terceros sin su consentimiento.</li>
            <li>Intentar vulnerar, sobrecargar o interferir con la seguridad de la tienda.</li>
            <li>Publicar o difundir contenido ilícito, difamatorio o engañoso.</li>
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
      title: "10. Propiedad intelectual",
      body: (
        <>
          <p>
            Los contenidos, marcas, logotipos, textos, imágenes, diseños y software de la tienda
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
      title: "11. Protección de datos personales",
      body: (
        <>
          <p>
            Tratamos tus datos personales para gestionar tu registro, tus pedidos, los envíos y las
            notificaciones relacionadas con tu compra.
          </p>
          <ul>
            <li>
              Podemos compartir la información necesaria con transportistas y proveedores de pago,
              únicamente para completar la operación.
            </li>
            <li>No vendemos ni cedemos tus datos a terceros con fines ajenos a tu compra.</li>
            <li>
              Podés solicitar acceso, corrección o eliminación de tus datos escribiendo a{" "}
              <a href={`mailto:${email}`} className="font-medium text-brand-700 hover:underline">
                {email}
              </a>
              .
            </li>
          </ul>
          <Callout icon={ShieldCheck} tone="info">
            Usamos tus datos de contacto (incluidos teléfono y cédula) para coordinar la entrega y
            comunicarnos con vos sobre tu pedido.
          </Callout>
        </>
      ),
    },
    {
      id: "responsabilidad",
      icon: Scale,
      title: "12. Limitación de responsabilidad y fuerza mayor",
      body: (
        <>
          <ul>
            <li>
              No respondemos por actos u omisiones de transportistas, proveedores de pago ni otros
              terceros vinculados a la operación.
            </li>
            <li>No garantizamos la disponibilidad ininterrumpida ni libre de errores del sitio.</li>
            <li>
              Quedamos liberados de responsabilidad ante hechos de fuerza mayor, entendidos como
              acontecimientos extraordinarios, imprevisibles e irresistibles (desastres naturales,
              crisis sanitarias, alteraciones del orden público, entre otros).
            </li>
            <li>
              En la medida permitida por la ley, nuestra responsabilidad se limita al valor del
              producto adquirido.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "modificaciones",
      icon: RefreshCw,
      title: "13. Modificaciones de estos términos",
      body: (
        <>
          <p>
            Podemos modificar estos Términos y Condiciones en cualquier momento. Publicaremos la
            versión actualizada en esta página con su nueva fecha.
          </p>
          <p>
            El uso de la tienda después de una actualización implica la aceptación de los cambios. Te
            recomendamos revisar esta página periódicamente.
          </p>
        </>
      ),
    },
    {
      id: "ley",
      icon: Gavel,
      title: "14. Ley aplicable y contacto",
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
            Las reglas que rigen el uso de {company} y la compra de productos en nuestra tienda.
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
                  <span>Comprás directamente a {company}.</span>
                </li>
                <li className="flex gap-2">
                  <ChevronRight className="w-4 h-4 mt-0.5 text-brand-700 shrink-0" />
                  <span>Tu pedido se confirma cuando verificamos el pago.</span>
                </li>
                <li className="flex gap-2">
                  <ChevronRight className="w-4 h-4 mt-0.5 text-brand-700 shrink-0" />
                  <span>Revisá talla y color antes de pagar.</span>
                </li>
                <li className="flex gap-2">
                  <ChevronRight className="w-4 h-4 mt-0.5 text-brand-700 shrink-0" />
                  <span>Los cambios de talla aplican dentro de 7 días, con etiquetas.</span>
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
                  href="/productos"
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-brand-500 text-ink-900 hover:bg-brand-400 transition-colors"
                >
                  Explorar tienda
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
