import { useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import GenerationResultView from './GenerationResultView'
import { supabase } from '../lib/supabaseClient'
import { PRESETS_BY_CATEGORY, POINTS_PER_ITEM } from '../types'
import type { GenerationType, Product, Profile } from '../types'

interface GenerationPanelProps {
  product: Product
  session: Session | null
  profile: Profile | null
  onClose: () => void
  onBalanceChanged: () => void
}

function GenerationPanel({
  product,
  session,
  profile,
  onClose,
  onBalanceChanged,
}: GenerationPanelProps) {
  const [type, setType] = useState<GenerationType>('photo')
  const [preset, setPreset] = useState<string | null>(null)
  const [freeText, setFreeText] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [statusText, setStatusText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [resultImages, setResultImages] = useState<string[] | null>(null)
  const [resultTitle, setResultTitle] = useState<string | null>(null)
  const [resultDescription, setResultDescription] = useState<string | null>(null)

  const presets = product.category ? PRESETS_BY_CATEGORY[product.category] : []
  const price = quantity * POINTS_PER_ITEM[type]

  async function handleLaunch() {
    if (!session || !profile) {
      setError('Войдите или зарегистрируйтесь, чтобы запустить генерацию')
      return
    }

    if (profile.balance < price) {
      setError(`Недостаточно баллов: нужно ${price}, на балансе ${profile.balance}`)
      return
    }

    setSubmitting(true)
    setError(null)
    setStatusText('Создаём генерацию...')

    const { data: genRow, error: insertError } = await supabase
      .from('generations')
      .insert({
        user_id: session.user.id,
        product_id: product.id,
        type,
        preset,
        prompt: freeText.trim() || null,
        quantity,
        price,
        status: 'pending',
      })
      .select()
      .single()

    if (insertError || !genRow) {
      setError(`Не удалось создать генерацию: ${insertError?.message}`)
      setSubmitting(false)
      setStatusText('')
      return
    }

    const { error: balanceError } = await supabase
      .from('profiles')
      .update({ balance: profile.balance - price })
      .eq('id', profile.id)

    if (balanceError) {
      setError(`Баллы списать не удалось: ${balanceError.message}`)
      setSubmitting(false)
      setStatusText('')
      return
    }

    onBalanceChanged()

    setStatusText('Генерируем изображения (это может занять до минуты)...')
    const { data: genData, error: genError } = await supabase.functions.invoke(
      'generate-images',
      {
        body: {
          generationId: genRow.id,
          imageUrl: product.image_url,
          type,
          preset,
          prompt: freeText.trim() || null,
          quantity,
          productName: product.name,
          category: product.category,
        },
      },
    )

    setSubmitting(false)
    setStatusText('')

    if (genError) {
      setError(`Генерация не удалась: ${genError.message}`)
      return
    }

    setResultImages((genData?.images as string[]) ?? [])
    setResultTitle((genData?.title as string) ?? null)
    setResultDescription((genData?.description as string) ?? null)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose}>
          ×
        </button>

        <h2>Сгенерировать: {product.name}</h2>

        {!session && (
          <p className="form-error">
            Войдите или зарегистрируйтесь выше, чтобы запустить генерацию.
          </p>
        )}

        {resultImages ? (
          <div className="generation-result">
            <GenerationResultView
              type={type}
              title={resultTitle}
              description={resultDescription}
              images={resultImages}
              filenameBase={product.name}
            />

            <button type="button" className="primary-button" onClick={onClose}>
              Готово
            </button>
          </div>
        ) : (
          <>
            <div className="field-group">
              <p className="field-label">Тип генерации</p>
              <div className="toggle-group">
                <button
                  type="button"
                  className={type === 'photo' ? 'toggle-button active' : 'toggle-button'}
                  onClick={() => setType('photo')}
                >
                  Фото
                </button>
                <button
                  type="button"
                  className={type === 'card' ? 'toggle-button active' : 'toggle-button'}
                  onClick={() => setType('card')}
                >
                  Карточка (карусель + текст)
                </button>
              </div>
            </div>

            {presets.length > 0 && (
              <div className="field-group">
                <p className="field-label">Как показать товар</p>
                <div className="preset-grid">
                  {presets.map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={preset === p ? 'toggle-button active' : 'toggle-button'}
                      onClick={() => setPreset(preset === p ? null : p)}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="field-group">
              <p className="field-label">Пожелания (необязательно)</p>
              <textarea
                className="text-input"
                rows={3}
                value={freeText}
                onChange={(e) => setFreeText(e.target.value)}
                placeholder="Например: тёплые тона, вид сбоку..."
              />
            </div>

            <div className="field-group">
              <p className="field-label">Количество</p>
              <div className="quantity-picker">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                >
                  −
                </button>
                <span>{quantity}</span>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setQuantity((q) => Math.min(6, q + 1))}
                >
                  +
                </button>
              </div>
            </div>

            <p className="price-line">Стоимость: {price} баллов</p>

            {error && <p className="form-error">{error}</p>}

            <button
              type="button"
              className="primary-button"
              disabled={submitting || !session}
              onClick={handleLaunch}
            >
              {submitting ? statusText || 'Запускаем...' : 'Запустить генерацию'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default GenerationPanel
