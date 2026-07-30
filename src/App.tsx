import { useEffect, useState } from 'react'
import AddProductForm from './components/AddProductForm'
import AuthPanel from './components/AuthPanel'
import GenerationPanel from './components/GenerationPanel'
import GenerationsCatalog from './components/GenerationsCatalog'
import ProductList from './components/ProductList'
import Sidebar from './components/Sidebar'
import type { CategoryFilter, View } from './components/Sidebar'
import TopBar from './components/TopBar'
import { supabase } from './lib/supabaseClient'
import { useProfile } from './lib/useProfile'
import { useSession } from './lib/useSession'
import type { Category, Product } from './types'
import './App.css'

function App() {
  const { session, loading: sessionLoading } = useSession()
  const { profile, reload: reloadProfile } = useProfile(session)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [generatingProduct, setGeneratingProduct] = useState<Product | null>(null)
  const [viewingGenerationsFor, setViewingGenerationsFor] = useState<Product | null>(null)
  const [generationsRefreshKey, setGenerationsRefreshKey] = useState(0)
  const [view, setView] = useState<View>('catalog')
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('Все')
  const [paymentProcessing, setPaymentProcessing] = useState(
    () => new URLSearchParams(window.location.search).get('payment') === 'processing',
  )

  // Вернулись с оплаты ЮKassa — баллы начисляет вебхук асинхронно, поэтому
  // показываем баннер и несколько раз перепроверяем баланс, пока он не придёт.
  useEffect(() => {
    if (!paymentProcessing) return

    const url = new URL(window.location.href)
    url.searchParams.delete('payment')
    window.history.replaceState({}, '', url.toString())

    let attempts = 0
    const interval = setInterval(() => {
      attempts += 1
      reloadProfile()
      if (attempts >= 6) {
        clearInterval(interval)
        setPaymentProcessing(false)
      }
    }, 3000)

    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentProcessing])

  useEffect(() => {
    async function loadProducts() {
      const { data, error } = await supabase
        .from('products')
        .select()
        .order('created_at', { ascending: false })

      if (error) {
        setLoadError(error.message)
      } else {
        setProducts(data as Product[])
      }
      setLoading(false)
    }

    loadProducts()
  }, [])

  function handleAdd(product: Product) {
    setProducts((prev) => [product, ...prev])
  }

  const categoryCounts = products.reduce<Partial<Record<Category, number>>>((acc, p) => {
    if (p.category) acc[p.category] = (acc[p.category] ?? 0) + 1
    return acc
  }, {})

  const filteredProducts =
    activeCategory === 'Все' ? products : products.filter((p) => p.category === activeCategory)

  return (
    <div className="app-shell">
      <Sidebar
        view={view}
        onViewChange={setView}
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
        categoryCounts={categoryCounts}
        totalCount={products.length}
      />

      <main className="app-main">
        {!sessionLoading && (
          <TopBar session={session} profile={profile} onProfileChanged={reloadProfile} />
        )}

        <div className="page">
          {paymentProcessing && (
            <div className="payment-banner">
              <span>Оплата обрабатывается — баланс обновится автоматически через несколько секунд.</span>
              <button type="button" className="link-button" onClick={() => setPaymentProcessing(false)}>
                Закрыть
              </button>
            </div>
          )}

          {sessionLoading && <p className="empty-state">Загрузка...</p>}

          {!sessionLoading && !session && (
            <header className="page-header">
              <h1>MK</h1>
              <p className="page-subtitle">Каталог товаров и генерация фото с помощью ИИ.</p>
            </header>
          )}

          {!sessionLoading && <AuthPanel session={session} />}

          {!sessionLoading && view === 'catalog' && (
            <>
              <AddProductForm session={session} onAdd={handleAdd} />

              <section>
                <h2 className="section-title">
                  {activeCategory === 'Все' ? 'Товары' : activeCategory} ({filteredProducts.length})
                </h2>
                {loading && <p className="empty-state">Загрузка...</p>}
                {loadError && <p className="form-error">Ошибка загрузки: {loadError}</p>}
                {!loading && !loadError && (
                  <ProductList
                    products={filteredProducts}
                    onGenerate={setGeneratingProduct}
                    onShowGenerations={setViewingGenerationsFor}
                  />
                )}
              </section>
            </>
          )}

          {!sessionLoading && view === 'generations' && (
            <GenerationsCatalog session={session} refreshKey={generationsRefreshKey} />
          )}
        </div>
      </main>

      {generatingProduct && (
        <GenerationPanel
          product={generatingProduct}
          session={session}
          profile={profile}
          onClose={() => {
            setGeneratingProduct(null)
            setGenerationsRefreshKey((k) => k + 1)
          }}
          onBalanceChanged={reloadProfile}
        />
      )}

      {viewingGenerationsFor && (
        <div className="modal-overlay" onClick={() => setViewingGenerationsFor(null)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="modal-close"
              onClick={() => setViewingGenerationsFor(null)}
            >
              ×
            </button>
            <GenerationsCatalog
              session={session}
              refreshKey={generationsRefreshKey}
              productId={viewingGenerationsFor.id}
              title={`Генерации: ${viewingGenerationsFor.name}`}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default App
