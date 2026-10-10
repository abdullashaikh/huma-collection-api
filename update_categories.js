const mysql = require('mysql2/promise');

async function updateCategoryImages() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: 'root',
    database: 'huma_collection_db'
  });

  await conn.query("UPDATE product_categories SET image_url = 'https://images.unsplash.com/photo-1609357605129-26f69add5d6e?auto=format&fit=crop&w=800&q=80' WHERE slug = 'niqab'");
  await conn.query("UPDATE product_categories SET image_url = 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=800&q=80' WHERE slug = 'nospice'");
  await conn.query("UPDATE product_categories SET image_url = 'https://images.unsplash.com/photo-1567401893414-76b7b1e5a7a5?auto=format&fit=crop&w=800&q=80' WHERE slug = 'burqa'");
  await conn.query("UPDATE product_categories SET image_url = 'https://images.unsplash.com/photo-1574634534894-89d7576c8259?auto=format&fit=crop&w=800&q=80' WHERE slug = 'hijab'");
  await conn.query("UPDATE product_categories SET image_url = 'https://images.unsplash.com/photo-1591604129939-f1efa4d9f7fa?auto=format&fit=crop&w=800&q=80' WHERE slug = 'janamaz'");
  await conn.query("UPDATE product_categories SET image_url = 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=800&q=80' WHERE slug = 'tasbih'");

  console.log('SUCCESS: Category images updated in database!');
  await conn.end();
}

updateCategoryImages().catch(err => {
  console.error(err);
  process.exit(1);
});
