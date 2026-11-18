const cloudinary = require('cloudinary').v2;

const isConfigured = () => (
  Boolean(
    process.env.CLOUDINARY_CLOUD_NAME
    && process.env.CLOUDINARY_API_KEY
    && process.env.CLOUDINARY_API_SECRET
  )
);

exports.uploadReceipt = (file, userId) => {
  if (!isConfigured()) {
    throw new Error('Receipt storage is not configured. Set the Cloudinary environment variables.');
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });

  return new Promise((resolve, reject) => {
    const upload = cloudinary.uploader.upload_stream(
      { folder: `expense-claims/${userId}`, resource_type: 'auto', use_filename: true },
      (error, result) => {
        if (error) {
          return reject(error);
        }
        return resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    upload.end(file.buffer);
  });
};
