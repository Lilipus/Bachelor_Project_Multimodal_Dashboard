// public/scripts/MainScreenBindings.js
import { chat } from './ChatService.js';
import config from './ApiClient.js';

async function debugLog(level, message, data = null) {
  logToConsole(level, message, data);
  
  try {
    await sendLogToServer(level, message, data);
  } catch (err) {
    console.error('[debugLog] Failed to send log to server:', err);
  }
}

function logToConsole(level, message, data) {
  console.log(`[${level}] ${message}`, data || '');
}

async function sendLogToServer(level, message, data) {
  await config.initialize();
  await fetch(config.getApiUrl('/debug'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ level, message, data })
  });
}

const CONFIG = {
  USE_SERVER_TTS: true,
  SESSION_DURATION: 15000,
  STT_RESTART_DELAY: 500,
  SEND_BUTTON_PADDING: { WITH_BUTTON: '48px', WITHOUT_BUTTON: '8px' },  SAFARI_AUDIO_FIX: true
};

debugLog('INFO', '[INIT] MainScreenBindings module loaded', {
  userAgent: navigator.userAgent
});

const input = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-button');
const roboBtn = document.getElementById('robo-button');

function updateSendButtonVisibility() {
  const hasText = input.value.trim().length > 0;
  
  toggleSendButtonDisplay(hasText);
  adjustInputPadding(hasText);
}

function toggleSendButtonDisplay(isVisible) {
  sendBtn.classList.toggle('visible', isVisible);
}

function adjustInputPadding(hasButton) {
  const padding = hasButton 
    ? CONFIG.SEND_BUTTON_PADDING.WITH_BUTTON 
    : CONFIG.SEND_BUTTON_PADDING.WITHOUT_BUTTON;
  input.style.paddingRight = padding;
}

input.addEventListener('input', updateSendButtonVisibility);
input.addEventListener('keyup', updateSendButtonVisibility);
input.addEventListener('paste', () => {
  setTimeout(updateSendButtonVisibility, 10);
});
// Initialize correct padding on page load
updateSendButtonVisibility();

input.addEventListener('keypress', async (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    await sendTextMessage();
  }
});

const state = {
  recognition: null,
  lastTTSEndTime: 0,
  audioContextInitialized: false,
  speechSessionActive: false,
  sessionTimeout: null,
  accumulatedTranscript: '',
  buttonClickInProgress: false,
  userInteractionActive: false,
  mediaStream: null,
  recognitionStoppedManually: false
};

chat.onMessage(msg => {
  addMessage(msg, 'bot');
});

if (CONFIG.USE_SERVER_TTS) {
  chat.onAudio(url => {
    debugLog('INFO', '[TTS] Server TTS URL received', { url, speechSessionActive: state.speechSessionActive });
    playServerTTS(url).catch(err => debugLog('ERROR', '[TTS] Error playing server TTS', { error: err.message }));
  });
}

async function playServerTTS(url) {
  await config.initialize();
  const audioSrc = buildAudioSrc(url);
  debugLog('INFO', '[TTS] Playing TTS audio with Howler.js', { 
    src: audioSrc, 
    userInteractionActive: state.userInteractionActive
  });
  
  const sound = createHowlerSound(audioSrc);
  
  try {
    sound.play();
    debugLog('INFO', '[TTS] Howler audio play initiated successfully');
  } catch (err) {
    debugLog('WARN', '[TTS] Howler audio play failed, setting up user interaction recovery', { error: err.message });
    setupHowlerErrorRecovery(sound, audioSrc);
  }
}

function buildAudioSrc(url) {
  return url.startsWith('http') ? url : config.getServerUrl(url);
}

function createHowlerSound(src) {
  return new Howl({
    src: [src],
    volume: 1.0,
    preload: true,
    html5: true,
    onplay: function() {
      debugLog('INFO', '[TTS] Howler audio started playing', { 
        volume: this.volume(),
        duration: this.duration()
      });
    },
    onend: function() {
      debugLog('INFO', '[TTS] Howler audio finished playing');
      state.lastTTSEndTime = Date.now();
      this.unload();
    },
    onloaderror: (id, error) => {
      debugLog('ERROR', '[TTS] Howler audio load error', { error });
      setupHowlerErrorRecovery(sound, src);
    },
    onplayerror: (id, error) => {
      debugLog('ERROR', '[TTS] Howler audio play error', { error });
      setupHowlerErrorRecovery(sound, src);
    }
  });
}

function setupHowlerErrorRecovery(sound, src) {
  let hasRetried = false;
  
  const enableAudio = createAudioRetryHandler(sound, () => {
    hasRetried = true;
    cleanupListeners();
  });
  
  const cleanupListeners = createListenerCleanup(enableAudio);
  
  attachUserInteractionListeners(enableAudio);
  scheduleRecoveryTimeout(hasRetried, cleanupListeners);
}

function createAudioRetryHandler(sound, onRetryComplete) {
  let hasRetried = false;
  
  return async () => {
    if (hasRetried) return;
    hasRetried = true;
    
    try {
      debugLog('INFO', '[TTS] Retrying Howler audio playback after user interaction');
      sound.play();
      debugLog('INFO', '[TTS] Howler audio played successfully after user interaction');
    } catch (retryErr) {
      debugLog('ERROR', '[TTS] Failed to play Howler audio even after user interaction', { error: retryErr.message });
    }
    
    onRetryComplete();
  };
}

function createListenerCleanup(enableAudio) {
  return () => {
    document.removeEventListener('click', enableAudio);
    document.removeEventListener('touchstart', enableAudio);
    document.removeEventListener('keydown', enableAudio);
    if (roboBtn) {
      roboBtn.removeEventListener('click', enableAudio);
    }
  };
}

function attachUserInteractionListeners(enableAudio) {
  const listenerOptions = { once: true, passive: true };
  
  document.addEventListener('click', enableAudio, listenerOptions);
  document.addEventListener('touchstart', enableAudio, listenerOptions);
  document.addEventListener('keydown', enableAudio, listenerOptions);
  
  if (roboBtn) {
    roboBtn.addEventListener('click', enableAudio, listenerOptions);
  }
}

function scheduleRecoveryTimeout(hasRetried, cleanupListeners) {
  const RECOVERY_TIMEOUT_MS = 30000;
  
  setTimeout(() => {
    if (!hasRetried) {
      debugLog('WARN', '[TTS] No user interaction for 30s, cleaning up');
      cleanupListeners();
    }
  }, RECOVERY_TIMEOUT_MS);
}

const toolHandlers = {
  'select_stock': ({ stock }) => {
    debugLog('INFO', '[TOOL] select_stock called', { stock });
    document.querySelector(`.stock-item-selection[data-label="${stock}"]`)?.click();
  },
  'open_training_area': async () => {
    debugLog('INFO', '[TOOL] open_training_area called');
    try {
      await window.showTrainingArea();
      debugLog('INFO', '[TOOL] showTrainingArea() completed successfully');
    } catch (error) {
      debugLog('ERROR', '[TOOL] showTrainingArea() failed', { error: error.message });
    }
  },
  'exit_training_area': () => {
    debugLog('INFO', '[TOOL] exit_training_area called');
    window.showMainArea();
  },
  'toggle_actual_data': () => {
    debugLog('INFO', '[TOOL] toggle_actual_data called');
    window.toggleActualData();
  },
  'delete_data_points': () => {
    debugLog('INFO', '[TOOL] delete_data_points called');
    window.clearAllPredictionPoints();
  },
  'take_screenshot': () => {
    debugLog('INFO', '[TOOL] take_screenshot');
    document.getElementById('lasso-capture').click();
  }
};

Object.entries(toolHandlers).forEach(([toolName, handler]) => {
  chat.onTool(toolName, handler);
});

async function sendTextMessage() {
  const text = input.value.trim();
  if (!text) return;
  
  addMessage(text, 'user');
  clearInputAndUpdateButton();
  await chat.sendText(text);
}

function clearInputAndUpdateButton() {
  input.value = '';
  updateSendButtonVisibility();
}

sendBtn.addEventListener('click', async (e) => {
  e.preventDefault();
  e.stopPropagation();
  await sendTextMessage();
});

sendBtn.addEventListener('touchend', async (e) => {
  e.preventDefault();
  e.stopPropagation();
  await sendTextMessage();
});

input.addEventListener('keypress', async (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    await sendTextMessage();
  }
});

async function handleRobotButtonClick() {
  if (state.buttonClickInProgress) {
    debugLog('WARN', '[ROBO] Button click ignored - operation in progress');
    return;
  }
  
  state.buttonClickInProgress = true;
  
  try {
    debugLog('INFO', '[ROBO] Tap-to-activate button clicked', { 
      speechSessionActive: state.speechSessionActive,
      accumulatedTranscript: state.accumulatedTranscript.trim()
    });
    
    state.userInteractionActive = true;
    
    if (state.speechSessionActive) {
      await handleStopSessionRequest();
      return;
    }
    
    initializeAudioContextIfNeeded();
    startSpeechSession();
    state.userInteractionActive = false;
    
  } finally {
    setTimeout(() => {
      state.buttonClickInProgress = false;
    }, 200);
  }
}

async function handleStopSessionRequest() {
  debugLog('INFO', '[SESSION] User tapped to stop session and send audio');
  await stopSpeechSessionAndSend();
  
  setTimeout(() => {
    state.userInteractionActive = false;
    debugLog('INFO', '[ROBO] User interaction window expired');
  }, 5000);
}

function initializeAudioContextIfNeeded() {
  if (!state.audioContextInitialized) {
    state.audioContextInitialized = true;
    debugLog('INFO', '[ROBO] Howler.js will handle audio automatically');
  }
}

roboBtn.addEventListener('click', handleRobotButtonClick);

function startSpeechSession() {
  debugLog('INFO', '[SESSION] Starting speech session - tap again to send');
  
  clearExistingSessionTimeout();
  resetSessionState();
  setSessionActiveVisualState();
  
  startSessionSTT();
  scheduleSessionTimeout();
}

function clearExistingSessionTimeout() {
  if (state.sessionTimeout) {
    clearTimeout(state.sessionTimeout);
  }
}

function resetSessionState() {
  state.accumulatedTranscript = '';
  state.speechSessionActive = true;
  state.recognitionStoppedManually = false;
}

function setSessionActiveVisualState() {
  roboBtn.setAttribute('aria-pressed', 'true');
  roboBtn.style.backgroundColor = '#ff4444';
}

function scheduleSessionTimeout() {
  state.sessionTimeout = setTimeout(async () => {
    debugLog('INFO', '[SESSION] 15-second timeout reached, auto-sending speech');
    await stopSpeechSessionAndSend();
  }, CONFIG.SESSION_DURATION);
}

function stopSpeechSession(shouldClearTranscript = true) {
  debugLog('INFO', '[SESSION] Stopping speech session without sending', { clearTranscript: shouldClearTranscript });
  
  state.speechSessionActive = false;
  state.recognitionStoppedManually = true;
  
  clearSessionTimeout();
  setSessionInactiveVisualState();
  stopSessionSTT();
  
  if (shouldClearTranscript) {
    scheduleTranscriptCleanup();
  }
}

function clearSessionTimeout() {
  if (state.sessionTimeout) {
    clearTimeout(state.sessionTimeout);
    state.sessionTimeout = null;
  }
}

function setSessionInactiveVisualState() {
  roboBtn.setAttribute('aria-pressed', 'false');
  roboBtn.style.backgroundColor = '';
}

function scheduleTranscriptCleanup() {
  setTimeout(() => {
    state.accumulatedTranscript = '';
    debugLog('INFO', '[SESSION] Cleared accumulated transcript for next session');
  }, 200);
}

async function stopSpeechSessionAndSend() {
  const currentTranscript = state.accumulatedTranscript.trim();
  debugLog('INFO', '[SESSION] Stopping speech session and sending transcript', { currentTranscript });
  
  // Mark recognition as manually stopped to prevent restart
  state.recognitionStoppedManually = true;
  
  await stopRecognitionSafely();
  await waitForRecognitionToSettle();
  
  stopSpeechSession(false);
  
  const finalTranscript = captureAndClearTranscript();
  await sendTranscriptIfPresent(finalTranscript);
}

async function stopRecognitionSafely() {
  if (!state.recognition) return;
  
  try {
    state.recognition.stop();
  } catch (error) {
    debugLog('ERROR', '[SESSION] Error stopping recognition', { error: error.message });
  }
}

async function waitForRecognitionToSettle() {
  await new Promise(resolve => setTimeout(resolve, 500));
}

function captureAndClearTranscript() {
  const transcript = state.accumulatedTranscript.trim();
  state.accumulatedTranscript = '';
  debugLog('INFO', '[SESSION] Cleared accumulated transcript after capture');
  return transcript;
}

async function sendTranscriptIfPresent(transcript) {
  if (transcript) {
    debugLog('INFO', '[SESSION] Sending accumulated transcript', { transcript });
    addMessage(transcript, 'user');
    await chat.sendText(transcript);
  } else {
    debugLog('WARN', '[SESSION] No speech detected during session');
    addMessage('No speech detected', 'user');
  }
}

async function startSessionSTT() {
  debugLog('INFO', '[SESSION-STT] Starting session-based speech recognition', {
    speechSessionActive: state.speechSessionActive,
    recognitionExists: !!state.recognition
  });
  
  if (!isSpeechRecognitionSupported()) {
    stopSpeechSession();
    return;
  }
  
  await setupAudioSession();
  cleanupExistingRecognition();
  createAndConfigureRecognition();
  
  try {
    state.recognition.start();
  } catch (error) {
    debugLog('ERROR', '[SESSION-STT] Error starting session recognition', { error: error.message });
    stopSpeechSession();
  }
}

function isSpeechRecognitionSupported() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    debugLog('ERROR', '[SESSION-STT] Speech recognition not supported');
    return false;
  }
  return true;
}

async function setupAudioSession() {
  try {
    await configureIOSAudioSession();
    await requestMicrophoneAccess();
  } catch (err) {
    debugLog('WARN', '[SESSION-STT] Could not optimize audio configuration', { error: err.message });
  }
}

async function configureIOSAudioSession() {
  if (navigator.audioSession && navigator.audioSession.type) {
    navigator.audioSession.type = 'play-and-record';
    debugLog('INFO', '[SESSION-STT] Set iOS audio session to play-and-record before mic capture');
  }
}

async function requestMicrophoneAccess() {
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      audio: { echoCancellation: false },
    });
    debugLog('INFO', '[SESSION-STT] Microphone access granted with echo cancellation disabled');
    
    if (state.mediaStream) {
      state.mediaStream.getTracks().forEach(track => track.stop());
    }
    state.mediaStream = stream;
  }
}

function cleanupExistingRecognition() {
  if (state.recognition) {
    try {
      state.recognition.abort();
      state.recognition = null;
    } catch (e) {
      debugLog('WARN', '[SESSION-STT] Cleanup error (expected)', { error: e.message });
    }
  }
}

function createAndConfigureRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  state.recognition = new SpeechRecognition();
  state.recognition.continuous = true;
  state.recognition.interimResults = true;
  state.recognition.lang = 'en-US';
  
  setupRecognitionEventHandlers();
}

function setupRecognitionEventHandlers() {
  state.recognition.onresult = handleRecognitionResult;
  state.recognition.onerror = handleRecognitionError;
  state.recognition.onend = handleRecognitionEnd;
  state.recognition.onstart = handleRecognitionStart;
}

function handleRecognitionResult(event) {
  debugLog('INFO', '[SESSION-STT] Recognition result event received', {
  resultIndex: event.resultIndex,
    resultsLength: event.results.length,
    speechSessionActive: state.speechSessionActive
  });
  
  const { newTranscript, hasInterimResults } = processRecognitionResults(event);
  
  if (newTranscript.trim()) {
    state.accumulatedTranscript += newTranscript;
    debugLog('INFO', '[SESSION-STT] Accumulated transcript', { 
      newTranscript: newTranscript.trim(),
      totalAccumulated: state.accumulatedTranscript.trim()
    });
  }
  
  if (!state.speechSessionActive) {
    debugLog('WARN', '[SESSION-STT] Processing result after session stopped', {
      finalTranscript: newTranscript.trim(),
      hasInterim: hasInterimResults
    });
  }
}

function processRecognitionResults(event) {
  let newTranscript = '';
  let hasInterimResults = false;
  
  for (let i = event.resultIndex; i < event.results.length; i++) {
    const result = event.results[i];
    const transcript = result[0].transcript.trim();
    
    debugLog('INFO', '[SESSION-STT] Processing result', {
      index: i,
      isFinal: result.isFinal,
      transcript: transcript,
      confidence: result[0].confidence
    });
    
    if (result.isFinal && transcript) {
      newTranscript += transcript + ' ';
      debugLog('INFO', '[SESSION-STT] Final transcript captured', { transcript });
    } else if (!result.isFinal && transcript) {
      hasInterimResults = true;
      debugLog('INFO', '[SESSION-STT] Interim result', { transcript });
    }
  }
    return { newTranscript, hasInterimResults };
}

function handleRecognitionError(event) {
  debugLog('ERROR', '[SESSION-STT] Recognition error', { 
    error: event.error,
    speechSessionActive: state.speechSessionActive
  });
  
  if (event.error === 'not-allowed') {
    debugLog('ERROR', '[SESSION-STT] Microphone permission denied');
    stopSpeechSession();
  } else if (event.error === 'network' || event.error === 'service-not-allowed') {
    debugLog('WARN', '[SESSION-STT] Network/service error');
    stopSpeechSession();
  } else if (event.error === 'aborted') {
    debugLog('INFO', '[SESSION-STT] Recognition aborted (expected when stopping session)');
  } else if (event.error === 'no-speech') {
    debugLog('INFO', '[SESSION-STT] No speech detected, continuing to listen');
  } else {
    debugLog('WARN', '[SESSION-STT] Other error in session', { error: event.error });
  }
}

function handleRecognitionEnd() {
  debugLog('INFO', '[SESSION-STT] Recognition ended', { 
    speechSessionActive: state.speechSessionActive
  });
  
  // Only restart if session is still active AND recognition wasn't manually stopped
  if (state.speechSessionActive && !state.recognitionStoppedManually) {
    debugLog('INFO', '[SESSION-STT] Restarting recognition within active session');
    setTimeout(() => {
      if (state.speechSessionActive && !state.recognitionStoppedManually) {
        startSessionSTT();
      }
    }, CONFIG.STT_RESTART_DELAY);
  }
}

function handleRecognitionStart() {
  debugLog('INFO', '[SESSION-STT] Session recognition started successfully');
}

function stopSessionSTT() {
  debugLog('INFO', '[SESSION-STT] Stopping session-based speech recognition');
  
  stopRecognitionInstance();
  cleanupMediaStream();
}

function stopRecognitionInstance() {
  if (!state.recognition) return;
  
  try {
    state.recognition.stop();
  } catch (error) {
    debugLog('ERROR', '[SESSION-STT] Error stopping session recognition', { error: error.message });
  }
  
  setTimeout(() => {
    state.recognition = null;
  }, 50);
}

function cleanupMediaStream() {
  if (!state.mediaStream) return;
  
  try {
    state.mediaStream.getTracks().forEach(track => {
      track.stop();
      debugLog('INFO', '[SESSION-STT] Stopped media track', { kind: track.kind });
    });
    state.mediaStream = null;
    debugLog('INFO', '[SESSION-STT] Media stream cleaned up');
    
    restoreIOSAudioSession();
  } catch (error) {
    debugLog('ERROR', '[SESSION-STT] Error cleaning up media stream', { error: error.message });
  }
}

function restoreIOSAudioSession() {
  if (navigator.audioSession && navigator.audioSession.type) {
    navigator.audioSession.type = 'playback';
    debugLog('INFO', '[SESSION-STT] Set iOS audio session back to playback after mic capture');
  }
}

export async function sendImageData(imageDataUrl, userText = '') {
  addMessage(imageDataUrl, 'image');

  const payload = createImagePayload(imageDataUrl, userText);
  await chat.sendImage(imageDataUrl, userText.trim(), window.selectedStock || undefined);
}

function createImagePayload(imageDataUrl, userText) {
  return {
    base64Image: imageDataUrl,
    text: userText.trim(),
    stock: window.selectedStock || undefined
  };
}

window.sendImageData = sendImageData;

const messageUtils = {
  createUserIcon() {
    const icon = document.createElement('i');
    icon.classList.add('user-icon');
    icon.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-user"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>';
    return icon;
  },

  createBotIcon() {
    const icon = document.createElement('i');
    icon.classList.add('response-icon');
    icon.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-bot"><path d="M12 8V4H8"></path><rect width="16" height="12" x="4" y="8" rx="2"></rect><path d="M2 14h2"></path><path d="M20 14h2"></path><path d="M15 13v2"></path><path d="M9 13v2"></path></svg>';
    return icon;
  },

  createMessageBubble(message, isUserImage, isUser) {
    const bubble = document.createElement(isUserImage ? 'img' : 'div');
    bubble.className = isUser ? 'user-message' : 'response-message';
    
    if (isUserImage) {
      bubble.src = message;
      bubble.classList.add('image');
    } else {
      bubble.textContent = message;
      bubble.classList.add('message');
    }
    
    return bubble;
  }
};

function addMessage(message, type = 'user') {
  const chatContainer = document.getElementById('chatty-daddy-chat');
  if (!chatContainer) {
    console.warn('[addMessage] Chat container not found');
    return;
  }
  
  const messageData = createMessageData(message, type);
  const messageElement = createMessageElement(messageData);
  
  appendMessageToChat(chatContainer, messageElement);
}

function createMessageData(message, type) {
  const isUserImage = type === 'image';
  const isUser = type === 'user' || isUserImage;
  
  return { message, isUserImage, isUser };
}

function createMessageElement({ message, isUserImage, isUser }) {
  const wrapper = document.createElement('li');
  wrapper.className = 'message-wrapper';
  
  const icon = isUser ? messageUtils.createUserIcon() : messageUtils.createBotIcon();
  const bubble = messageUtils.createMessageBubble(message, isUserImage, isUser);
  
  if (isUser) {
    wrapper.append(bubble, icon);
    wrapper.classList.add('user-wrapper');
  } else {
    wrapper.append(icon, bubble);
    wrapper.classList.add('ai-wrapper');
  }
  
  return wrapper;
}

function appendMessageToChat(chatContainer, messageElement) {
  chatContainer.appendChild(messageElement);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}