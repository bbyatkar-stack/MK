import { useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'
import type { Product } from '../types'

interface AddProductFormProps {
  session: Session | null
  onAdd: (product: Product) => void
}

// Claude умеет понимать только jpeg/png/webp/gif, а avif (частый формат
// картинок из интернета) — нет. Такие фото перекодируем в jpeg через canvas.
async function toUploadable(file: File): Promise<{ blob: Blob; ext: string }> {
  if (file.type !== 'image/avif') {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    return { blob: file, ext }
  }

  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0)
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Не удалось сконвертировать фото'))),
      'image/jpeg',
      0.92,
    ),
  )
  return { blob, ext: 'jpg' }
}

function AddProductForm({ session, onAdd }: AddProductFormProps) {
  const [name, setName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [statusText, setStatusText] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null
    setError(null)
    setFile(selected)
    setPreviewUrl(selected ? URL.createObjectURL(selected) : null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!session) {
      setError('Войдите или зарегистрируйтесь, чтобы добавить товар')
      return
    }

    if (!file) {
      setError('Сначала выберите фото товара')
      return
    }

    setSubmitting(true)
    setError(null)

    let uploadBlob: Blob
    let ext: string
    try {
      ;({ blob: uploadBlob, ext } = await toUploadable(file))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось обработать фото')
      setSubmitting(false)
      return
    }

    const filePath = `${crypto.randomUUID()}.${ext}`

    setStatusText('Загружаем фото...')
    const { error: uploadError } = await supabase.storage
      .from('product-photos')
      .upload(filePath, uploadBlob, { contentType: uploadBlob.type || undefined })

    if (uploadError) {
      setError(`Не удалось загрузить фото: ${uploadError.message}`)
      setSubmitting(false)
      setStatusText('')
      return
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('product-photos').getPublicUrl(filePath)

    // Спрашиваем у Claude категорию и название по фото. Если не получилось —
    // всё равно сохраняем товар, просто без категории (имя впишет пользователь сам).
    setStatusText('Определяем товар (ИИ)...')
    let category: string | null = null
    let aiName: string | null = null
    try {
      const { data: aiData, error: aiError } = await supabase.functions.invoke(
        'Detect-category',
        { body: { imageUrl: publicUrl } },
      )
      if (!aiError) {
        category = (aiData?.category as string) ?? null
        aiName = (aiData?.name as string) ?? null
      }
    } catch {
      // молча сохраняем без категории и имени от ИИ
    }

    setStatusText('Сохраняем товар...')
    const { data, error: insertError } = await supabase
      .from('products')
      .insert({
        user_id: session.user.id,
        name: name.trim() || aiName || 'Товар без названия',
        category,
        image_url: publicUrl,
      })
      .select()
      .single()

    setSubmitting(false)
    setStatusText('')

    if (insertError) {
      setError(`Не удалось сохранить товар: ${insertError.message}`)
      return
    }

    onAdd(data as Product)

    setName('')
    setFile(null)
    setPreviewUrl(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  if (!session) {
    return (
      <div className="add-form">
        <h2>Добавить товар</h2>
        <p className="empty-state">
          Войдите или зарегистрируйтесь выше, чтобы добавлять товары.
        </p>
      </div>
    )
  }

  return (
    <form className="add-form" onSubmit={handleSubmit}>
      <h2>Добавить товар</h2>

      <label className="photo-picker">
        {previewUrl ? (
          <img src={previewUrl} alt="Предпросмотр товара" className="photo-preview" />
        ) : (
          <span className="photo-picker-placeholder">
            Нажмите, чтобы выбрать фото
          </span>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          hidden
        />
      </label>

      <input
        type="text"
        placeholder="Название (необязательно — если пусто, определит ИИ)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="text-input"
      />

      {error && <p className="form-error">{error}</p>}

      <button type="submit" className="primary-button" disabled={submitting}>
        {submitting ? statusText || 'Загружаем...' : 'Добавить товар'}
      </button>
    </form>
  )
}

export default AddProductForm
