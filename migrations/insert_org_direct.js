(async()=>{
  const { Pool } = require('pg');
  const conn = process.env.NEON_PG_CONN;
  if (!conn) {
    console.error('NEON_PG_CONN not set');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: conn });
  const id = '3fe3d68e-fa5e-c1d7-e958-0a27d6b69b82';
  try {
    await pool.query('INSERT INTO public.organizations(id, name) VALUES($1, $2)', [id, 'Test Org (inserted by debug)']);
    const res = await pool.query('SELECT id,name FROM public.organizations WHERE id=$1', [id]);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
