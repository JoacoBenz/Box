'use client';

import { useCountUp } from '@/hooks/useCountUp';
import { Button, Card, Col, Row, Tag, Typography, Progress } from 'antd';
import Link from 'next/link';

import { useTheme } from '@/components/ThemeProvider';
import { ESTADO_COLOR, ESTADO_LABEL } from '@/lib/constants';

const { Text } = Typography;

export const MEDIO_PAGO_LABEL: Record<string, string> = {
  transferencia: 'Transferencia',
  cheque: 'Cheque',
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  otro: 'Otro',
};

export function formatMoney(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(amount);
}

// ── Stat Card Component ──
export function StatCard({
  title,
  value,
  icon,
  color,
  format,
  suffix,
  delay = 0,
}: {
  title: string;
  value: number | undefined | null;
  icon: React.ReactNode;
  color: string;
  format?: 'money' | 'percent';
  suffix?: string;
  delay?: number;
}) {
  const { tokens } = useTheme();
  const count = useCountUp(value);
  return (
    <Card
      className={`glass-card glass-${color}`}
      style={{ animationDelay: `${delay}ms` }}
      styles={{ body: { padding: '20px 24px' } }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div className={`stat-icon icon-${color}`}>{icon}</div>
        <div>
          <Text
            type="secondary"
            style={{
              fontSize: 12,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              fontWeight: 500,
            }}
          >
            {title}
          </Text>
          <div
            className="count-up"
            style={{ fontSize: 28, fontWeight: 800, color: tokens.textPrimary, lineHeight: 1.2 }}
          >
            {format === 'money' ? formatMoney(count) : format === 'percent' ? `${count}%` : count}
            {suffix ?? ''}
          </div>
        </div>
      </div>
    </Card>
  );
}

// ── Mini Stat Card ──
export function MiniStatCard({
  title,
  value,
  icon,
  color,
  format,
  suffix,
}: {
  title: string;
  value: number | undefined | null;
  icon: React.ReactNode;
  color: string;
  format?: 'money' | 'percent';
  suffix?: string;
}) {
  const { tokens } = useTheme();
  const count = useCountUp(value);
  return (
    <Card
      className={`glass-card glass-${color}`}
      size="small"
      styles={{ body: { padding: '14px 18px' } }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          className={`stat-icon icon-${color}`}
          style={{ width: 32, height: 32, borderRadius: 8, fontSize: 14 }}
        >
          {icon}
        </div>
        <div>
          <Text
            type="secondary"
            style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}
          >
            {title}
          </Text>
          <div
            className="count-up"
            style={{ fontSize: 20, fontWeight: 700, color: tokens.textPrimary }}
          >
            {format === 'money' ? formatMoney(count) : format === 'percent' ? `${count}%` : count}
            {suffix ?? ''}
          </div>
        </div>
      </div>
    </Card>
  );
}

// ── Pending Action Card ──
export function PendingActionCard({
  count,
  label,
  href,
  buttonText,
}: {
  count: number;
  label: string;
  href: string;
  buttonText: string;
}) {
  const { tokens } = useTheme();
  return (
    <Card
      style={{ borderRadius: 16, borderColor: count > 0 ? '#f59e0b' : '#22c55e', borderWidth: 2 }}
      styles={{ body: { padding: '20px' } }}
    >
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 32, fontWeight: 800, color: tokens.textPrimary }}>{count}</div>
        <Text
          type="secondary"
          style={{
            fontSize: 12,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            fontWeight: 500,
          }}
        >
          {label}
        </Text>
      </div>
      <Link href={href} style={{ textDecoration: 'none' }}>
        <Button block type="primary" size="large" style={{ fontWeight: 600 }}>
          {buttonText}
        </Button>
      </Link>
    </Card>
  );
}

// ── Section Title ──
export function SectionTitle({ children }: { children: React.ReactNode }) {
  const { tokens } = useTheme();
  return (
    <div
      style={{
        fontSize: 18,
        fontWeight: 700,
        color: tokens.textPrimary,
        marginBottom: 16,
        letterSpacing: '-0.5px',
      }}
    >
      {children}
    </div>
  );
}

// ── Estado Tags (mini chart) ──
export function EstadoTags({ data }: { data: { estado: string; cantidad: number }[] }) {
  if (!data || data.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '8px 0' }}>
      {data.map((item) => (
        <Tag
          key={item.estado}
          color={ESTADO_COLOR[item.estado] ?? 'default'}
          style={{ fontSize: 13, padding: '4px 14px', margin: 0 }}
        >
          {ESTADO_LABEL[item.estado] ?? item.estado}: <strong>{item.cantidad}</strong>
        </Tag>
      ))}
    </div>
  );
}

// ── Greeting ──
export function Greeting() {
  const { tokens } = useTheme();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches';
  const date = new Date().toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div style={{ marginBottom: 28 }}>
      <div
        style={{
          fontSize: 28,
          fontWeight: 800,
          color: tokens.textPrimary,
          letterSpacing: '-0.5px',
        }}
      >
        {greeting} 👋
      </div>
      <Text type="secondary" style={{ fontSize: 14, textTransform: 'capitalize' }}>
        {date}
      </Text>
    </div>
  );
}

// ── Loading Skeleton ──
export function DashboardSkeleton() {
  const { tokens } = useTheme();
  return (
    <div className="page-content" style={{ padding: 4 }}>
      <div style={{ marginBottom: 28 }}>
        <div
          style={{
            width: 240,
            height: 32,
            background: tokens.skeletonBg,
            borderRadius: 8,
            marginBottom: 8,
            animation: 'pulse 1.5s ease-in-out infinite',
          }}
        />
        <div
          style={{
            width: 180,
            height: 16,
            background: tokens.skeletonBg,
            borderRadius: 6,
            animation: 'pulse 1.5s ease-in-out infinite',
          }}
        />
      </div>
      <Row gutter={[16, 16]}>
        {[1, 2, 3, 4].map((i) => (
          <Col key={i} xs={24} sm={12} lg={6}>
            <div
              style={{
                height: 100,
                background: tokens.skeletonBg,
                borderRadius: 16,
                animation: 'pulse 1.5s ease-in-out infinite',
                animationDelay: `${i * 100}ms`,
              }}
            />
          </Col>
        ))}
      </Row>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

// ── Bar chart row helper ──
export function BarChartRow({
  label,
  value,
  maxValue,
  color,
  subtext,
  index,
  formatValue,
}: {
  label: string;
  value: number;
  maxValue: number;
  color: string;
  subtext: string;
  index: number;
  formatValue?: (v: number) => string;
}) {
  const { tokens } = useTheme();
  return (
    <div
      style={{
        padding: '12px 0',
        borderBottom: 'none',
        animation: `staggerIn 0.3s ease-out ${index * 80}ms both`,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text style={{ fontWeight: 500 }}>{label}</Text>
        <Text strong style={{ color: tokens.textPrimary }}>
          {formatValue ? formatValue(value) : formatMoney(value)}
        </Text>
      </div>
      <Progress
        percent={maxValue > 0 ? Math.round((value / maxValue) * 100) : 0}
        showInfo={false}
        size="small"
        strokeColor={color}
      />
      <Text type="secondary" style={{ fontSize: 11 }}>
        {subtext}
      </Text>
    </div>
  );
}
