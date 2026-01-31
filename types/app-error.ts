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

  constructor(optsOrMessage: AppErrorOptions | string, httpStatus?: number, code?: string, details?: any) {
    // Support both old and new signatures
    if (typeof optsOrMessage === 'string') {
      // Old signature: new AppError(message, httpStatus, code, details)
      super(optsOrMessage)
      
      const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase()
      this.id = `ERR_${datePart}_${randomPart}`
      this.code = code || 'UNKNOWN_ERROR'
      this.user_message = optsOrMessage
      this.severity = 'MEDIUM'
      this.retriable = false
      this.details = details
      this.httpStatus = httpStatus || 500
    } else {
      // New signature: new AppError({ code, message, ... })
      super(optsOrMessage.message)
      
      if (optsOrMessage.id) {
        this.id = optsOrMessage.id
      } else {
        const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '')
        const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase()
        this.id = `ERR_${datePart}_${randomPart}`
      }
      
      this.code = optsOrMessage.code
      this.user_message = optsOrMessage.user_message
      this.severity = optsOrMessage.severity ?? 'MEDIUM'
      this.retriable = !!optsOrMessage.retriable
      this.details = optsOrMessage.details
      
      // Get HTTP status from error catalog
      try {
        const { getErrorDefinition } = require('@/lib/errors/errorCatalog')
        const errorDef = getErrorDefinition(this.code)
        this.httpStatus = errorDef?.httpStatus || 500
      } catch {
        this.httpStatus = 500
      }
    }
  }

  toJSON() {
    return { id: this.id, code: this.code, message: this.message, user_message: this.user_message, severity: this.severity, httpStatus: this.httpStatus }
  }
}

export default AppError
 
