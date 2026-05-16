import { useAtmosphere } from '@/ui/theme'

/**
 * Атмосферный фон-слой. Под бумагой (z-index -1), реагирует на фазу.
 *
 * - morning: тёплый рассвет, длинные лучи
 * - day: яркий cyan-wash + волны
 * - evening: ползущий туман по краям, индиго
 * - night: тёмно-фиолетовый с мерцающими точками-звёздами
 * - neutral: спокойный нейтральный wash
 */
export function WeatherLayer() {
  const atmos = useAtmosphere()

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{
        transition: 'background var(--phase-transition, 1500ms) ease',
        background:
          'linear-gradient(180deg, var(--bg-page, #cdb88a) 0%, var(--bg-page-deep, #a08c5d) 100%)',
      }}
    >
      {/* Базовый радиальный wash атмосферного цвета. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 100% 80% at 50% 20%, var(--atmos-tint-soft, transparent) 0%, transparent 70%), radial-gradient(ellipse 80% 100% at 50% 100%, var(--atmos-tint-deep, transparent) 0%, transparent 80%)',
          transition: 'background var(--phase-transition, 1500ms) ease',
        }}
      />

      {atmos === 'morning' && <SunRays />}
      {atmos === 'day' && <DayWaves />}
      {atmos === 'evening' && <EveningFog />}
      {atmos === 'night' && <NightStars />}
    </div>
  )
}

function SunRays() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Большое солнце в правом верхнем углу. */}
      <div
        className="absolute -right-32 -top-32 h-[480px] w-[480px] rounded-full animate-breath"
        style={{
          background:
            'radial-gradient(circle, rgba(255, 220, 130, 0.55) 0%, rgba(255, 180, 80, 0.25) 40%, transparent 70%)',
          filter: 'blur(8px)',
        }}
      />
      {/* Несколько лучей. */}
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="absolute origin-top-right opacity-30"
          style={{
            top: `${10 + i * 5}%`,
            right: '0%',
            width: '120%',
            height: '2px',
            background:
              'linear-gradient(90deg, transparent 0%, rgba(255, 200, 100, 0.4) 40%, rgba(255, 220, 130, 0.6) 80%, transparent 100%)',
            transform: `rotate(${-25 - i * 4}deg)`,
          }}
        />
      ))}
    </div>
  )
}

function DayWaves() {
  return (
    <div className="absolute inset-x-0 bottom-0 h-[40vh] overflow-hidden">
      {/* Три слоя волн с разной скоростью. */}
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="absolute left-0 right-0 animate-wave"
          style={{
            bottom: `${i * 24}px`,
            height: '60px',
            opacity: 0.18 - i * 0.05,
            background: `repeating-linear-gradient(90deg, transparent 0, transparent 40px, var(--atmos-tint, #0EA5E9) 40px, var(--atmos-tint, #0EA5E9) 42px, transparent 42px, transparent 90px)`,
            animationDuration: `${7 + i * 3}s`,
            animationDelay: `${i * -2}s`,
            maskImage:
              'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.7) 100%)',
          }}
        />
      ))}
    </div>
  )
}

function EveningFog() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Полосы тумана плывут горизонтально. */}
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="absolute h-[140px] w-[60vw] rounded-full animate-fog-drift"
          style={{
            top: `${15 + i * 22}%`,
            background:
              'radial-gradient(ellipse, var(--atmos-fog, rgba(180,170,200,0.4)) 0%, transparent 70%)',
            filter: 'blur(20px)',
            animationDuration: `${30 + i * 10}s`,
            animationDelay: `${i * -7}s`,
          }}
        />
      ))}
      {/* Тёмная вертикальная виньетка по краям. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(90deg, rgba(31, 26, 53, 0.4) 0%, transparent 15%, transparent 85%, rgba(31, 26, 53, 0.4) 100%)',
        }}
      />
    </div>
  )
}

function NightStars() {
  // Сетка случайно расставленных звёзд — детерминированно (по seed-индексу),
  // чтобы рендер не дёргался.
  const stars = Array.from({ length: 60 }, (_, i) => ({
    top: (i * 37) % 100,
    left: (i * 53 + 7) % 100,
    size: (i % 3) + 1,
    delay: (i % 7) * 0.5,
  }))
  return (
    <div className="absolute inset-0">
      {stars.map((s, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-amber-50 animate-star-twinkle"
          style={{
            top: `${s.top}%`,
            left: `${s.left}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            animationDelay: `${s.delay}s`,
            boxShadow: '0 0 4px rgba(255, 240, 200, 0.7)',
          }}
        />
      ))}
    </div>
  )
}
