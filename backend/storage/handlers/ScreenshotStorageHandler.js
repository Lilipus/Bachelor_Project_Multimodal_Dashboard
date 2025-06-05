const fs = require('fs');
const path = require('path');

const IMAGES_DIRECTORY = path.join(__dirname, '../data/screenshotImages');
const FILENAME_TEMPLATE = 'latest';

fs.mkdirSync(IMAGES_DIRECTORY, { recursive: true });

function parseBase64Image(base64Data) {
  const matches = base64Data.match(/^data:(.+);base64,(.+)$/);
  if (!matches) throw new Error('Invalid base64 image format');
  
  return {
    mimeType: matches[1],
    imageData: matches[2]
  };
}

function extractFileExtension(mimeType) {
  return mimeType.split('/')[1] || 'png';
}

function createImageBuffer(base64ImageData) {
  return Buffer.from(base64ImageData, 'base64');
}

async function saveImageToFile(imageBuffer, filePath) {
  await fs.promises.writeFile(filePath, imageBuffer);
}

function generatePublicUrl(filename) {
  return `/images/${filename}`;
}

async function storeBase64Image(base64Data) {
  const { mimeType, imageData } = parseBase64Image(base64Data);
  const fileExtension = extractFileExtension(mimeType);
  const filename = `${FILENAME_TEMPLATE}.${fileExtension}`;
  const filePath = path.join(IMAGES_DIRECTORY, filename);
  
  const imageBuffer = createImageBuffer(imageData);
  await saveImageToFile(imageBuffer, filePath);
  
  return generatePublicUrl(filename);
}

module.exports = { storeBase64Image };
