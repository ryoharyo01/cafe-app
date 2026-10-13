declare module 'midtrans-client' {
  interface SnapOptions {
    isProduction: boolean
    serverKey: string
    clientKey: string
  }

  interface TransactionDetails {
    transaction_details: {
      order_id: string
      gross_amount: number
    }
    item_details?: any[]
    enabled_payments?: string[]
    callbacks?: { finish?: string }
  }

  interface TransactionResult {
    token: string
    redirect_url: string
  }

  class Snap {
    constructor(options: SnapOptions)
    // Underlying axios instance; used to set X-Override-Notification
    httpClient: { http_client: { defaults: { headers: { common: Record<string, string> } } } }
    createTransaction(params: TransactionDetails): Promise<TransactionResult>
  }

  export default { Snap }
}
