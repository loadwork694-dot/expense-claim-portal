const test = require('node:test');
const assert = require('node:assert/strict');
const { maxReceiptSize, validateReceiptFile } = require('./receiptValidation');

test('accepts a supported receipt with a matching signature below the size limit', () => {
  const result = validateReceiptFile({
    mimetype: 'application/pdf',
    buffer: Buffer.from('%PDF-1.7'),
    size: maxReceiptSize - 1
  });

  assert.deepEqual(result, { valid: true });
});

test('rejects receipts at the size limit and files with mismatched signatures', () => {
  const oversized = validateReceiptFile({
    mimetype: 'application/pdf',
    buffer: Buffer.from('%PDF-1.7'),
    size: maxReceiptSize
  });
  const mismatched = validateReceiptFile({
    mimetype: 'image/png',
    buffer: Buffer.from('not a PNG'),
    size: 9
  });

  assert.equal(oversized.valid, false);
  assert.match(oversized.message, /smaller than 5 MB/);
  assert.equal(mismatched.valid, false);
  assert.match(mismatched.message, /does not match/);
});
