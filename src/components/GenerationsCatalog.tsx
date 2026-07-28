import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import GenerationResultView from './GenerationResultView'
import { supabase } from '../lib/supabaseClient'
import type { Generation, GenerationImage } from '../types'

interface GenerationRow extends Generation {
  generation_images: GenerationImage[]
}

interface GenerationsCatalogProps {
  session: Session | null
  refreshKey: number
  productId?: string
  title?: string
}

function GenerationsCatalog({ session, refreshKey, productId, title }: GenerationsCatalogProps) {
  const [generations, setGenerations] = useState<GenerationRow[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<GenerationRow | null>(null)

  useEffect(() => {
    if (!session) {
      setGenerations([])
      return
    }

    setLoading(true)
    let query = supabase
      .from('generations')
      .select('*, generation_images(id, generation_id, image_url, position)')
      .order('created_at', { ascending: false })

    if (productId) {
      query = query.eq('product_id', productId)
    }

    query.then(({ data }) => {
      setGenerations((data as GenerationRow[]) ?? [])
      setLoading(false)
    })
  }, [session, refreshKey, productId])

  if (!session) return null

  return (
    <section>
      <h2 className="section-title">
        {title ?? 'Мои генерации'} ({generations.length})
      </h2>

      {loading && <p className="empty-state">Загрузка...</p>}
      {!loading && generations.length === 0 && (
        <p className="empty-state">Пока нет ни одной генерации.</p>
      )}

      <div className="product-grid">
        {generations.map((g) => {
          const sortedImages = [...g.generation_images].sort((a, b) => a.position - b.position)
          const thumb = sortedImages[0]

          return (
            <button
              key={g.id}
              type="button"
              className="generation-card"
              onClick={() => setSelected(g)}
            >
              {thumb ? (
                <img
                  src={thumb.image_url}
                  alt={g.title ?? 'Генерация'}
                  className="product-photo"
                />
              ) : (
                <div className="product-photo generation-placeholder">
                  {g.status === 'pending' ? 'В процессе' : 'Нет фото'}
                </div>
              )}
              <div className="product-info">
                <p className="product-name">{g.title ?? 'Без названия'}</p>
                <span className="product-category">
                  {g.type === 'card' ? 'Карточка' : 'Фото'} ·{' '}
                  {new Date(g.created_at).toLocaleDateString('ru-RU')}
                </span>
              </div>
            </button>
          )
        })}
      </div>

      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="modal-close" onClick={() => setSelected(null)}>
              ×
            </button>
            <h2>{selected.title ?? 'Генерация'}</h2>
            <GenerationResultView
              type={selected.type}
              title={null}
              description={selected.description}
              images={[...selected.generation_images]
                .sort((a, b) => a.position - b.position)
                .map((img) => img.image_url)}
              filenameBase={selected.title ?? 'generation'}
            />
          </div>
        </div>
      )}
    </section>
  )
}

export default GenerationsCatalog
