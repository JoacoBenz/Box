'use client'

import { useState, useEffect } from 'react'
import { Card, Input, Button, Typography, message, Avatar, Spin } from 'antd'
import { SendOutlined, CommentOutlined, UserOutlined } from '@ant-design/icons'

const { Text } = Typography
const { TextArea } = Input

interface Comentario {
  id: number
  mensaje: string
  created_at: string
  usuario: { id: number; nombre: string }
}

export default function ComentariosSection({ solicitudId }: { solicitudId: number }) {
  const [comentarios, setComentarios] = useState<Comentario[]>([])
  const [mensaje, setMensaje] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)

  const fetchComentarios = () => {
    setLoading(true)
    fetch(`/api/solicitudes/${solicitudId}/comentarios`)
      .then(r => r.json())
      .then(setComentarios)
      .catch(() => message.error('Error cargando comentarios'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchComentarios() }, [solicitudId])

  const enviar = async () => {
    if (!mensaje.trim()) return
    setSending(true)
    try {
      const res = await fetch(`/api/solicitudes/${solicitudId}/comentarios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensaje: mensaje.trim() }),
      })
      if (!res.ok) throw new Error()
      setMensaje('')
      fetchComentarios()
    } catch {
      message.error('Error enviando comentario')
    } finally {
      setSending(false)
    }
  }

  const formatDate = (d: string) => {
    const date = new Date(d)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return 'Ahora'
    if (diffMins < 60) return `Hace ${diffMins}min`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `Hace ${diffHours}h`
    return date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <Card
      title={<span style={{ fontWeight: 700 }}><CommentOutlined style={{ marginRight: 8 }} />Comentarios ({comentarios.length})</span>}
      style={{ borderRadius: 16, marginTop: 24 }}
      styles={{ body: { padding: '16px 20px' } }}
    >
      {comentarios.length === 0 && !loading && (
        <Text type="secondary" style={{ display: 'block', textAlign: 'center', padding: '20px 0' }}>
          Sin comentarios aún
        </Text>
      )}

      {loading && <div style={{ textAlign: 'center', padding: 20 }}><Spin /></div>}

      {!loading && comentarios.map(c => (
        <div key={c.id} style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
          <Avatar size={32} icon={<UserOutlined />} style={{ background: '#4f46e5', flexShrink: 0 }}>
            {c.usuario.nombre.charAt(0).toUpperCase()}
          </Avatar>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text strong style={{ fontSize: 13 }}>{c.usuario.nombre}</Text>
              <Text type="secondary" style={{ fontSize: 11 }}>{formatDate(c.created_at)}</Text>
            </div>
            <Text style={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>{c.mensaje}</Text>
          </div>
        </div>
      ))}

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <TextArea
          value={mensaje}
          onChange={e => setMensaje(e.target.value)}
          placeholder="Escribí un comentario..."
          maxLength={2000}
          autoSize={{ minRows: 1, maxRows: 4 }}
          onPressEnter={e => { if (!e.shiftKey) { e.preventDefault(); enviar() } }}
          style={{ borderRadius: 8 }}
        />
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={enviar}
          loading={sending}
          disabled={!mensaje.trim()}
          style={{ borderRadius: 8, height: 'auto' }}
        />
      </div>
    </Card>
  )
}
