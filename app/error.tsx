'use client'

import { useEffect } from 'react'
import { Button, Result } from 'antd'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Unhandled error:', error)
  }, [error])

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <Result
        status="500"
        title="Algo salió mal"
        subTitle="Ocurrió un error inesperado. Intentá de nuevo."
        extra={<Button type="primary" onClick={reset}>Reintentar</Button>}
      />
    </div>
  )
}
