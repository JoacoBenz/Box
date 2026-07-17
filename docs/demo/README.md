# Demo de producto — Box

Dos cortes del mismo storyboard:

- `box-demo.mp4` — 58s, 1280x720 (16:9), para web/presentaciones
- `box-demo-instagram.mp4` — 58s, 1080x1920 (9:16), para Reels/Stories/TikTok,
  con titulares "Paso X de 4" y puntos de progreso

Muestran el camino feliz de una solicitud:
Laura (solicitante) crea y envía → Admin (responsable de área) valida →
Carlos (director) aprueba, con la segregación de funciones como mensaje central.

## Regenerar / editar el video

El código Remotion está en `remotion-src/`:

```bash
mkdir box-video && cd box-video
npm init -y && npm i remotion@4 @remotion/cli@4 @remotion/fonts@4 react react-dom
mkdir src public
cp <repo>/docs/demo/remotion-src/*.ts* src/
cp <repo>/docs/demo/remotion-src/jakarta.woff2 public/
npx remotion studio src/index.ts   # editor visual en el navegador
npx remotion render src/index.ts BoxDemo out/box-demo.mp4      # render 16:9
npx remotion render src/index.ts BoxDemoIG out/box-demo-ig.mp4  # render 9:16
```

Escenas (en `BoxDemo.tsx`): Intro · Problema · Form (typewriter + countUp) ·
Validación · Aprobación (confetti) · Dashboard KPIs · Cierre CTA.
Branding centralizado en la constante `BRAND`.
