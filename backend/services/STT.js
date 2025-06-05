const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, '../config/.env') });
const { OpenAI, toFile } = require("openai");

const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function extractFileExtension(filename) {
  return path.extname(filename).slice(1);
}

function readAudioBuffer(filePath) {
  return fs.readFileSync(filePath);
}

async function createOpenAIFile(audioBuffer, filename) {
  const fileExtension = extractFileExtension(filename);
  return await toFile(
    audioBuffer,
    filename,
    { contentType: `audio/${fileExtension}` }
  );
}

async function convertAudioToText(filePath, filename) {
  const audioBuffer = readAudioBuffer(filePath);
  const openaiFile = await createOpenAIFile(audioBuffer, filename);
  
  const transcription = await openaiClient.audio.transcriptions.create({
    model: "whisper-1",
    file: openaiFile
  });
  
  return transcription.text;
}

module.exports = { convertAudioToText };

