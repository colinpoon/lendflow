/**
 * Test script for PDF-to-image conversion
 * Run with: node scripts/test-pdf-converter.mjs
 *
 * Tests pdf-to-img directly (the library used by lib/vision/pdf-converter.ts)
 */

import { pdf } from 'pdf-to-img';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 300 DPI = 72 base DPI * 4.17 scale factor
const DEFAULT_SCALE = 4.17;

async function test() {
  const pdfPath = join(__dirname, '../public/financialReports/2023-12-31-Q4-Zedcor-Inc.-Financial-Stmts-vFINAL.pdf');

  console.log('Testing PDF conversion with pdf-to-img library...');
  console.log('PDF path:', pdfPath);

  // Test page count
  console.log('\n1. Testing page count...');
  const docForCount = await pdf(pdfPath, { scale: 1 });
  let pageCount = 0;
  for await (const _ of docForCount) {
    pageCount++;
  }
  console.log('   Page count:', pageCount);

  // Test single page conversion
  console.log('\n2. Testing single page conversion (page 1)...');
  const docForSingle = await pdf(pdfPath, { scale: DEFAULT_SCALE });
  const page1 = await docForSingle.getPage(1);
  console.log(`   Single page buffer size: ${(page1.length / 1024).toFixed(1)} KB`);

  // Test full document conversion
  console.log('\n3. Converting all pages at 300 DPI (scale: ' + DEFAULT_SCALE + ')...');
  const docForAll = await pdf(pdfPath, { scale: DEFAULT_SCALE });
  const results = [];
  let pageNumber = 1;
  for await (const page of docForAll) {
    results.push({
      pageNumber,
      image: Buffer.from(page),
    });
    pageNumber++;
  }
  console.log('   Total pages converted:', results.length);

  // Show all page sizes
  for (const r of results) {
    console.log(`   Page ${r.pageNumber}: ${(r.image.length / 1024).toFixed(1)} KB`);
  }

  // Save first page for visual verification
  writeFileSync('/tmp/test-page-1.png', results[0].image);
  console.log('\n4. Saved test image to /tmp/test-page-1.png');

  // Verify the PNG header
  const pngHeader = results[0].image.slice(0, 8);
  const expectedHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  if (pngHeader.equals(expectedHeader)) {
    console.log('   PNG header verified: valid PNG image');
  } else {
    throw new Error('Invalid PNG header');
  }

  console.log('\n=== Test PASSED: PDF conversion working ===');
}

test().catch(e => {
  console.error('\n=== Test FAILED ===');
  console.error('Error:', e.message);
  console.error(e.stack);
  process.exit(1);
});
