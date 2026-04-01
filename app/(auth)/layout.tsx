export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <style>{`
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
      <div style={{
        position: 'absolute',
        width: 500,
        height: 500,
        borderRadius: '50%',
        background: 'rgba(255, 255, 255, 0.08)',
        filter: 'blur(60px)',
        top: '-10%',
        left: '-5%',
        animation: 'float1 25s ease-in-out infinite',
      }} />
      <div style={{
        position: 'absolute',
        width: 400,
        height: 400,
        borderRadius: '50%',
        background: 'rgba(255, 255, 255, 0.06)',
        filter: 'blur(50px)',
        bottom: '-8%',
        right: '-3%',
        animation: 'float2 20s ease-in-out infinite',
      }} />
      <div style={{
        position: 'absolute',
        width: 350,
        height: 350,
        borderRadius: '50%',
        background: 'rgba(255, 255, 255, 0.05)',
        filter: 'blur(55px)',
        top: '40%',
        left: '50%',
        animation: 'float3 30s ease-in-out infinite',
      }} />

      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.1) 0%, transparent 50%), radial-gradient(circle at 70% 80%, rgba(255,255,255,0.08) 0%, transparent 50%)',
      }} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        {children}
      </div>
    </div>
  );
}
