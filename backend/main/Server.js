const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../config/.env") });
const express = require("express");
const multer = require("multer");
const fs = require("fs");
const cors = require("cors");

const { storeBase64Image } = require("../storage/handlers/ScreenshotStorageHandler");
const { convertAudioToText } = require("../services/STT");
const { createAudioFile, removeExpiredAudioFiles } = require("../services/TTS");
const { processConversation } = require("../llm/ConversationHandler");
const { registerToolCallback } = require("../tools/ToolExecutor");

const app = express();
const port = process.env.PORT || 3000;
const USE_SERVER_TTS = true;

function ensureDirectoriesExist() {
  fs.mkdirSync(path.join(__dirname, "../storage/data/audioResponse"), { recursive: true });
  fs.mkdirSync(path.join(__dirname, "../storage/data/screenshotImages"), { recursive: true });
}

function initializeTTSCleanup() {
  removeExpiredAudioFiles();
  setInterval(removeExpiredAudioFiles, 2 * 60 * 1000);
}

function configureMiddleware() {
  app.use(cors());
  app.use(express.json());
  app.use("/api/v1/images", express.static(path.join(__dirname, "../storage/data/screenshotImages")));
  app.use("/api/v1/audio", express.static(path.join(__dirname, "../storage/data/audioResponse")));
}

function createMulterConfig() {
  const storage = multer.diskStorage({
    destination: (_, __, cb) => cb(null, path.join(__dirname, "../storage/data/audioResponse")),
    filename: (_, file, cb) => cb(null, `temp-${Date.now()}-${file.originalname}`)
  });
  return multer({ storage });
}

function registerToolCallbacks() {
  registerToolCallback((name, args) => {
    // Tool call registered
  });
}

function validateImageRequest(image) {
  if (!image) {
    throw new Error("missing image");
  }
}

function validateMessagesFormat(messages) {
  const first = messages[0];
  const content = first?.content;
  
  if (!content || !Array.isArray(content)) {
    throw new Error("Invalid messages format");
  }
  
  return content;
}

function parseMultimodalContent(content) {
  return content.map(part => {
    if (part.type === "text") return part.text;
    if (part.type === "image_url") return { image_url: part.image_url.url };
    return null;
  }).filter(Boolean);
}

function mergeContentParts(merged) {
  return merged.reduce((acc, curr) => {
    if (typeof curr === "string") acc.text = curr;
    if (curr && curr.image_url) acc.image_url = curr.image_url;
    return acc;
  }, {});
}

function readImageFile(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    return `data:image/png;base64,${buffer.toString("base64")}`;
  } catch (error) {
    throw new Error(`Screenshot not found: ${path.basename(filePath)}`);
  }
}

function createImagePayload(imageUrl, stock) {  const filename = path.basename(imageUrl);
  const filePath = path.join(__dirname, "../storage/data/screenshotImages", filename);
  const dataUrl = readImageFile(filePath);
  
  return { image: dataUrl, stock };
}

function processAudioInput(file) {
  return convertAudioToText(file.path, file.originalname);
}

function processMultimodalInput(messages, stock) {
  const content = validateMessagesFormat(messages);
  const merged = parseMultimodalContent(content);
  const userPayload = mergeContentParts(merged);
  
  if (stock) userPayload.stock = stock;
  
  return userPayload;
}

function validateUserInput(body) {
  if (!body.text && !body.image && !body.image_url && !Array.isArray(body.messages)) {
    throw new Error("Missing or invalid input");
  }
}

async function determineUserPayload(req) {
  const { body, file } = req;
  
  if (file) {
    return await processAudioInput(file);
  }
  
  if (Array.isArray(body.messages)) {
    return processMultimodalInput(body.messages, body.stock);
  }
  
  if (body.image_url) {
    return createImagePayload(body.image_url, body.stock);
  }
  
  if (body.image) {
    return { image: body.image, stock: body.stock };
  }
  
  if (typeof body.text === "string") {
    return body.text;
  }
  
  validateUserInput(body);
}

async function generateTTSIfEnabled(assistantReply) {
  if (!USE_SERVER_TTS || !assistantReply) {
    return null;  }
    const fileName = `${Date.now()}-VA.mp3`;
  const outputPath = path.join(__dirname, "../storage/data/audioResponse", fileName);
  
  await createAudioFile(assistantReply, outputPath);
  
  return `/api/v1/audio/${fileName}`;
}

function buildResponseEnvelope(userPayload, assistantReply, toolCalls, messages, audioUrl, hasFile) {
  return {
    ...(hasFile && { transcription: userPayload }),
    messages: messages || (assistantReply ? [assistantReply] : []),
    toolCalls: toolCalls || [],
    ...(audioUrl && { audioUrl })
  };
}

function getNetworkIP() {
  const networkInterfaces = require("os").networkInterfaces();
  
  if (networkInterfaces['Wi-Fi']) {
    return networkInterfaces['Wi-Fi'].find(iface => iface.family === 'IPv4')?.address;
  }
  
  return 'localhost';
}

function logServerStart() {
  const ip = getNetworkIP();
  
  console.log('\nServer is running!');
  console.log(`Local:   http://localhost:${port}`);
  console.log(`Network: http://${ip}:${port}\n`);
}

async function handleImageUpload(req, res) {
  try {
    const { image, stock } = req.body;
    validateImageRequest(image);
    
    const image_url = await storeBase64Image(image);
    return res.json({ image_url, stock });
  } catch (error) {
    console.error("[/api/v1/images]", error.message);
    return res.status(400).json({ error: error.message });
  }
}

async function handleConversation(req, res) {
  try {    const userPayload = await determineUserPayload(req);
    const { assistantReply, toolCalls, messages } = await processConversation(userPayload);
    
    const audioUrl = await generateTTSIfEnabled(assistantReply);
    const envelope = buildResponseEnvelope(
      userPayload, assistantReply, toolCalls, messages, audioUrl, !!req.file
    );
    
    return res.json(envelope);
  } catch (error) {
    console.error("[/api/v1/conversations]", error.message);
    return res.status(500).json({ error: "Something went wrong" });
  }
}

function handleDebugLog(req, res) {
  const { level = 'DEBUG', message, data } = req.body;
  const timestamp = new Date().toISOString();
  
  console.log(`[${timestamp}] [${level}] ${message}`);
  if (data) {
    console.log(`[${timestamp}] [DATA]`, JSON.stringify(data, null, 2));
  }
  
  res.json({ success: true });
}

function initializeServer() {
  ensureDirectoriesExist();
  initializeTTSCleanup();
  configureMiddleware();
  registerToolCallbacks();
  
  const upload = createMulterConfig();
  
  app.post("/api/v1/images", handleImageUpload);
  app.post("/api/v1/conversations", upload.single("audio"), handleConversation);
  app.post("/api/v1/debug", express.json(), handleDebugLog);
  
  app.listen(port, '0.0.0.0', logServerStart);
}

initializeServer();
