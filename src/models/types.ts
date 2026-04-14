export interface Recipient {
  id: number
  name: string
}

export interface IBAN {
  id: number
  iban: string
  recipient_id: number
}

export interface Payment {
  id: number
  amount: number
  reference: string | null
  created_at: string
  iban_id: number
}
