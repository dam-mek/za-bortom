import { useState } from 'react'
import { motion } from 'motion/react'
import { useGameStore } from '@/store/game-store'
import type { PlayerSpec } from '@/game/state'
import { HelpButton } from './Help'
import {
  WheelIcon,
  ScrollIcon,
  AnchorIcon,
  QuillIcon,
  WaxSealIcon,
  CompassIcon,
} from './icons'

type Mode = 'menu' | 'local' | 'host' | 'client'

/**
 * Lobby — пергаментная страница с тремя «штампами» для выбора режима.
 * См. docs/design-roadmap.md §13 (Lobby).
 */
export function Lobby() {
  const [mode, setMode] = useState<Mode>('menu')
  return (
    <main className="relative min-h-screen overflow-hidden">
      <PaperBackdrop />
      <div className="relative mx-auto flex min-h-screen max-w-4xl items-center justify-center px-6 py-12">
        {mode === 'menu' && <Menu onPick={setMode} />}
        {mode === 'local' && <LocalSetup onBack={() => setMode('menu')} />}
        {mode === 'host' && <HostSetup onBack={() => setMode('menu')} />}
        {mode === 'client' && <ClientSetup onBack={() => setMode('menu')} />}
      </div>
    </main>
  )
}

function PaperBackdrop() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, var(--bg-paper, #f1e6cf) 0%, var(--bg-paper-deep, #d9c8a0) 60%, #b89e6b 110%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-25 mix-blend-multiply"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='320' height='320'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.25 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />
      {/* Декоративные компасные розы по углам. */}
      <div className="pointer-events-none absolute left-6 top-6 text-ink/12">
        <CompassIcon size={64} />
      </div>
      <div className="pointer-events-none absolute right-6 bottom-6 text-ink/12">
        <CompassIcon size={64} />
      </div>
    </>
  )
}

function Menu({ onPick }: { onPick: (m: Mode) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="w-full max-w-2xl text-center text-ink"
    >
      <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.4em] text-ink-faint">
        — судовой журнал шлюпки №7 —
      </div>
      <h1 className="font-hand text-[88px] leading-none tracking-tight text-card-enemy-deep drop-shadow-sm">
        За бортом
      </h1>
      <div className="mx-auto mt-2 max-w-md font-serif text-[13px] italic text-ink-faint">
        четверо, пятеро или шестеро в одной шлюпке после кораблекрушения.
        кто-то доплывёт. кто-то нет.
      </div>

      <div className="mx-auto mt-10 grid max-w-2xl gap-4 md:grid-cols-3">
        <StampButton
          icon={<WheelIcon size={36} />}
          title="Hot-seat"
          subtitle="за одним экраном"
          onClick={() => onPick('local')}
          accent="enemy"
        />
        <StampButton
          icon={<AnchorIcon size={36} />}
          title="Создать комнату"
          subtitle="P2P · вы капитан"
          onClick={() => onPick('host')}
          accent="friend"
        />
        <StampButton
          icon={<ScrollIcon size={36} />}
          title="Подключиться"
          subtitle="по коду"
          onClick={() => onPick('client')}
          accent="nav"
        />
      </div>

      <div className="mt-10 flex items-center justify-center gap-4 text-ink-faint">
        <HelpButton />
      </div>
    </motion.div>
  )
}

function StampButton({
  icon,
  title,
  subtitle,
  onClick,
  accent,
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
  onClick: () => void
  accent: 'enemy' | 'friend' | 'nav'
}) {
  const accentClass: Record<typeof accent, string> = {
    enemy: 'border-card-enemy/60 text-card-enemy-deep',
    friend: 'border-card-friend/60 text-card-friend-deep',
    nav: 'border-card-nav-shadow/60 text-card-nav-shadow',
  }
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -3, rotate: -0.5 }}
      whileTap={{ scale: 0.97 }}
      className={`relative flex flex-col items-center gap-2 rounded-sm border-2 bg-paper/80 px-4 py-6 text-ink shadow-emboss transition ${accentClass[accent]}`}
      style={{
        boxShadow:
          'inset 0 0 0 1px rgba(255,255,255,0.4), 0 4px 12px rgba(0,0,0,0.18)',
      }}
    >
      <div className={`text-current`}>{icon}</div>
      <div className="font-stamp text-[15px] tracking-stamp">
        {title.toUpperCase()}
      </div>
      <div className="font-serif text-[11px] italic text-ink-faint">
        {subtitle}
      </div>
    </motion.button>
  )
}

// ===== Подменю =====

function FormShell({
  title,
  onBack,
  children,
}: {
  title: string
  onBack: () => void
  children: React.ReactNode
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35 }}
      className="w-full max-w-lg"
    >
      <button
        type="button"
        onClick={onBack}
        className="mb-3 inline-flex items-center gap-1 font-serif text-[12px] text-ink-faint hover:text-ink"
      >
        ← к выбору режима
      </button>
      <div
        className="relative rounded-sm border border-ink/30 bg-paper/90 p-6 shadow-journal"
        style={{
          boxShadow:
            'inset 0 0 0 1px rgba(255,255,255,0.5), 0 8px 20px rgba(0,0,0,0.18)',
        }}
      >
        <div className="absolute -top-3 left-6 bg-paper px-3 font-stamp text-[14px] tracking-stamp text-card-enemy-deep">
          {title.toUpperCase()}
        </div>
        {children}
      </div>
    </motion.div>
  )
}

function FieldRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="flex items-center justify-between gap-3 py-1.5">
      <span className="font-stamp text-[10px] tracking-stamp text-ink">
        {label.toUpperCase()}
      </span>
      <div className="flex-1 max-w-[200px]">{children}</div>
    </label>
  )
}

function TextField(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={
        'w-full rounded-sm border-b border-ink/40 bg-transparent px-2 py-1 font-hand text-[18px] text-ink outline-none transition focus:border-card-enemy ' +
        (props.className ?? '')
      }
    />
  )
}

function SubmitButton({
  onClick,
  disabled,
  label,
  busy,
}: {
  onClick: () => void
  disabled?: boolean
  label: string
  busy?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      className="group relative mx-auto mt-4 flex items-center gap-2 rounded-full border-2 border-card-enemy-deep bg-card-enemy px-5 py-2 font-stamp text-[12px] tracking-stamp text-paper shadow-emboss transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <WaxSealIcon size={18} />
      {busy ? 'ПОДОЖДИТЕ…' : label.toUpperCase()}
    </button>
  )
}

function LocalSetup({ onBack }: { onBack: () => void }) {
  const [numPlayers, setNumPlayers] = useState(4)
  const [seed, setSeed] = useState(42)
  const startLocalGame = useGameStore((s) => s.startLocalGame)

  function start() {
    const players: PlayerSpec[] = Array.from(
      { length: numPlayers },
      (_, i) => ({
        id: `p-${i + 1}`,
        displayName: `Игрок ${i + 1}`,
        isBot: false,
      }),
    )
    startLocalGame(players, seed)
  }

  return (
    <FormShell title="Hot-seat" onBack={onBack}>
      <div className="mb-4 font-serif text-[12px] italic text-ink-faint">
        Все игроки сидят за одним экраном и передают мышку друг другу.
        Скрытая информация в этом режиме не прячется — играйте честно.
      </div>
      <FieldRow label="Игроков">
        <select
          value={numPlayers}
          onChange={(e) => setNumPlayers(Number(e.target.value))}
          className="w-full rounded-sm border border-ink/30 bg-paper px-2 py-1 font-mono text-[13px] text-ink"
        >
          <option value={4}>4</option>
          <option value={5}>5</option>
          <option value={6}>6</option>
        </select>
      </FieldRow>
      <FieldRow label="Сид (рандом)">
        <TextField
          type="number"
          value={seed}
          onChange={(e) => setSeed(Number(e.target.value))}
        />
      </FieldRow>
      <SubmitButton onClick={start} label="Поднять якорь" />
    </FormShell>
  )
}

function HostSetup({ onBack }: { onBack: () => void }) {
  const [name, setName] = useState('Капитан')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const createRoom = useGameStore((s) => s.createRoom)

  async function start() {
    setBusy(true)
    setError(null)
    const res = await createRoom(name, code || undefined)
    setBusy(false)
    if (!res.ok) setError(res.error)
  }

  return (
    <FormShell title="Создать комнату" onBack={onBack}>
      <div className="mb-4 font-serif text-[12px] italic text-ink-faint">
        Вы становитесь капитаном — ваш браузер запускает игру и обслуживает
        соединения. Поделитесь кодом с друзьями.
      </div>
      <FieldRow label="Ваше имя">
        <TextField
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="например, Грэй"
        />
      </FieldRow>
      <FieldRow label="Код комнаты (опц.)">
        <TextField
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="auto"
        />
      </FieldRow>
      <SubmitButton
        onClick={start}
        disabled={!name}
        busy={busy}
        label="Расписаться капитаном"
      />
      {error && (
        <div className="mt-3 rounded-sm border border-card-enemy/50 bg-card-enemy/10 p-2 font-serif text-[12px] text-card-enemy-deep">
          {error}
        </div>
      )}
    </FormShell>
  )
}

function ClientSetup({ onBack }: { onBack: () => void }) {
  const [code, setCode] = useState('')
  const [name, setName] = useState('Игрок')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const joinRoom = useGameStore((s) => s.joinRoom)

  async function start() {
    if (!code) return
    setBusy(true)
    setError(null)
    const res = await joinRoom(code, name)
    setBusy(false)
    if (!res.ok) setError(res.error)
  }

  return (
    <FormShell title="Подключиться" onBack={onBack}>
      <div className="mb-4 font-serif text-[12px] italic text-ink-faint">
        Введите код, который вам выдал капитан — и поставьте подпись.
      </div>
      <FieldRow label="Код комнаты">
        <TextField
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="boat-xxxx"
        />
      </FieldRow>
      <FieldRow label="Ваше имя">
        <TextField value={name} onChange={(e) => setName(e.target.value)} />
      </FieldRow>
      <SubmitButton
        onClick={start}
        disabled={!code || !name}
        busy={busy}
        label="Подписать"
      />
      <div className="mt-3 flex items-center justify-center gap-1 font-serif text-[10px] italic text-ink-faint">
        <QuillIcon size={12} /> подпись подтверждает согласие плыть до конца
      </div>
      {error && (
        <div className="mt-3 rounded-sm border border-card-enemy/50 bg-card-enemy/10 p-2 font-serif text-[12px] text-card-enemy-deep">
          {error}
        </div>
      )}
    </FormShell>
  )
}
