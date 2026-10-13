// Payment mode: real Midtrans when both keys are set, otherwise a fake QRIS
// flow for demos (/pay/demo/[id]). Setting the keys turns demo mode off.
export function isMidtransConfigured() {
  const serverKey = process.env.MIDTRANS_SERVER_KEY
  const clientKey = process.env.MIDTRANS_CLIENT_KEY
  if (!serverKey || serverKey.startsWith('your-') || !clientKey || clientKey.startsWith('your-')) {
    return false
  }
  return true
}

export function isDemoPayment() {
  return !isMidtransConfigured()
}
