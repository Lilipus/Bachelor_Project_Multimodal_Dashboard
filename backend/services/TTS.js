const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../config/.env') });

const TTS_DIRECTORY = path.join(__dirname, '../storage/data/audioResponse');
const FILE_LIFETIME_MS = 5 * 60 * 1000;
const TIMESTAMP_PATTERN = /^(\d+)-VA\.mp3$/;

function isExpiredFile(filename) {
  const match = filename.match(TIMESTAMP_PATTERN);
  if (!match) return false;
  
  const fileTimestamp = parseInt(match[1]);
  const currentTime = Date.now();
  return currentTime - fileTimestamp > FILE_LIFETIME_MS;
}

function deleteFile(filename) {
  const filePath = path.join(TTS_DIRECTORY, filename);
  fs.unlinkSync(filePath);
}

function removeExpiredAudioFiles() {
  if (!fs.existsSync(TTS_DIRECTORY)) return;
  
  const audioFiles = fs.readdirSync(TTS_DIRECTORY)
    .filter(file => file.endsWith('.mp3'));
  
  audioFiles.forEach(filename => {
    if (isExpiredFile(filename)) {
      deleteFile(filename);
    }
  });
}

async function createAudioFile(text, filePath) {
  const response = await axios.post(
    'https://api.openai.com/v1/audio/speech',
    {
      model: 'tts-1',
      voice: 'nova',
      input: text,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      responseType: 'arraybuffer',
    }
  );
  
  fs.writeFileSync(filePath, response.data);
  removeExpiredAudioFiles();
  
  return filePath;
}

module.exports = { createAudioFile, removeExpiredAudioFiles };

