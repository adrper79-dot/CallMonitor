(async()=>{
  const { Pool } = require('pg');
  const conn = process.env.NEON_PG_CONN;
  if (!conn) {
    console.error('NEON_PG_CONN not set');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: conn });
  const id = '00000000-0000-0000-0000-000000000001';
  try {
    const r = await pool.query('SELECT id FROM public.organizations WHERE id=$1', [id]);
    if (r.rowCount === 0) {
      await pool.query('INSERT INTO public.organizations(id,name) VALUES($1,$2)', [id, 'Test Org fixed']);
      console.log('inserted fixed org');
    } else {
      console.log('fixed org exists');
    }
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
