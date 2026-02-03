class Query {
  _res: any
  constructor(res: any = { data: [] }) {
    this._res = res
  }
  order() { return this }
  limit() { return this }
  eq() { return this }
  async single() { return { data: null } }
  then(resolve: any) { return Promise.resolve(this._res).then(resolve) }
}

const supabase = {
  from(table: string) {
    return {
      select(_cols?: string) { return new Query({ data: [] }) }
    }
  }
}

export default supabase
