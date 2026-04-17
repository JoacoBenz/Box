import { Skeleton, Card } from 'antd';

export default function DashboardLoading() {
  return (
    <div style={{ padding: 24 }}>
      <Skeleton active paragraph={{ rows: 1 }} style={{ marginBottom: 24, maxWidth: 300 }} />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
          gap: 16,
          marginBottom: 24,
        }}
      >
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} style={{ borderRadius: 12 }}>
            <Skeleton active paragraph={{ rows: 2 }} />
          </Card>
        ))}
      </div>
      <Card style={{ borderRadius: 12 }}>
        <Skeleton active paragraph={{ rows: 8 }} />
      </Card>
    </div>
  );
}
