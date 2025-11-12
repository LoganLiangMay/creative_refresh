/**
 * S3 Upload Utility
 * Uploads images to AWS S3 and returns public URLs
 */

const AWS = require('aws-sdk');
const { randomUUID } = require('crypto');
const sharp = require('sharp');

// Configure AWS S3
const s3 = new AWS.S3({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

/**
 * Upload a file to S3
 * @param {Buffer} fileBuffer - The file buffer
 * @param {string} fileName - Original filename
 * @param {string} contentType - MIME type
 * @param {Object} options - Optional settings (folder, metadata)
 * @returns {Promise<string>} - Public S3 URL
 */
async function uploadToS3(fileBuffer, fileName, contentType, options = {}) {
  const { folder = 'rda-ads', metadata = {} } = options;

  // Generate unique key
  const fileExtension = fileName.split('.').pop();
  const uniqueKey = `${folder}/${randomUUID()}-${Date.now()}.${fileExtension}`;

  const params = {
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Key: uniqueKey,
    Body: fileBuffer,
    ContentType: contentType,
    // ACL removed - bucket has ACLs disabled
    // Images will be accessible via bucket policy or signed URLs
    Metadata: {
      ...metadata,
      originalName: fileName,
      uploadedAt: new Date().toISOString(),
    },
  };

  try {
    console.log(`Uploading to S3: ${uniqueKey}`);
    const result = await s3.upload(params).promise();
    console.log(`✅ Uploaded successfully: ${result.Location}`);
    return result.Location;
  } catch (error) {
    console.error('❌ S3 upload error:', error);
    throw new Error(`Failed to upload to S3: ${error.message}`);
  }
}

/**
 * Process and upload an image with specific dimensions
 * Required for Google Ads RDA:
 * - Marketing images: 600x314 min (1.91:1 ratio)
 * - Square images: 300x300 min (1:1 ratio)
 *
 * @param {Buffer} fileBuffer - The image buffer
 * @param {string} fileName - Original filename
 * @param {string} imageType - 'landscape' or 'square'
 * @returns {Promise<Object>} - {url, dimensions}
 */
async function processAndUploadImage(fileBuffer, fileName, imageType) {
  try {
    let processedBuffer;
    let dimensions;

    if (imageType === 'landscape') {
      // Resize to marketing image dimensions (min 600x314)
      // Use 1200x628 for better quality
      processedBuffer = await sharp(fileBuffer)
        .resize(1200, 628, {
          fit: 'cover',
          position: 'center',
        })
        .jpeg({ quality: 90 })
        .toBuffer();

      dimensions = { width: 1200, height: 628 };
    } else if (imageType === 'square') {
      // Resize to square marketing image dimensions (min 300x300)
      // Use 1200x1200 for better quality
      processedBuffer = await sharp(fileBuffer)
        .resize(1200, 1200, {
          fit: 'cover',
          position: 'center',
        })
        .jpeg({ quality: 90 })
        .toBuffer();

      dimensions = { width: 1200, height: 1200 };
    } else {
      throw new Error(`Invalid image type: ${imageType}. Must be 'landscape' or 'square'`);
    }

    const url = await uploadToS3(
      processedBuffer,
      fileName,
      'image/jpeg',
      {
        metadata: {
          imageType,
          dimensions: `${dimensions.width}x${dimensions.height}`,
        },
      }
    );

    return { url, dimensions };
  } catch (error) {
    console.error(`❌ Error processing ${imageType} image:`, error);
    throw new Error(`Failed to process image: ${error.message}`);
  }
}

/**
 * Upload multiple images for RDA
 * Automatically generates both landscape and square versions
 *
 * @param {Array<{buffer: Buffer, name: string}>} images - Array of image objects
 * @returns {Promise<Object>} - {landscapeUrls, squareUrls}
 */
async function uploadImagesForRDA(images) {
  const results = {
    landscape: [],
    square: [],
  };

  for (const image of images) {
    // Create landscape version
    const landscapeResult = await processAndUploadImage(
      image.buffer,
      image.name,
      'landscape'
    );
    results.landscape.push(landscapeResult);

    // Create square version
    const squareResult = await processAndUploadImage(
      image.buffer,
      image.name,
      'square'
    );
    results.square.push(squareResult);
  }

  console.log(`✅ Uploaded ${images.length} images (${results.landscape.length} landscape + ${results.square.length} square)`);

  return results;
}

module.exports = {
  uploadToS3,
  processAndUploadImage,
  uploadImagesForRDA,
};
