'use client';

import { ConfigProvider } from 'antd';
import esES from 'antd/locale/es_ES';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider
      locale={esES}
      theme={{
        token: {
          colorPrimary: '#4f46e5',
          colorSuccess: '#10b981',
          colorWarning: '#f59e0b',
          colorError: '#ef4444',
          colorInfo: '#6366f1',
          borderRadius: 10,
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          fontSize: 14,
          colorBgLayout: '#f8fafc',
          controlHeight: 38,
        },
        components: {
          Card: {
            borderRadiusLG: 12,
            boxShadowTertiary: '0 1px 3px 0 rgb(0 0 0 / 0.04), 0 1px 2px -1px rgb(0 0 0 / 0.04)',
          },
          Button: {
            borderRadius: 8,
            controlHeight: 36,
          },
          Table: {
            borderRadiusLG: 12,
            headerBg: '#f8fafc',
            headerColor: '#64748b',
          },
          Menu: {
            itemBorderRadius: 8,
            itemMarginInline: 8,
          },
          Tag: {
            borderRadiusSM: 6,
          },
          Input: {
            borderRadius: 8,
          },
          Select: {
            borderRadius: 8,
          },
          Modal: {
            borderRadiusLG: 16,
          },
          Statistic: {
            titleFontSize: 13,
          },
        },
      }}
    >
      {children}
    </ConfigProvider>
  );
}
