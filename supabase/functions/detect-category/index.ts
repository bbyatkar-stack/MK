// Серверная функция Supabase: определяет категорию и название товара по фото через Claude.
// Секретный ключ ANTHROPIC_API_KEY хранится в настройках Supabase и в браузер не попадает.

const CATEGORIES = [
  'Одежда и обувь',
  'Аксессуары',
  'Еда и напитки',
  'Косметика и уход',
  'Гаджеты и техника',
  'Дом и мебель',
  'Прочее',
]

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  // Браузер сначала шлёт «пробный» запрос OPTIONS — отвечаем ему разрешением.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { imageUrl } = await req.json()
    if (!imageUrl) {
      return json({ error: 'Не передана ссылка на фото (imageUrl)' }, 400)
    }

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) {
      return json({ error: 'Ключ ANTHROPIC_API_KEY не настроен на сервере' }, 500)
    }

    const anthropicResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'url', url: imageUrl } },
              {
                type: 'text',
                text:
                  'Определи товар на фото. Ответь СТРОГО в формате JSON, без пояснений ' +
                  'и без markdown-разметки:\n' +
                  '{"category": "<категория из списка ниже, слово в слово>", ' +
                  '"name": "<короткое название товара, 1-2 слова, например Куртка>"}\n\n' +
                  'Список категорий:\n' +
                  CATEGORIES.join('\n'),
              },
            ],
          },
        ],
      }),
    })

    if (!anthropicResp.ok) {
      const details = await anthropicResp.text()
      return json({ error: 'Ошибка обращения к Claude', details }, 502)
    }

    const data = await anthropicResp.json()
    const raw = (data?.content?.[0]?.text ?? '').trim()

    let parsed: { category?: string; name?: string } = {}
    try {
      parsed = JSON.parse(raw)
    } catch {
      // Если модель вернула не совсем JSON — подстрахуемся ниже.
    }

    const category = CATEGORIES.includes(parsed.category ?? '') ? parsed.category : 'Прочее'
    const name = parsed.name?.trim() || null

    return json({ category, name })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
