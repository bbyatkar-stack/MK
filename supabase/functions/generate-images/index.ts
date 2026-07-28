// Серверная функция Supabase: генерирует фото товара через Google Gemini
// и сохраняет результат в базу. Ключ GEMINI_API_KEY хранится в секретах
// Supabase и в браузер не попадает. SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY
// Supabase подставляет автоматически в каждую Edge Function.

import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

async function fetchImageAsBase64(url: string) {
  const resp = await fetch(url)
  const buf = new Uint8Array(await resp.arrayBuffer())
  let binary = ''
  for (const b of buf) binary += String.fromCharCode(b)
  return {
    base64: btoa(binary),
    mimeType: resp.headers.get('content-type') || 'image/jpeg',
  }
}

function base64ToBytes(base64: string) {
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// У свежих платных Google-аккаунтов бывает совсем маленький лимит запросов
// в минуту — при 429 (RESOURCE_EXHAUSTED) пробуем ещё пару раз с паузой,
// вместо того чтобы сразу ронять всю генерацию.
async function fetchWithRetry(url: string, init: RequestInit, retries = 3) {
  for (let attempt = 0; ; attempt++) {
    const resp = await fetch(url, init)
    if (resp.ok || resp.status !== 429 || attempt >= retries) {
      return resp
    }
    await sleep(3000 * (attempt + 1))
  }
}

// Просьба «сделай не похожим на другие» ИИ обычно игнорирует — картинки
// выходят почти одинаковые. Вместо этого явно задаём разный ракурс/план
// для каждого варианта по кругу — так результаты гарантированно различаются.
const ANGLE_VARIANTS = [
  'Ракурс: анфас, товар по центру кадра, светлый однотонный фон, студийный свет.',
  'Ракурс: сбоку (профиль), контрастный тёмный фон.',
  'Ракурс: сзади, под углом, цветной фон (не белый и не тёмный).',
  'Ракурс: три четверти, в динамике/движении, в естественной обстановке (интерьер или улица) — совсем другая сцена, не студия.',
  'Очень крупный план — только детали и текстура товара, размытый фон (боке).',
  'Общий план издалека — товар маленький в кадре, в жизненной обстановке, много свободного пространства вокруг.',
]

async function generateOneImage(
  apiKey: string,
  prompt: string,
  refImage: { base64: string; mimeType: string },
  variantIndex: number,
  variantCount: number,
) {
  const variedPrompt =
    variantCount > 1
      ? `${prompt} ${ANGLE_VARIANTS[variantIndex % ANGLE_VARIANTS.length]}`
      : prompt

  const resp = await fetchWithRetry(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: variedPrompt },
              { inlineData: { mimeType: refImage.mimeType, data: refImage.base64 } },
            ],
          },
        ],
        generationConfig: { temperature: 1 },
      }),
    },
  )

  if (!resp.ok) {
    throw new Error(`Ошибка Gemini (картинка): ${await resp.text()}`)
  }

  const data = await resp.json()
  const parts = data?.candidates?.[0]?.content?.parts ?? []
  const imagePart = parts.find((p: { inlineData?: unknown }) => p.inlineData)
  if (!imagePart) {
    throw new Error(`Gemini не вернул изображение. Ответ целиком: ${JSON.stringify(data)}`)
  }
  return {
    base64: imagePart.inlineData.data as string,
    mimeType: imagePart.inlineData.mimeType as string,
  }
}

async function generateTitleAndDescription(
  apiKey: string,
  context: string,
  needDescription: boolean,
): Promise<{ title: string | null; description: string | null; debug?: string }> {
  const instructions = needDescription
    ? 'Придумай короткий привлекательный заголовок (3-6 слов) и короткое описание ' +
      '(1-2 предложения) для карточки товара.'
    : 'Придумай короткое название (3-6 слов) для этой генерации в каталоге пользователя.'

  const resp = await fetchWithRetry(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text:
                  `${instructions} Контекст: ${context}. Ответь СТРОГО в формате JSON, ` +
                  'без пояснений и без markdown-разметки: {"title": "...", "description": "..."}',
              },
            ],
          },
        ],
      }),
    },
  )

  if (!resp.ok) {
    return { title: null, description: null, debug: `HTTP ${resp.status}: ${await resp.text()}` }
  }

  const data = await resp.json()
  const raw = (data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}')
    .trim()
    .replace(/^```json/i, '')
    .replace(/^```/, '')
    .replace(/```$/, '')
    .trim()
  try {
    const parsed = JSON.parse(raw)
    return {
      title: parsed.title?.trim() || null,
      description: parsed.description?.trim() || null,
    }
  } catch {
    return { title: null, description: null, debug: `Не разобрался с ответом: ${raw}` }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const {
      generationId,
      imageUrl,
      type,
      preset,
      prompt,
      quantity,
      productName,
      category,
    } = await req.json()

    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) {
      return json({ error: 'Ключ GEMINI_API_KEY не настроен на сервере' }, 500)
    }

    const refImage = await fetchImageAsBase64(imageUrl)

    const promptText = [
      `Ты — генератор рекламных фото товара «${productName}» (категория: ${category ?? 'не указана'}).`,
      preset ? `Стиль показа: ${preset}.` : '',
      prompt ? `Пожелания: ${prompt}.` : '',
      'Используй приложенное фото как референс товара и создай новое фотореалистичное ' +
        'изображение с этим товаром в описанном стиле.',
    ]
      .filter(Boolean)
      .join(' ')

    // Генерируем все картинки параллельно — по одной за раз выходило слишком
    // долго (десятки секунд на каждую) и рисковало упереться в таймаут функции.
    const images = await Promise.all(
      Array.from({ length: quantity }, async (_, i) => {
        const generated = await generateOneImage(apiKey, promptText, refImage, i, quantity)
        const path = `${generationId}/${crypto.randomUUID()}.png`

        const { error: uploadError } = await supabaseAdmin.storage
          .from('generation-results')
          .upload(path, base64ToBytes(generated.base64), {
            contentType: generated.mimeType || 'image/png',
          })
        if (uploadError) {
          throw new Error(`Не удалось сохранить картинку: ${uploadError.message}`)
        }

        const {
          data: { publicUrl },
        } = supabaseAdmin.storage.from('generation-results').getPublicUrl(path)
        return publicUrl
      }),
    )

    const { title, description, debug } = await generateTitleAndDescription(
      apiKey,
      `товар «${productName}», категория ${category ?? 'не указана'}, тип генерации ${type}`,
      type === 'card',
    )

    await supabaseAdmin.from('generation_images').insert(
      images.map((image_url, position) => ({ generation_id: generationId, image_url, position })),
    )

    await supabaseAdmin
      .from('generations')
      .update({ status: 'done', title, description })
      .eq('id', generationId)

    return json({ images, title, description, titleDebug: debug })
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
