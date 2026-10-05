import { jwtVerify, SignJWT } from 'jose'
import { cookies } from 'next/headers'

const getSecret = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined')
  }
  return new TextEncoder().encode(process.env.JWT_SECRET)
}

export async function createSession(payload: any) {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(getSecret());
    
  (await cookies()).set('admin_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/'
  })
}

export async function getSession() {
  const token = (await cookies()).get('admin_session')?.value
  if (!token) return null
  
  try {
    const { payload } = await jwtVerify(token, getSecret())
    return payload
  } catch (error) {
    return null
  }
}

export async function clearSession() {
  (await cookies()).delete('admin_session')
}
