import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Términos y Condiciones — Box',
  description: 'Términos y condiciones del servicio Box (gestión de compras institucionales).',
};

/**
 * Términos y Condiciones — plantilla base para SaaS AR.
 * Revisar con un abogado antes de operar a escala. La fecha de entrada
 * en vigencia es la que figura abajo: actualizala cada vez que cambien
 * los términos y notificá a los usuarios por email.
 */
export default function TerminosPage() {
  return (
    <article className="legal-doc">
      <header>
        <Link href="/inicio" style={{ color: 'var(--color-primary, #1677ff)' }}>
          ← Volver al inicio
        </Link>
        <h1>Términos y Condiciones</h1>
        <p className="meta">Entrada en vigencia: 23 de abril de 2026</p>
      </header>

      <section>
        <h2>1. Aceptación</h2>
        <p>
          Al crear una cuenta en Box (en adelante, el &quot;Servicio&quot;) o al utilizarlo, el
          usuario y la organización titular (en adelante, el &quot;Cliente&quot;) aceptan
          íntegramente estos Términos y Condiciones y la{' '}
          <Link href="/privacidad">Política de Privacidad</Link>. Si no estás de acuerdo con alguno
          de los puntos, no utilices el Servicio.
        </p>
      </section>

      <section>
        <h2>2. Descripción del Servicio</h2>
        <p>
          Box es una plataforma SaaS de gestión de compras institucionales que permite administrar
          solicitudes de compra, aprobaciones multinivel, proveedores, pagos y recepciones. El
          Servicio se provee &quot;tal como está&quot; y puede evolucionar sin previo aviso.
        </p>
      </section>

      <section>
        <h2>3. Cuenta y credenciales</h2>
        <p>
          El Cliente es responsable de la confidencialidad de las credenciales de acceso y de toda
          actividad realizada desde su cuenta. Debe notificarnos de inmediato cualquier uso no
          autorizado. Box no será responsable por daños derivados del incumplimiento de esta
          obligación.
        </p>
      </section>

      <section>
        <h2>4. Prueba gratuita y suscripción</h2>
        <p>
          Al registrarse, el Cliente accede a una prueba gratuita de 14 días. Finalizada la prueba,
          debe activar una suscripción paga para continuar utilizando el Servicio. El precio vigente
          al momento de estos Términos es de ARS 152.000 por mes, facturable de manera recurrente
          hasta la cancelación. Los precios pueden actualizarse con un aviso previo de 30 días
          corridos.
        </p>
        <p>
          Los pagos se procesan exclusivamente a través de <strong>Mercado Pago</strong>. Box no
          almacena datos de tarjeta ni de medios de pago: esa información es gestionada por Mercado
          Pago bajo sus propios términos.
        </p>
      </section>

      <section>
        <h2>5. Cancelación y reembolsos</h2>
        <p>
          El Cliente puede cancelar su suscripción en cualquier momento desde el panel de
          Facturación. La cancelación surte efecto al finalizar el período ya facturado. Box no
          reintegra importes por períodos parcialmente utilizados, excepto cuando la ley aplicable
          lo exija.
        </p>
      </section>

      <section>
        <h2>6. Uso aceptable</h2>
        <p>El Cliente se compromete a no utilizar el Servicio para:</p>
        <ul>
          <li>Violar leyes locales o internacionales.</li>
          <li>
            Cargar contenido ilegal, engañoso, difamatorio, que infrinja derechos de terceros o
            contenga malware.
          </li>
          <li>
            Intentar acceder a datos de otras organizaciones, eludir controles de seguridad o
            realizar ingeniería inversa sobre el Servicio.
          </li>
          <li>
            Automatizar el uso mediante bots o scraping de una forma que degrade la experiencia de
            otros clientes.
          </li>
        </ul>
        <p>
          Box podrá suspender o cancelar la cuenta ante incumplimientos, con o sin aviso previo
          según la gravedad.
        </p>
      </section>

      <section>
        <h2>7. Propiedad intelectual</h2>
        <p>
          Todos los derechos de propiedad intelectual sobre el Servicio (código, diseño, marcas)
          pertenecen a Box. El Cliente conserva la propiedad de los datos que carga y nos otorga una
          licencia limitada, no exclusiva y revocable para procesarlos con el fin de operar el
          Servicio.
        </p>
      </section>

      <section>
        <h2>8. Disponibilidad y soporte</h2>
        <p>
          Box realiza esfuerzos razonables para mantener el Servicio disponible 24/7, pero no
          garantiza disponibilidad ininterrumpida. Podemos realizar mantenimientos programados que
          interrumpan temporalmente el acceso. El soporte se ofrece por email en horarios de oficina
          de Argentina.
        </p>
      </section>

      <section>
        <h2>9. Limitación de responsabilidad</h2>
        <p>
          En la máxima medida permitida por la ley, Box no será responsable por daños indirectos,
          incidentales o consecuentes (lucro cesante, pérdida de datos, daño a la imagen). La
          responsabilidad total de Box se limita al monto efectivamente abonado por el Cliente en
          los 12 meses previos al hecho generador del reclamo.
        </p>
      </section>

      <section>
        <h2>10. Datos personales</h2>
        <p>
          El tratamiento de datos personales se rige por nuestra{' '}
          <Link href="/privacidad">Política de Privacidad</Link> y por la Ley 25.326 de Protección
          de Datos Personales (Argentina). El Cliente declara haber obtenido los consentimientos
          necesarios para cargar datos de sus usuarios y proveedores.
        </p>
      </section>

      <section>
        <h2>11. Modificaciones</h2>
        <p>
          Podemos modificar estos Términos. Los cambios sustanciales se notifican por email con 30
          días de anticipación. El uso continuado del Servicio implica la aceptación de los nuevos
          términos.
        </p>
      </section>

      <section>
        <h2>12. Ley aplicable y jurisdicción</h2>
        <p>
          Estos Términos se rigen por las leyes de la República Argentina. Cualquier disputa se
          someterá a los tribunales ordinarios de la Ciudad Autónoma de Buenos Aires, renunciando a
          cualquier otro fuero.
        </p>
      </section>

      <section>
        <h2>13. Contacto</h2>
        <p>
          Para consultas sobre estos Términos: <strong>legal@box.example.com</strong> (o la casilla
          oficial que te indicaremos en la próxima actualización).
        </p>
      </section>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .legal-doc {
              max-width: 760px;
              margin: 0 auto;
              padding: 48px 24px 80px;
              color: var(--text-primary, #1f2937);
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
              line-height: 1.65;
            }
            .legal-doc header { margin-bottom: 32px; }
            .legal-doc h1 {
              font-size: 2.2rem;
              font-weight: 800;
              letter-spacing: -0.02em;
              margin: 12px 0 4px;
            }
            .legal-doc .meta {
              color: var(--text-muted, #6b7280);
              font-size: 13px;
            }
            .legal-doc h2 {
              font-size: 1.15rem;
              font-weight: 700;
              margin: 32px 0 10px;
            }
            .legal-doc p, .legal-doc ul { font-size: 15px; margin-bottom: 12px; }
            .legal-doc ul { padding-left: 22px; }
            .legal-doc li { margin-bottom: 4px; }
            .legal-doc a { color: var(--color-primary, #1677ff); }
          `,
        }}
      />
    </article>
  );
}
