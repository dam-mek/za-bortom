/**
 * Словарь подсказок для info-badge на картах.
 *
 * TODO (пользователь):
 *   Все body-тексты помечены `TODO_BODY` — впишите свои описания вручную.
 *   Источник правил — docs/game-rules.md.
 *   Структура: { title: 'Имя', subtitle?: 'Категория · модификаторы', body: 'описание' }
 */

import type { CharacterId, SupplyType } from '@/game/constants'

export interface TooltipContent {
  readonly title: string
  readonly subtitle?: string
  readonly body: string
}

const TODO_BODY = 'TODO: впишите описание здесь.'

// === Персонажи ===

export const CHARACTER_TOOLTIPS: Record<CharacterId, TooltipContent> = {
  bocman: {
    title: 'Боцман',
    subtitle: 'Сила 8 · Очки 4',
    body: TODO_BODY,
  },
  shket: {
    title: 'Шкет',
    subtitle: 'Сила 3 · Очки 9',
    body: TODO_BODY,
  },
  snob: {
    title: 'Сноб',
    subtitle: 'Сила 5 · Очки 7',
    body: TODO_BODY,
  },
  kapitan: {
    title: 'Капитан',
    subtitle: 'Сила 7 · Очки 5',
    body: TODO_BODY,
  },
  miledi: {
    title: 'Миледи',
    subtitle: 'Сила 4 · Очки 8',
    body: TODO_BODY,
  },
  cherpak: {
    title: 'Черпак',
    subtitle: 'Сила 6 · Очки 6',
    body: TODO_BODY,
  },
}

// === Карты припасов ===

export const SUPPLY_TOOLTIPS: Record<SupplyType, TooltipContent> = {
  water: { title: 'Вода', subtitle: 'Одноразовая', body: TODO_BODY },
  first_aid: { title: 'Аптечка', subtitle: 'Одноразовая', body: TODO_BODY },
  umbrella: { title: 'Зонт', subtitle: 'Многоразовый', body: TODO_BODY },
  flare: {
    title: 'Ракетница',
    subtitle: 'Одноразовое оружие',
    body: TODO_BODY,
  },
  compass: { title: 'Компас', subtitle: 'Многоразовый', body: TODO_BODY },
  life_ring: {
    title: 'Спасательный круг',
    subtitle: 'Многоразовый',
    body: TODO_BODY,
  },
  oar: { title: 'Весло', subtitle: 'Оружие (+1)', body: TODO_BODY },
  shark_bait: {
    title: 'Приманка для акул',
    subtitle: 'Одноразовая',
    body: TODO_BODY,
  },
  club: { title: 'Дубинка', subtitle: 'Оружие (+2)', body: TODO_BODY },
  hook: { title: 'Багор', subtitle: 'Оружие (+4)', body: TODO_BODY },
  knife: { title: 'Нож', subtitle: 'Оружие (+3)', body: TODO_BODY },
  money: {
    title: 'Деньги',
    subtitle: 'Ценность · ×2 у Капитана',
    body: TODO_BODY,
  },
  jewelry: {
    title: 'Драгоценности',
    subtitle: 'Ценность · ×2 у Миледи',
    body: TODO_BODY,
  },
  painting: {
    title: 'Картина',
    subtitle: 'Ценность · ×2 у Сноба',
    body: TODO_BODY,
  },
}

// === Колоды ===

export const DECK_TOOLTIPS = {
  supplies: { title: 'Колода припасов', body: TODO_BODY },
  navigation: { title: 'Колода навигации', body: TODO_BODY },
} as const

// === Чайки ===

export const SEAGULL_TOOLTIP: TooltipContent = {
  title: 'Чайки',
  body: TODO_BODY,
}
