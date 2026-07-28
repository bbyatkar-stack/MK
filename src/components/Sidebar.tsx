import { CATEGORIES } from '../types'
import type { Category } from '../types'

export type View = 'catalog' | 'generations'
export type CategoryFilter = Category | 'Все'

interface SidebarProps {
  view: View
  onViewChange: (view: View) => void
  activeCategory: CategoryFilter
  onCategoryChange: (category: CategoryFilter) => void
  categoryCounts: Partial<Record<Category, number>>
  totalCount: number
}

function Sidebar({
  view,
  onViewChange,
  activeCategory,
  onCategoryChange,
  categoryCounts,
  totalCount,
}: SidebarProps) {
  const categories: CategoryFilter[] = ['Все', ...CATEGORIES]

  return (
    <aside className="sidebar">
      <button type="button" className="brand-row brand-link" onClick={() => onViewChange('catalog')}>
        <div className="mark">M</div>
        <div className="word">MK</div>
      </button>

      <nav className="nav-list-c">
        <button
          type="button"
          className={view === 'generations' ? 'nav-item-c is-active' : 'nav-item-c'}
          onClick={() => onViewChange('generations')}
        >
          <svg
            className="nav-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="5" width="14" height="14" rx="2" />
            <path d="M7 5V4a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-1" />
          </svg>
          Мои генерации
        </button>
      </nav>

      {view === 'catalog' && (
        <>
          <p className="section-label">Категории</p>
          <div className="cat-list">
            {categories.map((cat) => {
              const count = cat === 'Все' ? totalCount : (categoryCounts[cat] ?? 0)
              const classes =
                'cat-item' +
                (activeCategory === cat ? ' is-active' : '') +
                (count === 0 ? ' is-empty' : '')
              return (
                <button
                  key={cat}
                  type="button"
                  className={classes}
                  onClick={() => onCategoryChange(cat)}
                >
                  <span>{cat}</span>
                  <span className="cat-count tnum">{count}</span>
                </button>
              )
            })}
          </div>
        </>
      )}

      <div className="spacer" />
    </aside>
  )
}

export default Sidebar
