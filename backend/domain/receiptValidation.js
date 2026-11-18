const maxReceiptSize = 5 * 1024 * 1024;
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

exports.maxReceiptSize = maxReceiptSize;
exports.isSupportedReceiptType = (mimeType) => allowedTypes.has(mimeType);

exports.validateReceiptFile = (file) => {
  if (file.size >= maxReceiptSize) {
    return { valid: false, message: 'Receipt files must be smaller than 5 MB.' };
  }
  if (!allowedTypes.has(file.mimetype)) {
    return { valid: false, message: 'Receipt must be a JPEG, PNG, WebP image, or PDF.' };
  }

  const buffer = file.buffer;
  const validSignature = file.mimetype === 'application/pdf'
    ? buffer.subarray(0, 5).toString() === '%PDF-'
    : file.mimetype === 'image/jpeg'
      ? buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
      : file.mimetype === 'image/png'
        ? buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : buffer.subarray(0, 4).toString() === 'RIFF'
          && buffer.subarray(8, 12).toString() === 'WEBP';

  return validSignature
    ? { valid: true }
    : { valid: false, message: 'The uploaded file does not match its image or PDF type.' };
};
