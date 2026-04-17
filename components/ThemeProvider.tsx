'use client';

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { ConfigProvider, theme as antTheme } from 'antd';
import esES from 'antd/locale/es_ES';
import { lightTokens, darkTokens, type ThemeTokens } from '@/lib/theme-tokens';

type ThemeMode = 'light' | 'dark';

interface ThemeContextValue {
  mode: ThemeMode;
  toggleTheme: () => void;
  tokens: ThemeTokens;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'light',
  toggleTheme: () => {},
  tokens: lightTokens,
});

export const useTheme = () => useContext(ThemeContext);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(() => {
    // SSR-safe: default to light, will sync on mount
    return 'light';
  });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Read from localStorage or system preference
    const stored = localStorage.getItem('theme') as ThemeMode | null;
    if (stored === 'dark' || stored === 'light') {
      setMode(stored);
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.setAttribute('data-theme', mode);
    localStorage.setItem('theme', mode);
  }, [mode, mounted]);

  const toggleTheme = useCallback(() => {
    // Create overlay, fade in, swap theme, fade out
    let overlay = document.querySelector('.theme-fade-overlay') as HTMLDivElement | null;
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'theme-fade-overlay';
      document.body.appendChild(overlay);
    }
    // Force reflow then activate
    overlay.offsetHeight;
    overlay.classList.add('active');

    setTimeout(() => {
      setMode((prev) => (prev === 'light' ? 'dark' : 'light'));
      // Wait a frame for React to re-render, then fade out
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          overlay!.classList.remove('active');
        });
      });
    }, 350);
  }, []);

  const tokens = mode === 'dark' ? darkTokens : lightTokens;

  const antThemeConfig = useMemo(() => {
    const isDark = mode === 'dark';
    return {
      algorithm: isDark ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
      token: {
        colorPrimary: tokens.colorPrimary,
        colorSuccess: '#10b981',
        colorWarning: '#f59e0b',
        colorError: tokens.colorError,
        colorInfo: tokens.colorSecondary,
        borderRadius: 10,
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        fontSize: 14,
        colorBgLayout: tokens.bgLayout,
        colorBgContainer: tokens.bgCard,
        colorBgElevated: tokens.bgInput,
        colorText: tokens.textPrimary,
        colorTextSecondary: tokens.textSecondary,
        colorTextTertiary: tokens.textMuted,
        colorTextQuaternary: tokens.textMuted,
        colorBorder: tokens.borderColor,
        colorBorderSecondary: tokens.borderSubtle,
        controlHeight: 38,
      },
      components: {
        Card: {
          borderRadiusLG: 12,
          colorBgContainer: tokens.bgCard,
          boxShadowTertiary: isDark
            ? '0 1px 3px 0 rgb(0 0 0 / 0.2), 0 1px 2px -1px rgb(0 0 0 / 0.2)'
            : '0 1px 3px 0 rgb(0 0 0 / 0.04), 0 1px 2px -1px rgb(0 0 0 / 0.04)',
        },
        Button: {
          borderRadius: 8,
          controlHeight: 36,
        },
        Table: {
          borderRadiusLG: 12,
          headerBg: isDark ? '#1B2838' : '#f8fafc',
          headerColor: tokens.textSecondary,
          colorBgContainer: tokens.bgCard,
          rowHoverBg: tokens.bgInput,
        },
        Menu: {
          itemBorderRadius: 8,
          itemMarginInline: 8,
          ...(isDark
            ? {
                darkItemBg: 'transparent',
                darkItemSelectedBg: 'rgba(0, 194, 203, 0.15)',
                darkItemHoverBg: 'rgba(0, 194, 203, 0.08)',
              }
            : {}),
        },
        Tag: {
          borderRadiusSM: 6,
        },
        Input: {
          borderRadius: 8,
          colorBgContainer: tokens.bgInput,
        },
        Select: {
          borderRadius: 8,
          colorBgContainer: tokens.bgInput,
        },
        Form: {
          labelColor: tokens.textPrimary,
        },
        Modal: {
          borderRadiusLG: 16,
          contentBg: tokens.bgCard,
          headerBg: tokens.bgCard,
          titleColor: tokens.textPrimary,
        },
        Statistic: {
          titleFontSize: 13,
        },
        Descriptions: {
          colorSplit: tokens.borderSubtle,
          labelBg: tokens.bgInput,
        },
        Timeline: {
          dotBg: tokens.bgCard,
        },
        Dropdown: {
          colorBgElevated: tokens.bgInput,
        },
      },
    };
  }, [mode, tokens]);

  const contextValue = useMemo(() => ({ mode, toggleTheme, tokens }), [mode, toggleTheme, tokens]);

  return (
    <ThemeContext.Provider value={contextValue}>
      <ConfigProvider locale={esES} theme={antThemeConfig}>
        {children}
      </ConfigProvider>
    </ThemeContext.Provider>
  );
}
