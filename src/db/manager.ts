import type { SqlJsStatic, Database } from 'sql.js'
import { SCHEMA_SQL } from './schema'
import { loadDb, saveDb } from './persistence'
import type { Recipient, IBAN, Payment } from '../models/types'

export class DatabaseManager {
  private db: Database

  private constructor(db: Database) {
    this.db = db
  }

  static async create(SQL: SqlJsStatic): Promise<DatabaseManager> {
    const stored = await loadDb()
    const db = stored ? new SQL.Database(stored) : new SQL.Database()
    const manager = new DatabaseManager(db)
    if (!stored) {
      manager.db.run(SCHEMA_SQL)
      await manager.persist()
    } else {
      // Ensure foreign keys are on for existing db
      manager.db.run('PRAGMA foreign_keys = ON')
    }
    return manager
  }

  private async persist(): Promise<void> {
    await saveDb(this.db.export())
  }

  // -- Recipients --

  getRecipients(query = ''): Recipient[] {
    const sql = query
      ? 'SELECT id, name FROM recipients WHERE name LIKE ? ORDER BY name'
      : 'SELECT id, name FROM recipients ORDER BY name'
    const result = query
      ? this.db.exec(sql, [`%${query}%`])
      : this.db.exec(sql)
    if (!result.length) return []
    return result[0].values.map(([id, name]) => ({
      id: id as number,
      name: name as string,
    }))
  }

  async addRecipient(name: string): Promise<number> {
    this.db.run('INSERT INTO recipients (name) VALUES (?)', [name])
    const result = this.db.exec('SELECT last_insert_rowid()')
    const id = result[0].values[0][0] as number
    await this.persist()
    return id
  }

  async deleteRecipient(id: number): Promise<void> {
    this.db.run('PRAGMA foreign_keys = ON')
    this.db.run('DELETE FROM recipients WHERE id = ?', [id])
    await this.persist()
  }

  // -- IBANs --

  getIbansForRecipient(recipientId: number): IBAN[] {
    const result = this.db.exec(
      'SELECT id, iban, recipient_id FROM ibans WHERE recipient_id = ? ORDER BY id',
      [recipientId]
    )
    if (!result.length) return []
    return result[0].values.map(([id, iban, recipient_id]) => ({
      id: id as number,
      iban: iban as string,
      recipient_id: recipient_id as number,
    }))
  }

  async addIban(iban: string, recipientId: number): Promise<number> {
    this.db.run('INSERT INTO ibans (iban, recipient_id) VALUES (?, ?)', [iban, recipientId])
    const result = this.db.exec('SELECT last_insert_rowid()')
    const id = result[0].values[0][0] as number
    await this.persist()
    return id
  }

  async deleteIban(id: number): Promise<void> {
    this.db.run('PRAGMA foreign_keys = ON')
    this.db.run('DELETE FROM ibans WHERE id = ?', [id])
    await this.persist()
  }

  // -- Payments --

  getPaymentsForIban(ibanId: number): Payment[] {
    const result = this.db.exec(
      'SELECT id, amount, reference, created_at, iban_id FROM payments WHERE iban_id = ? ORDER BY created_at DESC',
      [ibanId]
    )
    if (!result.length) return []
    return result[0].values.map(([id, amount, reference, created_at, iban_id]) => ({
      id: id as number,
      amount: amount as number,
      reference: reference as string | null,
      created_at: created_at as string,
      iban_id: iban_id as number,
    }))
  }

  async addPayment(amount: number, reference: string, ibanId: number): Promise<number> {
    this.db.run(
      'INSERT INTO payments (amount, reference, iban_id) VALUES (?, ?, ?)',
      [amount, reference || null, ibanId]
    )
    const result = this.db.exec('SELECT last_insert_rowid()')
    const id = result[0].values[0][0] as number
    await this.persist()
    return id
  }

  async deletePayment(id: number): Promise<void> {
    this.db.run('DELETE FROM payments WHERE id = ?', [id])
    await this.persist()
  }

  // -- Export / Import --

  exportBinary(): Uint8Array {
    return this.db.export()
  }

  async importBinary(data: Uint8Array): Promise<void> {
    this.db.close()
    const SQL = (this.db as unknown as { _SQL: SqlJsStatic })._SQL
    this.db = new SQL.Database(data)
    this.db.run('PRAGMA foreign_keys = ON')
    await this.persist()
  }
}
