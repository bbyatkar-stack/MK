import type { Product } from '../types'

interface ProductListProps {
  products: Product[]
  onGenerate: (product: Product) => void
  onShowGenerations: (product: Product) => void
}

function ProductList({ products, onGenerate, onShowGenerations }: ProductListProps) {
  if (products.length === 0) {
    return (
      <p className="empty-state">
        Пока нет ни одного товара — добавьте первый выше.
      </p>
    )
  }

  return (
    <div className="product-grid">
      {products.map((product) => (
        <div className="product-card" key={product.id}>
          <img src={product.image_url} alt={product.name} className="product-photo" />
          <div className="product-info">
            <p className="product-name">{product.name}</p>
            <span className="product-category">
              {product.category ?? 'Категория: определится позже (ИИ)'}
            </span>
            <div className="card-actions">
              <button
                type="button"
                className="secondary-button generate-button"
                onClick={() => onGenerate(product)}
              >
                Сгенерировать
              </button>
              <button
                type="button"
                className="secondary-button generate-button"
                onClick={() => onShowGenerations(product)}
              >
                Генерации
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default ProductList
