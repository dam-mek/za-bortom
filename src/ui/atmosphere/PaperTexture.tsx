/**
 * Слой бумажной зернистости — полноэкранный SVG-noise.
 * Кладётся в z-index 0 поверх фона, но под контентом.
 *
 * На тач-устройствах (iOS/Android) отключён: feTurbulence + mix-blend-multiply
 * рендерится программно (CPU), что замораживает мобильные браузеры.
 */
export function PaperTexture() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 opacity-20 mix-blend-multiply hidden [@media(hover:hover)]:block"
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.08  0 0 0 0 0.06  0 0 0 0 0.04  0 0 0 0.22 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        backgroundRepeat: 'repeat',
      }}
    />
  )
}
