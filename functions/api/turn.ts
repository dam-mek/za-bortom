// Cloudflare Pages Function: выдаёт временные ICE-credentials для WebRTC.
//
// Зачем нужно: PeerJS по умолчанию использует только Google STUN. Это работает
// между большинством домашних NAT, но ломается за VPN / двойным NAT / corporate
// firewall. TURN — это релей-сервер, через который трафик пробивается всегда.
//
// Cloudflare TURN: бесплатно до 1000 GB/мес.
// Credentials выписываем тут на сервере, чтобы не светить API_TOKEN в браузере.
//
// Настройка (одноразовая):
//   1. Cloudflare Dashboard → Realtime → TURN → создать TURN key.
//   2. Получить Token ID и API Token.
//   3. Pages → Settings → Environment variables (Production + Preview):
//        TURN_TOKEN_ID = <Token ID>
//        TURN_API_TOKEN = <API Token>   ← пометить "Encrypt"
//   4. Передеплоить (нажать "Retry deployment" в Pages).

interface Env {
  TURN_TOKEN_ID?: string
  TURN_API_TOKEN?: string
}

interface Context {
  env: Env
}

export const onRequestGet = async ({ env }: Context): Promise<Response> => {
  const tokenId = env.TURN_TOKEN_ID
  const apiToken = env.TURN_API_TOKEN

  if (!tokenId || !apiToken) {
    return json(
      {
        error: 'TURN not configured',
        hint: 'Set TURN_TOKEN_ID and TURN_API_TOKEN env vars in Cloudflare Pages settings',
      },
      503,
    )
  }

  try {
    const cfResponse = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${tokenId}/credentials/generate-ice-servers`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        // 24 часа — больше чем достаточно для одной сессии. Max — 48ч.
        body: JSON.stringify({ ttl: 86400 }),
      },
    )

    if (!cfResponse.ok) {
      const text = await cfResponse.text()
      return json(
        { error: 'Cloudflare TURN API error', status: cfResponse.status, body: text },
        502,
      )
    }

    const data = await cfResponse.json()
    return json(data, 200)
  } catch (e) {
    return json({ error: 'Fetch failed', message: e instanceof Error ? e.message : String(e) }, 500)
  }
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}
