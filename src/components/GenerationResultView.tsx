import Carousel from './Carousel'
import { downloadImage } from '../lib/download'
import type { GenerationType } from '../types'

interface GenerationResultViewProps {
  type: GenerationType
  title: string | null
  description: string | null
  images: string[]
  filenameBase: string
}

function GenerationResultView({
  type,
  title,
  description,
  images,
  filenameBase,
}: GenerationResultViewProps) {
  function handleDownload(url: string, index: number) {
    downloadImage(url, `${filenameBase}-${index + 1}.png`)
  }

  return (
    <div className="generation-result">
      {title && <p className="result-title">{title}</p>}
      {description && <p className="page-subtitle">{description}</p>}
      {images.length === 0 && <p className="form-error">Картинок нет.</p>}
      {type === 'card' && images.length > 0 ? (
        <Carousel images={images} onDownload={handleDownload} />
      ) : (
        <div className="result-grid">
          {images.map((url, index) => (
            <div key={url} className="result-item">
              <img src={url} alt={title ?? 'Результат генерации'} className="result-image" />
              <button
                type="button"
                className="secondary-button"
                onClick={() => handleDownload(url, index)}
              >
                Скачать
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default GenerationResultView
