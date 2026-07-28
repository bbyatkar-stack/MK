import { useState } from 'react'

interface CarouselProps {
  images: string[]
  onDownload: (url: string, index: number) => void
}

function Carousel({ images, onDownload }: CarouselProps) {
  const [index, setIndex] = useState(0)

  if (images.length === 0) return null

  function prev() {
    setIndex((i) => (i - 1 + images.length) % images.length)
  }

  function next() {
    setIndex((i) => (i + 1) % images.length)
  }

  return (
    <div className="carousel">
      <div className="carousel-main">
        {images.length > 1 && (
          <button
            type="button"
            className="carousel-arrow carousel-arrow-left"
            onClick={prev}
            aria-label="Предыдущее фото"
          >
            ‹
          </button>
        )}
        <img
          src={images[index]}
          alt={`Изображение ${index + 1} из ${images.length}`}
          className="carousel-image"
        />
        {images.length > 1 && (
          <button
            type="button"
            className="carousel-arrow carousel-arrow-right"
            onClick={next}
            aria-label="Следующее фото"
          >
            ›
          </button>
        )}
      </div>

      {images.length > 1 && (
        <div className="carousel-dots">
          {images.map((_, i) => (
            <button
              key={i}
              type="button"
              className={i === index ? 'carousel-dot active' : 'carousel-dot'}
              onClick={() => setIndex(i)}
              aria-label={`Слайд ${i + 1}`}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        className="secondary-button"
        onClick={() => onDownload(images[index], index)}
      >
        Скачать это фото
      </button>
    </div>
  )
}

export default Carousel
