export class AppError extends Error {
  id: string
  code: string
  user_message?: string
  severity: string
  retriable?: boolean
  details?: any

  constructor(opts: { id?: string; code: string; message?: string; user_message?: string; severity?: string; retriable?: boolean; details?: any }) {
    super(opts.message || opts.user_message || opts.code)
    this.id = opts.id || 'err-' + Math.random().toString(36).slice(2, 9)
    this.code = opts.code
    this.user_message = opts.user_message
    this.severity = opts.severity || 'MEDIUM'
    this.retriable = opts.retriable
    this.details = opts.details
  }

  toJSON() {
    return { id: this.id, code: this.code, message: this.message, user_message: this.user_message, severity: this.severity, retriable: this.retriable, details: this.details }
  }
}
