import { Suspense } from 'react';
import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
      className="auth-layout-bg"
    >
      <style>{`
        [data-theme="light"] .auth-layout-bg {
          background: linear-gradient(180deg, #f0fdff 0%, #e0f7fa 100%);
        }
        [data-theme="dark"] .auth-layout-bg {
          background: linear-gradient(135deg, #0e1825 0%, #1a1a2e 100%);
        }
        [data-theme="light"] .auth-circle { background: rgba(0, 194, 203, 0.15); }
        [data-theme="dark"] .auth-circle { background: rgba(0, 194, 203, 0.08); }
        [data-theme="light"] .auth-circle-2 { background: rgba(167, 139, 250, 0.12); }
        [data-theme="dark"] .auth-circle-2 { background: rgba(167, 139, 250, 0.06); }
        [data-theme="light"] .auth-circle-3 { background: rgba(244, 114, 182, 0.10); }
        [data-theme="dark"] .auth-circle-3 { background: rgba(0, 194, 203, 0.05); }

        .auth-footer {
          position: relative;
          z-index: 1;
          padding: 16px 24px 24px;
          font-size: 13px;
          display: flex;
          gap: 18px;
          align-items: center;
          justify-content: center;
          flex-wrap: wrap;
        }
        [data-theme="light"] .auth-footer { color: #5b6b78; }
        [data-theme="dark"] .auth-footer { color: #94a3b8; }
        .auth-footer a {
          color: inherit;
          text-decoration: none;
          opacity: 0.85;
          transition: opacity 0.15s ease;
        }
        .auth-footer a:hover { opacity: 1; text-decoration: underline; }
        .auth-footer .sep { opacity: 0.4; }

        @keyframes float1 {
          0%, 100% { transform: translate(0, 0); }
          33% { transform: translate(60px, -40px); }
          66% { transform: translate(-30px, 30px); }
        }
        @keyframes float2 {
          0%, 100% { transform: translate(0, 0); }
          33% { transform: translate(-50px, 50px); }
          66% { transform: translate(40px, -30px); }
        }
        @keyframes float3 {
          0%, 100% { transform: translate(0, 0); }
          33% { transform: translate(30px, 60px); }
          66% { transform: translate(-60px, -20px); }
        }
      `}</style>

      {/* Animated background circles */}
      <div
        className="auth-circle"
        style={{
          position: 'absolute',
          width: 500,
          height: 500,
          borderRadius: '50%',
          filter: 'blur(60px)',
          top: '-10%',
          left: '-5%',
          animation: 'float1 25s ease-in-out infinite',
        }}
      />
      <div
        className="auth-circle-2"
        style={{
          position: 'absolute',
          width: 400,
          height: 400,
          borderRadius: '50%',
          filter: 'blur(50px)',
          bottom: '-8%',
          right: '-3%',
          animation: 'float2 20s ease-in-out infinite',
        }}
      />
      <div
        className="auth-circle-3"
        style={{
          position: 'absolute',
          width: 350,
          height: 350,
          borderRadius: '50%',
          filter: 'blur(55px)',
          top: '40%',
          left: '50%',
          animation: 'float3 30s ease-in-out infinite',
        }}
      />

      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <Suspense>{children}</Suspense>
      </div>

      <footer className="auth-footer">
        <Link href="/terminos">Términos</Link>
        <span className="sep">·</span>
        <Link href="/privacidad">Privacidad</Link>
        <span className="sep">·</span>
        <span>© {new Date().getFullYear()} Box</span>
      </footer>
    </div>
  );
}
