function Hero() {
  return (
    <div className="hero-block">
      <svg
        className="hero-art"
        viewBox="0 0 240 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect x="26" y="56" width="120" height="120" rx="14" fill="var(--code-bg)" stroke="var(--border)" />
        <rect x="54" y="34" width="120" height="120" rx="14" fill="var(--bg)" stroke="var(--border)" />
        <rect x="70" y="52" width="88" height="60" rx="8" fill="var(--accent-bg, var(--code-bg))" />
        <path
          d="M78 100 96 78l14 16 12-14 18 22"
          stroke="var(--accent)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <circle cx="146" cy="66" r="7" fill="var(--accent)" />
        <rect x="78" y="120" width="56" height="8" rx="4" fill="var(--border)" />
        <rect x="78" y="134" width="36" height="8" rx="4" fill="var(--border)" />
        <path
          d="M188 40l4 10 10 4-10 4-4 10-4-10-10-4 10-4Z"
          fill="var(--accent)"
        />
      </svg>

      <h1>Формирование карточек товаров</h1>
      <p className="page-subtitle">
        Загружайте фото и получайте готовые карточки товаров с помощью ИИ.
      </p>
    </div>
  )
}

export default Hero
