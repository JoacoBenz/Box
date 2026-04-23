import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Política de Privacidad — Box',
  description: 'Cómo Box recolecta, usa y protege los datos personales.',
};

/**
 * Política de Privacidad — plantilla base para SaaS AR (Ley 25.326).
 * Al agregar un proveedor externo nuevo (analytics, email, etc.) recordá
 * actualizar la lista de encargados de tratamiento en la sección 7.
 */
export default function PrivacidadPage() {
  return (
    <article className="legal-doc">
      <header>
        <Link href="/inicio" style={{ color: 'var(--color-primary, #1677ff)' }}>
          ← Volver al inicio
        </Link>
        <h1>Política de Privacidad</h1>
        <p className="meta">Entrada en vigencia: 23 de abril de 2026</p>
      </header>

      <section>
        <h2>1. Responsable del tratamiento</h2>
        <p>
          Box (en adelante, &quot;Nosotros&quot;) es el responsable del tratamiento de los datos
          personales recolectados a través de la plataforma.
        </p>
      </section>

      <section>
        <h2>2. Datos que recolectamos</h2>
        <h3>2.1. Al registrarte</h3>
        <ul>
          <li>Nombre y apellido.</li>
          <li>Email.</li>
          <li>Contraseña (almacenada con hash bcrypt — nunca en texto plano).</li>
          <li>Nombre de la organización.</li>
        </ul>
        <h3>2.2. Durante el uso del Servicio</h3>
        <ul>
          <li>Datos cargados voluntariamente (solicitudes, proveedores, facturas).</li>
          <li>Logs de actividad con fecha, hora, IP y user-agent (por seguridad y auditoría).</li>
          <li>Cookies de sesión y preferencias (tema, tenant seleccionado).</li>
        </ul>
        <h3>2.3. Al pagar</h3>
        <p>
          Los datos de tarjeta se ingresan en los formularios de <strong>Mercado Pago</strong>. Box
          nunca ve ni almacena el número de tarjeta. Sólo recibimos de Mercado Pago el ID de
          preaprobación y el estado del pago (autorizado, rechazado, etc.).
        </p>
      </section>

      <section>
        <h2>3. Finalidades</h2>
        <ul>
          <li>Operar el Servicio (crear y gestionar solicitudes, aprobaciones, pagos).</li>
          <li>Autenticar usuarios y proteger cuentas.</li>
          <li>Enviar notificaciones operativas por email (aprobaciones, recordatorios).</li>
          <li>Detectar abuso, prevenir fraude y asegurar la integridad del servicio.</li>
          <li>Cumplir obligaciones legales (facturación, respuestas a autoridades).</li>
        </ul>
        <p>No utilizamos datos personales para marketing de terceros ni los vendemos.</p>
      </section>

      <section>
        <h2>4. Base legal (Ley 25.326)</h2>
        <p>
          El tratamiento se fundamenta en (i) el consentimiento expreso prestado al registrarse,
          (ii) la ejecución del contrato del Servicio, y (iii) el interés legítimo para operar y
          proteger la plataforma.
        </p>
      </section>

      <section>
        <h2>5. Tiempo de conservación</h2>
        <p>
          Conservamos los datos mientras la cuenta esté activa. Al cancelar la suscripción, los
          datos se conservan por 90 días para permitir reactivación, luego se eliminan o anonimizan.
          Los logs de auditoría se conservan por el término legal aplicable (hasta 10 años) por
          obligaciones contables y fiscales.
        </p>
      </section>

      <section>
        <h2>6. Derechos del titular de los datos (ARCO)</h2>
        <p>Conforme a la Ley 25.326, tenés derecho a:</p>
        <ul>
          <li>
            <strong>Acceso:</strong> solicitar qué datos tuyos tenemos.
          </li>
          <li>
            <strong>Rectificación:</strong> corregir datos inexactos o desactualizados.
          </li>
          <li>
            <strong>Cancelación:</strong> pedir la eliminación de tus datos personales.
          </li>
          <li>
            <strong>Oposición:</strong> oponerte al tratamiento cuando sea aplicable.
          </li>
        </ul>
        <p>
          Para ejercerlos, escribinos a <strong>privacidad@box.example.com</strong>. Respondemos
          dentro de los 10 días corridos establecidos por la ley. También podés presentar un reclamo
          ante la <strong>Agencia de Acceso a la Información Pública</strong> si considerás que no
          respondemos adecuadamente.
        </p>
      </section>

      <section>
        <h2>7. Encargados de tratamiento (subprocesadores)</h2>
        <p>
          Delegamos parte del procesamiento en los siguientes proveedores, elegidos por sus
          estándares de seguridad:
        </p>
        <ul>
          <li>
            <strong>Vercel Inc.</strong> (EE.UU.): hosting de la aplicación.
          </li>
          <li>
            <strong>Supabase</strong> (PostgreSQL gestionado): base de datos y almacenamiento de
            archivos adjuntos.
          </li>
          <li>
            <strong>Mercado Pago</strong> (MercadoLibre S.R.L.): procesamiento de pagos.
          </li>
          <li>
            <strong>Sentry</strong> (Functional Software, Inc.): monitoreo de errores.
          </li>
          <li>
            <strong>Google / Microsoft</strong> (opcional, sólo si elegís SSO): autenticación.
          </li>
          <li>
            <strong>Gmail (Google LLC)</strong>: envío de emails transaccionales (password reset,
            invitaciones, notificaciones).
          </li>
        </ul>
        <p>
          Algunos de estos proveedores pueden procesar datos fuera de Argentina. En todos los casos
          exigimos medidas de seguridad equivalentes a las aplicables en territorio nacional.
        </p>
      </section>

      <section>
        <h2>8. Seguridad</h2>
        <ul>
          <li>TLS/HTTPS obligatorio en todas las comunicaciones.</li>
          <li>Contraseñas con hash bcrypt (cost 12).</li>
          <li>Rate limiting y bloqueo de cuentas ante intentos de fuerza bruta.</li>
          <li>Aislamiento lógico entre organizaciones (tenant isolation).</li>
          <li>Backups diarios de la base de datos.</li>
        </ul>
      </section>

      <section>
        <h2>9. Cookies</h2>
        <p>
          Usamos cookies estrictamente necesarias para la operación del Servicio: sesión (Auth.js),
          preferencia de tema y tenant seleccionado (solo super admin). No utilizamos cookies de
          tracking publicitario ni de analytics de terceros.
        </p>
      </section>

      <section>
        <h2>10. Menores de edad</h2>
        <p>
          El Servicio está dirigido a profesionales y organizaciones. No recolectamos
          deliberadamente datos de menores de 18 años.
        </p>
      </section>

      <section>
        <h2>11. Cambios</h2>
        <p>
          Si actualizamos esta Política, te notificaremos por email con al menos 15 días de
          anticipación. La fecha al tope de este documento refleja la última actualización.
        </p>
      </section>

      <section>
        <h2>12. Contacto</h2>
        <p>
          Delegado de protección de datos: <strong>privacidad@box.example.com</strong>.
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
            .legal-doc h3 { font-size: 1rem; font-weight: 600; margin: 18px 0 6px; }
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
