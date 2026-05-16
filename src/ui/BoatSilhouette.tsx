/**
 * Силуэт лодки под рядом банок. Тонкая чернильная кривая,
 * слева — острый форштевень, справа — закруглённая корма с пером якоря.
 * Создаёт подсознательную ориентацию «нос ← / корма →».
 */
export function BoatSilhouette({ width = 900, height = 80 }: { width?: number; height?: number }) {
  return (
    <svg
      aria-hidden
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="pointer-events-none block"
    >
      {/* Основная кривая корпуса. */}
      <path
        d={`M 10 20 Q 30 60, 130 65 L ${width - 80} 65 Q ${width - 20} 60, ${width - 6} 30`}
        fill="none"
        stroke="var(--ink, #1a2438)"
        strokeOpacity="0.55"
        strokeWidth="2"
      />
      {/* Внутренний контур (доска). */}
      <path
        d={`M 30 24 Q 50 50, 140 54 L ${width - 90} 54 Q ${width - 40} 50, ${width - 26} 32`}
        fill="none"
        stroke="var(--ink, #1a2438)"
        strokeOpacity="0.25"
        strokeWidth="1"
      />
      {/* Брызги перед носом. */}
      <g stroke="var(--ink, #1a2438)" strokeOpacity="0.4" strokeWidth="1" fill="none">
        <path d="M 4 12 q 4 -4 8 0" />
        <path d="M 18 8 q 3 -3 6 0" />
        <path d="M 6 28 q 3 4 7 2" />
      </g>
      {/* Волна за кормой. */}
      <g stroke="var(--ink, #1a2438)" strokeOpacity="0.4" strokeWidth="1" fill="none">
        <path d={`M ${width - 14} 12 q 4 -3 10 -1`} />
        <path d={`M ${width - 18} 30 q 6 4 12 1`} />
      </g>
    </svg>
  )
}
