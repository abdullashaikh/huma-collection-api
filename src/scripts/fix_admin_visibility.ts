import { pool } from '../config/database';

async function fixAdminVisibility() {
  console.log('====================================================');
  console.log(' Fixing Image URLs, Category Mappings & Admin Queries');
  console.log('====================================================\n');

  // 1. Update any localhost image URLs to https://api.humacollection.in
  const [updateImgRes]: any = await pool.query(
    "UPDATE product_images SET s3_url = REPLACE(s3_url, 'http://localhost:5000', 'https://api.humacollection.in') WHERE s3_url LIKE 'http://localhost:5000%'"
  );
  console.log(`✓ Updated ${updateImgRes.affectedRows} product_images rows from localhost to https://api.humacollection.in`);

  // 2. Also ensure category_images if any
  const [updateCatImgRes]: any = await pool.query(
    "UPDATE product_categories SET image_url = REPLACE(image_url, 'http://localhost:5000', 'https://api.humacollection.in') WHERE image_url LIKE 'http://localhost:5000%'"
  );
  console.log(`✓ Updated ${updateCatImgRes.affectedRows} product_categories image rows to https://api.humacollection.in`);

  // 3. Check sample image rows
  const [sampleImgs]: any = await pool.query(
    'SELECT id, product_id, s3_url FROM product_images WHERE product_id >= 28 LIMIT 3'
  );
  console.log('\nSample updated product image URLs:');
  console.log(sampleImgs);

  console.log('\nFinished fix script successfully.');
}

fixAdminVisibility()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
