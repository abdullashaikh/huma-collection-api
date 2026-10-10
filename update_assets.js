const mysql = require('mysql2/promise');

async function updateAssets() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: 'root',
    database: 'huma_collection_db'
  });

  const imageUpdates = [
    { id: 1, url: 'https://images.unsplash.com/photo-1567401893414-76b7b1e5a7a5?auto=format&fit=crop&w=1200&q=85' },
    { id: 2, url: 'https://images.unsplash.com/photo-1567401893414-76b7b1e5a7a5?auto=format&fit=crop&w=1200&q=85' },
    { id: 3, url: 'https://images.unsplash.com/photo-1609357605129-26f69add5d6e?auto=format&fit=crop&w=1200&q=85' },
    { id: 4, url: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=1200&q=85' },
    { id: 5, url: 'https://images.unsplash.com/photo-1574634534894-89d7576c8259?auto=format&fit=crop&w=1200&q=85' },
    { id: 6, url: 'https://images.unsplash.com/photo-1609357605129-26f69add5d6e?auto=format&fit=crop&w=1200&q=85' },
    { id: 7, url: 'https://images.unsplash.com/photo-1547887537-6158d64c35b3?auto=format&fit=crop&w=1200&q=85' },
    { id: 8, url: 'https://images.unsplash.com/photo-1591604129939-f1efa4d9f7fa?auto=format&fit=crop&w=1200&q=85' },
    { id: 9, url: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=1200&q=85' },
    { id: 10, url: 'https://images.unsplash.com/photo-1564769625905-50e93615e769?auto=format&fit=crop&w=1200&q=85' }
  ];

  for (const img of imageUpdates) {
    await conn.query('UPDATE product_images SET s3_url = ? WHERE product_id = ? AND is_primary = 1', [img.url, img.id]);
  }

  // Update non-clothing product fabrics to descriptive values
  await conn.query("UPDATE products SET fabric = 'Pure Non-Alcoholic Oil' WHERE id = 7");
  await conn.query("UPDATE products SET fabric = 'High-Density Memory Foam' WHERE id = 8");
  await conn.query("UPDATE products SET fabric = 'Natural Olive Wood' WHERE id = 9");
  await conn.query("UPDATE products SET fabric = '100% Combed Terry Cotton' WHERE id = 10");

  // Fix Janamaz SKUs so variants are distinguished
  await conn.query("UPDATE product_variants SET sku = 'HHC-JNM-001-STD-GRN' WHERE sku = 'HHC-JNM-001-GRN'");
  await conn.query("UPDATE product_variants SET sku = 'HHC-JNM-001-LRG-NVY' WHERE sku = 'HHC-JNM-001-NVY'");

  console.log('SUCCESS: All images, fabrics, and variant attributes updated in database.');
  await conn.end();
}

updateAssets().catch(err => {
  console.error('Error updating assets:', err);
  process.exit(1);
});
