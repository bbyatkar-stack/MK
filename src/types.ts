export const CATEGORIES = [
  'Одежда и обувь',
  'Аксессуары',
  'Еда и напитки',
  'Косметика и уход',
  'Гаджеты и техника',
  'Дом и мебель',
  'Прочее',
] as const

export type Category = (typeof CATEGORIES)[number]

export interface Product {
  id: string
  user_id: string | null
  name: string
  category: Category | null
  image_url: string
  created_at: string
}

export interface Profile {
  id: string
  balance: number
  created_at: string
}

export const POINT_PACKAGES = [
  { label: 'Малый', points: 100 },
  { label: 'Средний', points: 500 },
  { label: 'Большой', points: 1500 },
] as const

export type GenerationType = 'photo' | 'card'

export const POINTS_PER_ITEM: Record<GenerationType, number> = {
  photo: 20,
  card: 50,
}

export const PRESETS_BY_CATEGORY: Record<Category, string[]> = {
  'Одежда и обувь': ['На модели', 'На манекене', 'Плоская раскладка', 'В движении на улице'],
  Аксессуары: ['Крупный план на фоне', 'В руке', 'На модели', 'Плоская раскладка'],
  'Еда и напитки': ['На столе с сервировкой', 'Крупный план', 'В руках', 'На фоне кухни'],
  'Косметика и уход': [
    'На мраморной поверхности',
    'В руке',
    'Рядом с ингредиентами',
    'Крупный план текстуры',
  ],
  'Гаджеты и техника': ['На столе минимализм', 'В руке', 'В интерьере', 'Крупный план деталей'],
  'Дом и мебель': [
    'В интерьере гостиной',
    'Крупный план текстуры',
    'На светлом фоне',
    'В интерьере спальни',
  ],
  Прочее: [],
}

export interface Generation {
  id: string
  user_id: string
  product_id: string
  type: GenerationType
  preset: string | null
  prompt: string | null
  quantity: number
  price: number
  title: string | null
  description: string | null
  status: string
  created_at: string
}

export interface GenerationImage {
  id: string
  generation_id: string
  image_url: string
  position: number
}
