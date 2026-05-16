import { motion } from 'motion/react'
import { useAtmosphere } from '@/ui/theme'
import { SeagullIcon } from '@/ui/icons'

/**
 * Чайки — летающие птицы по фону. Появляются на morning/day/evening, на night отсутствуют.
 * Привязаны к атмосфере (не к state.seagullTokens напрямую — это ambient декор).
 * См. docs/design-roadmap.md §11.
 */
export function Seagulls() {
  const atmos = useAtmosphere()
  if (atmos === 'night' || atmos === 'neutral') return null

  // Несколько чаек по разным траекториям.
  const birds = [
    { delay: 0, top: '12%', duration: 22, size: 28 },
    { delay: 7, top: '6%', duration: 30, size: 22 },
    { delay: 14, top: '18%', duration: 26, size: 18 },
  ]

  return (
    <div className="pointer-events-none fixed inset-0 -z-[5] overflow-hidden">
      {birds.map((b, i) => (
        <motion.div
          key={i}
          initial={{ x: '-10vw', y: 0, opacity: 0 }}
          animate={{
            x: '110vw',
            y: [0, -12, 4, -8, 0],
            opacity: [0, 0.6, 0.6, 0.6, 0],
          }}
          transition={{
            duration: b.duration,
            delay: b.delay,
            repeat: Infinity,
            repeatDelay: 18,
            ease: 'linear',
            times: [0, 0.25, 0.5, 0.75, 1],
          }}
          style={{ position: 'absolute', top: b.top }}
          className="text-ink/30"
        >
          <SeagullIcon size={b.size} />
        </motion.div>
      ))}
    </div>
  )
}
