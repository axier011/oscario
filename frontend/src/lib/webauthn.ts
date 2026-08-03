/** Base64url ↔ ArrayBuffer helpers */
function bufToB64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let str = ''
  bytes.forEach(b => (str += String.fromCharCode(b)))
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function b64urlToBuf(s: string): ArrayBuffer {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
  const str = atob(padded)
  const buf = new Uint8Array(str.length)
  for (let i = 0; i < str.length; i++) buf[i] = str.charCodeAt(i)
  return buf.buffer
}

function credToJson(c: PublicKeyCredential, type: 'create' | 'get'): object {
  if (type === 'create') {
    const r = c.response as AuthenticatorAttestationResponse
    return {
      id: c.id,
      rawId: bufToB64url(c.rawId),
      response: {
        clientDataJSON:    bufToB64url(r.clientDataJSON),
        attestationObject: bufToB64url(r.attestationObject),
      },
      type: c.type,
    }
  }
  const r = c.response as AuthenticatorAssertionResponse
  return {
    id: c.id,
    rawId: bufToB64url(c.rawId),
    response: {
      clientDataJSON:   bufToB64url(r.clientDataJSON),
      authenticatorData: bufToB64url(r.authenticatorData),
      signature:        bufToB64url(r.signature),
      userHandle:       r.userHandle ? bufToB64url(r.userHandle) : null,
    },
    type: c.type,
  }
}

export function isWebAuthnAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.PublicKeyCredential
}

export async function registerBiometric(token: string): Promise<void> {
  const optRes = await fetch('/api/v1/auth/webauthn/register/begin', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!optRes.ok) throw new Error(await optRes.text())
  const opts = await optRes.json() as Record<string, unknown>

  const publicKey: PublicKeyCredentialCreationOptions = {
    ...(opts as object),
    challenge: b64urlToBuf(opts.challenge as string),
    user: {
      ...(opts.user as object),
      id: b64urlToBuf((opts.user as { id: string }).id),
    },
    excludeCredentials: ((opts.excludeCredentials ?? []) as { id: string; type: string }[]).map(c => ({
      ...c,
      id: b64urlToBuf(c.id),
    })),
  } as PublicKeyCredentialCreationOptions

  const cred = await navigator.credentials.create({ publicKey }) as PublicKeyCredential
  if (!cred) throw new Error('Registro cancelado')

  const completeRes = await fetch('/api/v1/auth/webauthn/register/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(credToJson(cred, 'create')),
  })
  if (!completeRes.ok) throw new Error(await completeRes.text())
}

export async function loginBiometric(): Promise<string> {
  const optRes = await fetch('/api/v1/auth/webauthn/login/begin', { method: 'POST' })
  if (!optRes.ok) throw new Error('Sin credenciales registradas')
  const opts = await optRes.json() as Record<string, unknown>

  const publicKey: PublicKeyCredentialRequestOptions = {
    ...(opts as object),
    challenge: b64urlToBuf(opts.challenge as string),
    allowCredentials: ((opts.allowCredentials ?? []) as { id: string; type: string }[]).map(c => ({
      ...c,
      id: b64urlToBuf(c.id),
    })),
  } as PublicKeyCredentialRequestOptions

  const cred = await navigator.credentials.get({ publicKey }) as PublicKeyCredential
  if (!cred) throw new Error('Autenticación cancelada')

  const completeRes = await fetch('/api/v1/auth/webauthn/login/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credToJson(cred, 'get')),
  })
  if (!completeRes.ok) throw new Error('Verificación biométrica fallida')
  const data = await completeRes.json() as { token: string }
  return data.token
}
