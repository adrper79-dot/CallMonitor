export type AppErrorOptions = {
  id?: string
  code: string
  message: string
  user_message?: string
  severity?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  retriable?: boolean
  details?: any
}

export class AppError extends Error {
  id: string
  code: string
  user_message?: string
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  retriable: boolean
  details: any
  httpStatus: number

  constructor(opts: AppErrorOptions) {
    super(opts.message)
    this.id = opts.id ?? 'err_' + Math.random().toString(36).slice(2, 9)
    this.code = opts.code
    this.user_message = opts.user_message
    this.severity = opts.severity ?? 'MEDIUM'
    this.retriable = !!opts.retriable
    this.details = opts.details
    
    // Get HTTP status from error catalog
    try {
      const { getErrorDefinition } = require('@/lib/errors/errorCatalog')
      const errorDef = getErrorDefinition(this.code)
      this.httpStatus = errorDef?.httpStatus || 500
    } catch {
      this.httpStatus = 500
    }
  }

  toJSON() {
    return { id: this.id, code: this.code, message: this.message, user_message: this.user_message, severity: this.severity, httpStatus: this.httpStatus }
  }
}

export default AppError
 
