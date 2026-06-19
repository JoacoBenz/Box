import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { ThemeProvider } from '@/components/ThemeProvider';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: 'Box — Gestión de Compras',
  description: 'Sistema de gestión de solicitudes de compra para organizaciones',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
          (function() {
            try {
              if (!localStorage.getItem('theme_v2')) {
                localStorage.setItem('theme', 'light');
                localStorage.setItem('theme_v2', '1');
              }
              var t = localStorage.getItem('theme') || 'light';
              document.documentElement.setAttribute('data-theme', t);
            } catch(e) {}
          })();
        `,
          }}
        />
      </head>
      <body className={jakarta.variable}>
        <AntdRegistry>
          <ThemeProvider>{children}</ThemeProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
