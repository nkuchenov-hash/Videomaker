const state = {
  slides: [],
  selectedIndex: -1,
  selectedIds: new Set(),
  lastSelectionAnchor: -1,
  audioFile: null,
  audioUrl: null,
  audioDuration: 0,
  playing: false,
  playStartedAt: 0,
  previewTimeOffset: 0,
  raf: null,
  activeVideoId: null,
  aiAutoForNew: true,
  faceDetectorReady: false,
  positionEditMode: 'start',
  draggingPreview: false,
  lastPointerX: 0,
  lastPointerY: 0,
  isExporting: false,
  exportBlurCache: new Map(),
  exportStatusLastAt: 0,
};

const $ = (id) => document.getElementById(id);
const els = {
  mediaInput: $('mediaInput'), audioInput: $('audioInput'), dropzone: $('dropzone'),
  mediaCount: $('mediaCount'), audioDuration: $('audioDuration'), totalDuration: $('totalDuration'),
  fitToMusicBtn: $('fitToMusicBtn'), clearBtn: $('clearBtn'), slideList: $('slideList'),
  previewCanvas: $('previewCanvas'), canvasWrap: $('canvasWrap'), emptyState: $('emptyState'), currentInfo: $('currentInfo'),
  playBtn: $('playBtn'), stopBtn: $('stopBtn'), previewProgress: $('previewProgress'), timeLabel: $('timeLabel'),
  panX: $('panX'), panY: $('panY'), zoomStart: $('zoomStart'), zoomEnd: $('zoomEnd'), duration: $('duration'),
  panXValue: $('panXValue'), panYValue: $('panYValue'), zoomStartValue: $('zoomStartValue'), zoomEndValue: $('zoomEndValue'), durationValue: $('durationValue'),
  backgroundMode: $('backgroundMode'), resetSlideBtn: $('resetSlideBtn'),
  fitWholeBtn: $('fitWholeBtn'), coverBtn: $('coverBtn'), softZoomBtn: $('softZoomBtn'), videoHint: $('videoHint'),
  formatSelect: $('formatSelect'), customSizeBox: $('customSizeBox'), customWidth: $('customWidth'), customHeight: $('customHeight'), fpsSelect: $('fpsSelect'), exportPreset: $('exportPreset'), exportBtn: $('exportBtn'), mp4VideoBtn: $('mp4VideoBtn'), mp4PackageBtn: $('mp4PackageBtn'),
  exportProgress: $('exportProgress'), exportStatusText: $('exportStatusText'), audioPreview: $('audioPreview'),
  selectedCount: $('selectedCount'), selectAllBtn: $('selectAllBtn'), deleteSelectedBtn: $('deleteSelectedBtn'),
  saveProjectBtn: $('saveProjectBtn'), loadProjectBtn: $('loadProjectBtn'), deleteSavedProjectBtn: $('deleteSavedProjectBtn'), projectStatus: $('projectStatus'),
  clipScrubberBox: $('clipScrubberBox'), clipScrub: $('clipScrub'), clipScrubLabel: $('clipScrubLabel'),
  clipStartBtn: $('clipStartBtn'), clipEndBtn: $('clipEndBtn'),
  positionStartBtn: $('positionStartBtn'), positionEndBtn: $('positionEndBtn'), previewEditHint: $('previewEditHint'),
  aiSelectedBtn: $('aiSelectedBtn'), aiAllBtn: $('aiAllBtn'), verticalBgBtn: $('verticalBgBtn'),
  aiAutoForNew: $('aiAutoForNew'), aiStatus: $('aiStatus'),
  captionText: $('captionText'), captionX: $('captionX'), captionY: $('captionY'), captionSize: $('captionSize'),
  captionOpacity: $('captionOpacity'), captionColor: $('captionColor'), captionBgMode: $('captionBgMode'), captionBgOpacity: $('captionBgOpacity'), darken: $('darken'),
  captionXValue: $('captionXValue'), captionYValue: $('captionYValue'), captionSizeValue: $('captionSizeValue'), captionOpacityValue: $('captionOpacityValue'), captionBgOpacityValue: $('captionBgOpacityValue'), darkenValue: $('darkenValue'),
};
const previewCtx = els.previewCanvas.getContext('2d');

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function totalDuration() {
  return state.slides.reduce((sum, slide) => sum + Number(slide.duration || 0), 0);
}

function ease(t) {
  return t * t * (3 - 2 * t);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function selectedSlide() {
  return state.slides[state.selectedIndex] || null;
}

function normalizeSlideFrameData(slide) {
  if (!slide) return null;
  const oldX = Number(slide.panX || 0);
  const oldY = Number(slide.panY || 0);
  if (!Number.isFinite(Number(slide.panStartX))) slide.panStartX = oldX;
  if (!Number.isFinite(Number(slide.panStartY))) slide.panStartY = oldY;
  if (!Number.isFinite(Number(slide.panEndX))) slide.panEndX = oldX;
  if (!Number.isFinite(Number(slide.panEndY))) slide.panEndY = oldY;
  slide.panX = Number(state.positionEditMode === 'end' ? slide.panEndX : slide.panStartX) || 0;
  slide.panY = Number(state.positionEditMode === 'end' ? slide.panEndY : slide.panStartY) || 0;
  return slide;
}

function normalizeTextAndOverlayData(slide) {
  if (!slide) return null;
  if (typeof slide.captionText !== 'string') slide.captionText = '';
  if (!Number.isFinite(Number(slide.captionX))) slide.captionX = 50;
  if (!Number.isFinite(Number(slide.captionY))) slide.captionY = 82;
  if (!Number.isFinite(Number(slide.captionSize))) slide.captionSize = 54;
  if (!Number.isFinite(Number(slide.captionOpacity))) slide.captionOpacity = 100;
  if (typeof slide.captionColor !== 'string' || !/^#[0-9a-f]{6}$/i.test(slide.captionColor)) slide.captionColor = '#ffffff';
  if (!['none', 'dark', 'light'].includes(slide.captionBgMode)) slide.captionBgMode = 'none';
  if (!Number.isFinite(Number(slide.captionBgOpacity))) slide.captionBgOpacity = 45;
  if (!Number.isFinite(Number(slide.darken))) slide.darken = 0;
  slide.captionX = clamp(slide.captionX, 0, 100);
  slide.captionY = clamp(slide.captionY, 0, 100);
  slide.captionSize = clamp(slide.captionSize, 18, 130);
  slide.captionOpacity = clamp(slide.captionOpacity, 0, 100);
  slide.captionBgOpacity = clamp(slide.captionBgOpacity, 0, 100);
  slide.darken = clamp(slide.darken, 0, 80);
  return slide;
}

function normalizeSlideData(slide) {
  normalizeSlideFrameData(slide);
  normalizeTextAndOverlayData(slide);
  return slide;
}

function activePan(slide) {
  normalizeSlideFrameData(slide);
  if (!slide) return { x: 0, y: 0 };
  return state.positionEditMode === 'end'
    ? { x: Number(slide.panEndX || 0), y: Number(slide.panEndY || 0) }
    : { x: Number(slide.panStartX || 0), y: Number(slide.panStartY || 0) };
}

function setBothPan(slide, x, y) {
  if (!slide) return;
  x = Math.round(clamp(Number(x) || 0, -300, 300));
  y = Math.round(clamp(Number(y) || 0, -300, 300));
  slide.panStartX = x; slide.panStartY = y; slide.panEndX = x; slide.panEndY = y; slide.panX = x; slide.panY = y;
}

function setActivePan(slide, x, y) {
  if (!slide) return;
  normalizeSlideFrameData(slide);
  x = Math.round(clamp(Number(x) || 0, -300, 300));
  y = Math.round(clamp(Number(y) || 0, -300, 300));
  if (state.positionEditMode === 'end') {
    slide.panEndX = x;
    slide.panEndY = y;
  } else {
    slide.panStartX = x;
    slide.panStartY = y;
  }
  slide.panX = x;
  slide.panY = y;
}

function updatePositionModeUi() {
  els.positionStartBtn?.classList.toggle('active', state.positionEditMode === 'start');
  els.positionEndBtn?.classList.toggle('active', state.positionEditMode === 'end');
  if (els.previewEditHint) {
    els.previewEditHint.textContent = state.positionEditMode === 'end'
      ? 'Редактируется конец кадра: колесо = зум конца, мышь = позиция конца'
      : 'Редактируется начало кадра: колесо = зум начала, мышь = позиция начала';
  }
}

function setPositionEditMode(mode, jump = false) {
  const slide = selectedSlide();
  state.positionEditMode = mode === 'end' ? 'end' : 'start';
  if (slide && jump) setSelectedSlideProgress(state.positionEditMode === 'end' ? 1 : 0);
  updatePositionModeUi();
  syncControls();
}

function syncPositionModeFromProgress(progress) {
  const mode = progress >= 0.5 ? 'end' : 'start';
  if (state.positionEditMode !== mode) {
    state.positionEditMode = mode;
    updatePositionModeUi();
    syncControls();
  } else {
    updatePositionModeUi();
  }
}

function waitForEvent(target, eventName, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timeout waiting for ${eventName}`));
    }, timeout);
    const onEvent = () => { cleanup(); resolve(); };
    const onError = () => { cleanup(); reject(new Error(`Cannot load media`)); };
    const cleanup = () => {
      clearTimeout(timer);
      target.removeEventListener(eventName, onEvent);
      target.removeEventListener('error', onError);
    };
    target.addEventListener(eventName, onEvent, { once: true });
    target.addEventListener('error', onError, { once: true });
  });
}

async function loadImageFromFile(file) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  try {
    await img.decode();
  } catch (_) {
    if (!img.complete) await waitForEvent(img, 'load');
  }
  return {
    type: 'image',
    source: img,
    url,
    thumbUrl: url,
    width: img.naturalWidth,
    height: img.naturalHeight,
    originalDuration: 4,
  };
}

async function loadVideoFromFile(file) {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.src = url;
  video.preload = 'auto';
  video.muted = true;
  video.playsInline = true;
  video.crossOrigin = 'anonymous';
  await waitForEvent(video, 'loadedmetadata', 12000);
  const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 5;
  const width = video.videoWidth || 1920;
  const height = video.videoHeight || 1080;
  let thumbUrl = '';
  try {
    video.currentTime = Math.min(0.2, Math.max(0, duration - 0.1));
    await waitForEvent(video, 'seeked', 3000);
    thumbUrl = makeVideoThumb(video, width, height);
  } catch (_) {
    thumbUrl = '';
  }
  video.currentTime = 0;
  return {
    type: 'video',
    source: video,
    url,
    thumbUrl,
    width,
    height,
    originalDuration: duration,
  };
}

function makeVideoThumb(video, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = Math.max(80, Math.round(320 * height / width));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#101522';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  try {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  } catch (_) {}
  return canvas.toDataURL('image/jpeg', 0.78);
}


let faceDetectorPromise = null;
let faceDetector = null;

function setAiStatus(text) {
  if (els.aiStatus) els.aiStatus.textContent = text;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

async function getFaceDetector() {
  if (faceDetector) return faceDetector;
  if (!faceDetectorPromise) {
    faceDetectorPromise = (async () => {
      setAiStatus('Загружаю локальную AI-модель лиц…');
      const vision = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/+esm');
      const fileset = await vision.FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm');
      const detector = await vision.FaceDetector.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite',
        },
        runningMode: 'IMAGE',
        minDetectionConfidence: 0.45,
      });
      faceDetector = detector;
      state.faceDetectorReady = true;
      setAiStatus('AI готов: лица ищутся прямо в браузере.');
      return detector;
    })().catch((error) => {
      console.warn('Face detector unavailable', error);
      faceDetectorPromise = null;
      setAiStatus('AI-модель не загрузилась. Применяю базовое авто-кадрирование.');
      return null;
    });
  }
  return faceDetectorPromise;
}

function detectionToBox(detection) {
  const box = detection?.boundingBox;
  if (!box) return null;
  const x = Number(box.originX ?? box.xMin ?? box.x ?? 0);
  const y = Number(box.originY ?? box.yMin ?? box.y ?? 0);
  const w = Number(box.width ?? ((box.xMax || 0) - x) ?? 0);
  const h = Number(box.height ?? ((box.yMax || 0) - y) ?? 0);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
  return { x, y, w, h };
}

function unionBoxes(boxes) {
  if (!boxes.length) return null;
  const left = Math.min(...boxes.map((box) => box.x));
  const top = Math.min(...boxes.map((box) => box.y));
  const right = Math.max(...boxes.map((box) => box.x + box.w));
  const bottom = Math.max(...boxes.map((box) => box.y + box.h));
  return { x: left, y: top, w: right - left, h: bottom - top };
}

function expandedBox(box, width, height, marginRatio = 0.72) {
  if (!box) return null;
  const marginX = Math.max(40, box.w * marginRatio);
  const marginTop = Math.max(50, box.h * 0.92);
  const marginBottom = Math.max(35, box.h * 0.58);
  const x = clamp(box.x - marginX, 0, width);
  const y = clamp(box.y - marginTop, 0, height);
  const right = clamp(box.x + box.w + marginX, 0, width);
  const bottom = clamp(box.y + box.h + marginBottom, 0, height);
  return { x, y, w: Math.max(1, right - x), h: Math.max(1, bottom - y) };
}

function aspectDistance(a, b) {
  if (!a || !b) return 0;
  return Math.abs(Math.log(a / b));
}

function canBoxFitInCover(slide, box, outW, outH, zoom) {
  if (!box) return true;
  const srcW = slide.width || 1;
  const srcH = slide.height || 1;
  const scale = Math.max(outW / srcW, outH / srcH) * zoom;
  const safeW = outW * 0.88;
  const safeH = outH * 0.86;
  return box.w * scale <= safeW && box.h * scale <= safeH;
}

function computePanForBox(slide, box, outW, outH, zoom) {
  const srcW = slide.width || 1;
  const srcH = slide.height || 1;
  const baseScale = slide.backgroundMode === 'cover'
    ? Math.max(outW / srcW, outH / srcH)
    : Math.min(outW / srcW, outH / srcH);
  const scale = baseScale * zoom;
  const drawW = srcW * scale;
  const drawH = srcH * scale;
  const freeX = Math.max(0, Math.abs(drawW - outW) / 2);
  const freeY = Math.max(0, Math.abs(drawH - outH) / 2);
  const baseDx = (outW - drawW) / 2;
  const baseDy = (outH - drawH) / 2;
  const focus = box
    ? { x: box.x + box.w / 2, y: box.y + box.h * 0.46 }
    : { x: srcW / 2, y: srcH / 2 };
  let offsetX = outW * 0.5 - focus.x * scale - baseDx;
  let offsetY = outH * 0.45 - focus.y * scale - baseDy;

  if (box && slide.backgroundMode === 'cover') {
    const marginX = outW * 0.06;
    const marginY = outH * 0.07;
    const minOffsetX = marginX - baseDx - box.x * scale;
    const maxOffsetX = outW - marginX - baseDx - (box.x + box.w) * scale;
    const minOffsetY = marginY - baseDy - box.y * scale;
    const maxOffsetY = outH - marginY - baseDy - (box.y + box.h) * scale;
    if (minOffsetX <= maxOffsetX) offsetX = clamp(offsetX, minOffsetX, maxOffsetX);
    if (minOffsetY <= maxOffsetY) offsetY = clamp(offsetY, minOffsetY, maxOffsetY);
  }

  const panX = freeX > 0.5 ? clamp((offsetX / freeX) * 100, -300, 300) : 0;
  const panY = freeY > 0.5 ? clamp((offsetY / freeY) * 100, -300, 300) : 0;
  return { panX: Math.round(panX), panY: Math.round(panY) };
}

function applyBasicSmartCrop(slide, reason = '') {
  if (!slide) return;
  const [outW, outH] = getOutputSize();
  const srcAspect = (slide.width || 1) / (slide.height || 1);
  const outAspect = outW / outH;
  const verticalOrMismatch = aspectDistance(srcAspect, outAspect) > 0.33;
  setBothPan(slide, 0, 0);
  slide.zoomStart = 1;
  slide.zoomEnd = slide.type === 'video' ? 1 : 1.06;
  slide.backgroundMode = verticalOrMismatch ? 'containBlur' : 'cover';
  slide.aiStatus = reason || (verticalOrMismatch ? 'фон без обрезки' : 'мягкий зум');
}

async function detectFacesForSlide(slide) {
  if (!slide) return [];
  const detector = await getFaceDetector();
  if (!detector) return [];
  let source = slide.source;
  if (slide.type === 'video') {
    const video = slide.source;
    const target = Math.min(Math.max(0.2, (slide.originalDuration || 1) * 0.18), Math.max(0.1, (slide.originalDuration || 1) - 0.1));
    try {
      video.pause();
      video.currentTime = target;
      await waitForEvent(video, 'seeked', 3000);
    } catch (_) {}
    source = video;
  }
  try {
    const result = detector.detect(source);
    return (result?.detections || []).map(detectionToBox).filter(Boolean);
  } catch (error) {
    console.warn('AI face detection failed for', slide.name, error);
    return [];
  }
}

function applyFaceSafeCrop(slide, boxes) {
  const [outW, outH] = getOutputSize();
  const srcW = slide.width || 1;
  const srcH = slide.height || 1;
  const srcAspect = srcW / srcH;
  const outAspect = outW / outH;
  const faces = unionBoxes(boxes);
  const safeBox = faces ? expandedBox(faces, srcW, srcH) : null;

  if (!safeBox) {
    applyBasicSmartCrop(slide, 'лиц не найдено');
    return;
  }

  const strongMismatch = aspectDistance(srcAspect, outAspect) > 0.46;
  slide.zoomStart = 1;
  slide.zoomEnd = slide.type === 'video' ? 1 : 1.06;

  if (strongMismatch || !canBoxFitInCover(slide, safeBox, outW, outH, slide.zoomEnd)) {
    slide.backgroundMode = 'containBlur';
  } else {
    slide.backgroundMode = 'cover';
  }

  const pan = computePanForBox(slide, safeBox, outW, outH, slide.zoomEnd);
  setBothPan(slide, pan.panX, pan.panY);
  slide.aiStatus = `лица: ${boxes.length}`;
}

async function smartCropSlide(slide, index = state.selectedIndex) {
  if (!slide) return;
  applyBasicSmartCrop(slide, 'обработка…');
  renderAll();
  const boxes = await detectFacesForSlide(slide);
  applyFaceSafeCrop(slide, boxes);
  if (index === state.selectedIndex) setSelectedSlideProgress(0);
  syncControls();
  renderAll();
}

async function smartCropIndices(indices, sourceLabel = 'AI') {
  const targets = indices.filter((index) => state.slides[index]);
  if (!targets.length) return;
  const selectedBefore = state.selectedIndex;
  if (els.aiSelectedBtn) els.aiSelectedBtn.disabled = true;
  if (els.aiAllBtn) els.aiAllBtn.disabled = true;
  try {
    for (let i = 0; i < targets.length; i += 1) {
      const index = targets[i];
      const slide = state.slides[index];
      setAiStatus(`${sourceLabel}: ${i + 1}/${targets.length} — ${slide.name}`);
      setExportStatus(`${sourceLabel}: ${i + 1}/${targets.length}`, Math.round((i / targets.length) * 100));
      await smartCropSlide(slide, index);
    }
    if (selectedBefore >= 0 && selectedBefore < state.slides.length) state.selectedIndex = selectedBefore;
    setAiStatus(`AI готово: обработано ${targets.length} кадр(ов).`);
    setExportStatus('AI авто-кадрирование применено.', 100);
  } finally {
    if (els.aiSelectedBtn) els.aiSelectedBtn.disabled = false;
    if (els.aiAllBtn) els.aiAllBtn.disabled = false;
    renderAll();
  }
}

function applyVerticalBackgroundToAll() {
  const [outW, outH] = getOutputSize();
  const outAspect = outW / outH;
  let count = 0;
  state.slides.forEach((slide) => {
    const srcAspect = (slide.width || 1) / (slide.height || 1);
    if (aspectDistance(srcAspect, outAspect) > 0.33) {
      slide.backgroundMode = 'containBlur';
      slide.zoomStart = Math.max(0.85, Math.min(1, Number(slide.zoomStart) || 1));
      slide.zoomEnd = slide.type === 'video' ? slide.zoomStart : Math.max(slide.zoomStart, Math.min(1.06, Number(slide.zoomEnd) || 1.06));
      setBothPan(slide, 0, 0);
      slide.aiStatus = 'размытый фон';
      count += 1;
    }
  });
  setAiStatus(`Фон применён к ${count} вертикальным/нестандартным кадрам.`);
  renderAll();
}


async function addFiles(fileList) {
  const files = [...fileList].filter((file) => file.type.startsWith('image/') || file.type.startsWith('video/'));
  if (!files.length) return;
  setExportStatus(`Загружаю ${files.length} файл(ов)…`, 0);
  const startIndex = state.slides.length;
  for (const file of files) {
    try {
      const loaded = file.type.startsWith('video/') ? await loadVideoFromFile(file) : await loadImageFromFile(file);
      state.slides.push({
        id: uid(),
        file,
        name: file.name,
        ...loaded,
        panX: 0,
        panY: 0,
        panStartX: 0,
        panStartY: 0,
        panEndX: 0,
        panEndY: 0,
        zoomStart: 1,
        zoomEnd: loaded.type === 'video' ? 1 : 1.08,
        duration: loaded.type === 'video' ? loaded.originalDuration : 4,
        backgroundMode: 'cover',
        captionText: '',
        captionX: 50,
        captionY: 82,
        captionSize: 54,
        captionOpacity: 100,
        captionColor: '#ffffff',
        captionBgMode: 'none',
        captionBgOpacity: 45,
        darken: 0,
      });
    } catch (error) {
      console.warn('Cannot load media', file.name, error);
      setExportStatus(`Не удалось загрузить: ${file.name}`, 0);
    }
  }
  if (state.selectedIndex === -1 && state.slides.length) state.selectedIndex = 0;
  if (state.audioDuration) fitToMusic(false);
  setExportStatus('Файлы добавлены.', 0);
  renderAll();
  renderSelectionState();
  if (state.aiAutoForNew) {
    const indices = state.slides.slice(startIndex).map((_, offset) => startIndex + offset);
    smartCropIndices(indices, 'AI для новых').catch((error) => {
      console.warn(error);
      setAiStatus('AI авто-обработка не сработала. Можно нажать AI обработать все ещё раз.');
    });
  }
}

function fitToMusic(showMessage = true) {
  if (!state.slides.length || !state.audioDuration) return;
  const photos = state.slides.filter((slide) => slide.type === 'image');
  const videos = state.slides.filter((slide) => slide.type === 'video');
  const videoTotal = videos.reduce((sum, slide) => sum + slide.originalDuration, 0);

  if (photos.length && state.audioDuration > videoTotal) {
    const photoDuration = Math.max(0.5, (state.audioDuration - videoTotal) / photos.length);
    state.slides.forEach((slide) => {
      slide.duration = slide.type === 'video' ? slide.originalDuration : photoDuration;
    });
    if (showMessage) setExportStatus(`Готово: видео ${formatTime(videoTotal)}, фото по ${photoDuration.toFixed(1)} сек.`, 0);
  } else {
    const baseTotal = state.slides.reduce((sum, slide) => sum + (slide.type === 'video' ? slide.originalDuration : 4), 0) || 1;
    const scale = state.audioDuration / baseTotal;
    state.slides.forEach((slide) => {
      const base = slide.type === 'video' ? slide.originalDuration : 4;
      slide.duration = Math.max(0.5, base * scale);
    });
    if (showMessage) setExportStatus('Музыка короче видео/кадров, поэтому всё пропорционально сжато под трек.', 0);
  }
  renderAll();
renderSelectionState();
}

function renderStats() {
  els.mediaCount.textContent = state.slides.length;
  els.audioDuration.textContent = state.audioDuration ? formatTime(state.audioDuration) : '—';
  els.totalDuration.textContent = totalDuration() ? formatTime(totalDuration()) : '—';
  els.timeLabel.textContent = `${formatTime(state.previewTimeOffset)} / ${formatTime(totalDuration())}`;
}

function renderSlideList() {
  els.slideList.innerHTML = '';
  if (!state.slides.length) {
    const empty = document.createElement('div');
    empty.className = 'slide-card empty-card';
    empty.textContent = 'Пока нет фото/видео';
    els.slideList.appendChild(empty);
    renderSelectionState();
    return;
  }
  state.slides.forEach((slide, index) => {
    const card = document.createElement('div');
    card.className = `slide-card ${index === state.selectedIndex ? 'selected' : ''} ${state.selectedIds.has(slide.id) ? 'checked' : ''}`;
    card.draggable = true;
    const thumbHtml = slide.thumbUrl
      ? `<img src="${slide.thumbUrl}" alt="" />`
      : `<span class="thumb-fallback">${slide.type === 'video' ? '▶' : 'IMG'}</span>`;
    const kind = slide.type === 'video' ? 'Видео' : 'Фото';
    card.innerHTML = `
      <label class="slide-check" title="Выбрать для удаления">
        <input type="checkbox" ${state.selectedIds.has(slide.id) ? 'checked' : ''} />
      </label>
      ${thumbHtml}
      <span class="slide-title">
        <strong>${index + 1}. ${escapeHtml(slide.name)}</strong>
        <span>${kind} · ${slide.width}×${slide.height} · ${Number(slide.duration).toFixed(1)} сек.${slide.aiStatus ? ` · AI ${escapeHtml(slide.aiStatus)}` : ''}</span>
      </span>
      <span class="slide-actions">
        <button type="button" title="Выше">↑</button>
        <button type="button" title="Ниже">↓</button>
      </span>
    `;
    card.dataset.slideIndex = String(index);
    const checkbox = card.querySelector('.slide-check input');
    checkbox.addEventListener('click', (event) => {
      event.stopPropagation();
      if (event.shiftKey) {
        setRangeChecked(index, checkbox.checked);
      } else {
        toggleSlideChecked(slide.id, checkbox.checked, index);
      }
    });
    card.addEventListener('click', (event) => {
      if (event.target.tagName === 'BUTTON' || event.target.tagName === 'INPUT' || event.target.closest('.slide-check')) return;
      if (event.shiftKey) {
        addRangeToSelection(index);
        selectSlide(index, true);
        return;
      }
      selectSlide(index, true);
    });
    const [upBtn, downBtn] = card.querySelectorAll('.slide-actions button');
    upBtn.addEventListener('click', (event) => { event.stopPropagation(); moveSlide(index, index - 1); });
    downBtn.addEventListener('click', (event) => { event.stopPropagation(); moveSlide(index, index + 1); });
    card.addEventListener('dragstart', (event) => {
      event.dataTransfer.setData('text/plain', String(index));
    });
    card.addEventListener('dragover', (event) => event.preventDefault());
    card.addEventListener('drop', (event) => {
      event.preventDefault();
      const from = Number(event.dataTransfer.getData('text/plain'));
      moveSlide(from, index);
    });
    els.slideList.appendChild(card);
  });
  renderSelectionState();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function renderSelectionState() {
  const selected = state.selectedIds.size;
  if (els.selectedCount) els.selectedCount.textContent = selected ? `Выбрано: ${selected}` : 'Ничего не выбрано';
  if (els.deleteSelectedBtn) els.deleteSelectedBtn.disabled = selected === 0;
  if (els.selectAllBtn) {
    els.selectAllBtn.disabled = state.slides.length === 0;
    els.selectAllBtn.textContent = selected && selected === state.slides.length ? 'Снять выбор' : 'Выбрать все';
  }
}

function toggleSlideChecked(id, checked, index = -1) {
  if (checked) state.selectedIds.add(id);
  else state.selectedIds.delete(id);
  if (index >= 0) state.lastSelectionAnchor = index;
  renderSlideList();
}

function setRangeChecked(index, checked) {
  if (!state.slides.length) return;
  const anchor = state.lastSelectionAnchor >= 0 ? state.lastSelectionAnchor : Math.max(0, state.selectedIndex);
  const from = Math.min(anchor, index);
  const to = Math.max(anchor, index);
  for (let i = from; i <= to; i += 1) {
    const id = state.slides[i]?.id;
    if (!id) continue;
    if (checked) state.selectedIds.add(id);
    else state.selectedIds.delete(id);
  }
  state.lastSelectionAnchor = index;
  renderSlideList();
}

function addRangeToSelection(index) {
  if (!state.slides.length) return;
  const anchor = state.lastSelectionAnchor >= 0 ? state.lastSelectionAnchor : Math.max(0, state.selectedIndex);
  const from = Math.min(anchor, index);
  const to = Math.max(anchor, index);
  for (let i = from; i <= to; i += 1) {
    const id = state.slides[i]?.id;
    if (id) state.selectedIds.add(id);
  }
  state.lastSelectionAnchor = index;
  renderSlideList();
}

function selectAllOrNone() {
  if (!state.slides.length) return;
  if (state.selectedIds.size === state.slides.length) state.selectedIds.clear();
  else state.slides.forEach((slide) => state.selectedIds.add(slide.id));
  state.lastSelectionAnchor = state.slides.length ? 0 : -1;
  renderSlideList();
}

function revokeSlideUrls(slide) {
  try { if (slide.url) URL.revokeObjectURL(slide.url); } catch (_) {}
  if (slide.thumbUrl && slide.thumbUrl.startsWith('blob:')) {
    try { URL.revokeObjectURL(slide.thumbUrl); } catch (_) {}
  }
}

function deleteSelectedSlides() {
  if (!state.selectedIds.size) return;
  stopPreview(false);
  const selectedIds = new Set(state.selectedIds);
  state.slides.forEach((slide) => { if (selectedIds.has(slide.id)) revokeSlideUrls(slide); });
  const previousSelectedSlide = selectedSlide();
  state.slides = state.slides.filter((slide) => !selectedIds.has(slide.id));
  state.selectedIds.clear();
  state.lastSelectionAnchor = -1;

  if (!state.slides.length) {
    state.selectedIndex = -1;
    state.previewTimeOffset = 0;
  } else if (previousSelectedSlide && !selectedIds.has(previousSelectedSlide.id)) {
    state.selectedIndex = state.slides.findIndex((slide) => slide.id === previousSelectedSlide.id);
  } else {
    state.selectedIndex = Math.min(state.selectedIndex, state.slides.length - 1);
    if (state.selectedIndex < 0) state.selectedIndex = 0;
  }
  renderAll();
renderSelectionState();
  setExportStatus(`Удалено: ${selectedIds.size}.`, 0);
}

function moveSlide(from, to) {
  if (to < 0 || to >= state.slides.length || from === to) return;
  const [slide] = state.slides.splice(from, 1);
  state.slides.splice(to, 0, slide);
  if (state.selectedIndex === from) state.selectedIndex = to;
  else if (state.selectedIndex > from && state.selectedIndex <= to) state.selectedIndex -= 1;
  else if (state.selectedIndex < from && state.selectedIndex >= to) state.selectedIndex += 1;
  renderAll();
renderSelectionState();
}

function selectSlide(index, setAnchor = false) {
  if (!state.slides.length) return;
  const safeIndex = Math.max(0, Math.min(state.slides.length - 1, index));
  pauseAllVideos();
  state.selectedIndex = safeIndex;
  if (setAnchor) state.lastSelectionAnchor = safeIndex;
  state.previewTimeOffset = timeAtSlide(safeIndex);
  state.positionEditMode = 'start';
  normalizeSlideData(state.slides[safeIndex]);
  syncControls();
  renderAll();
  renderSelectionState();
  scrollSelectedIntoView();
}

function scrollSelectedIntoView() {
  const card = els.slideList?.querySelector(`[data-slide-index="${state.selectedIndex}"]`);
  if (card) card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function timeAtSlide(index) {
  return state.slides.slice(0, index).reduce((sum, slide) => sum + Number(slide.duration || 0), 0);
}

function syncControls() {
  const slide = selectedSlide();
  const disabled = !slide;
  [els.panX, els.panY, els.zoomStart, els.zoomEnd, els.duration, els.backgroundMode, els.resetSlideBtn, els.fitWholeBtn, els.coverBtn, els.softZoomBtn, els.aiSelectedBtn, els.positionStartBtn, els.positionEndBtn, els.captionText, els.captionX, els.captionY, els.captionSize, els.captionOpacity, els.captionColor, els.captionBgMode, els.captionBgOpacity, els.darken].forEach((el) => { if (el) el.disabled = disabled; });
  if (!slide) {
    updateControlLabels();
    return;
  }
  normalizeSlideData(slide);
  const pan = activePan(slide);
  els.panX.value = pan.x;
  els.panY.value = pan.y;
  els.zoomStart.value = slide.zoomStart;
  els.zoomEnd.value = slide.zoomEnd;
  els.duration.max = Math.max(60, Math.ceil(slide.duration * 2), Math.ceil((slide.originalDuration || 4) * 2));
  els.duration.value = Math.max(0.5, Math.min(Number(els.duration.max), slide.duration));
  els.backgroundMode.value = slide.backgroundMode || 'cover';
  if (els.captionText) els.captionText.value = slide.captionText || '';
  if (els.captionX) els.captionX.value = slide.captionX;
  if (els.captionY) els.captionY.value = slide.captionY;
  if (els.captionSize) els.captionSize.value = slide.captionSize;
  if (els.captionOpacity) els.captionOpacity.value = slide.captionOpacity;
  if (els.captionColor) els.captionColor.value = slide.captionColor || '#ffffff';
  if (els.captionBgMode) els.captionBgMode.value = slide.captionBgMode || 'none';
  if (els.captionBgOpacity) els.captionBgOpacity.value = slide.captionBgOpacity;
  if (els.darken) els.darken.value = slide.darken;
  els.videoHint.style.display = slide.type === 'video' ? 'block' : 'none';
  updateControlLabels();
}

function updateControlLabels() {
  const slide = selectedSlide();
  const pan = slide ? activePan(slide) : { x: 0, y: 0 };
  els.panXValue.textContent = slide ? pan.x : '0';
  els.panYValue.textContent = slide ? pan.y : '0';
  updatePositionModeUi();
  els.zoomStartValue.textContent = slide ? `${Number(slide.zoomStart).toFixed(2)}×` : '1.00×';
  els.zoomEndValue.textContent = slide ? `${Number(slide.zoomEnd).toFixed(2)}×` : '1.08×';
  els.durationValue.textContent = slide ? `${Number(slide.duration).toFixed(1)} сек.` : '—';
  if (slide) normalizeTextAndOverlayData(slide);
  if (els.captionXValue) els.captionXValue.textContent = slide ? `${Math.round(slide.captionX)}%` : '50%';
  if (els.captionYValue) els.captionYValue.textContent = slide ? `${Math.round(slide.captionY)}%` : '82%';
  if (els.captionSizeValue) els.captionSizeValue.textContent = slide ? `${Math.round(slide.captionSize)} px` : '54 px';
  if (els.captionOpacityValue) els.captionOpacityValue.textContent = slide ? `${Math.round(slide.captionOpacity)}%` : '100%';
  if (els.captionBgOpacityValue) els.captionBgOpacityValue.textContent = slide ? `${Math.round(slide.captionBgOpacity)}%` : '45%';
  if (els.darkenValue) els.darkenValue.textContent = slide ? `${Math.round(slide.darken)}%` : '0%';
}


function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function selectedSlideLocalTime() {
  const slide = selectedSlide();
  if (!slide || state.selectedIndex < 0) return 0;
  const start = timeAtSlide(state.selectedIndex);
  const duration = Math.max(0.1, Number(slide.duration || 0));
  return Math.max(0, Math.min(duration, state.previewTimeOffset - start));
}

function selectedSlideProgress() {
  const slide = selectedSlide();
  if (!slide) return 0;
  return clamp01(selectedSlideLocalTime() / Math.max(0.1, Number(slide.duration || 0)));
}

function syncClipScrubber() {
  if (!els.clipScrub || !els.clipScrubLabel) return;
  const slide = selectedSlide();
  const disabled = !slide;
  [els.clipScrub, els.clipStartBtn, els.clipEndBtn].forEach((el) => {
    if (el) el.disabled = disabled;
  });
  if (!slide) {
    els.clipScrub.value = 0;
    els.clipScrubLabel.textContent = '—';
    return;
  }
  const duration = Math.max(0.1, Number(slide.duration || 0));
  const local = selectedSlideLocalTime();
  const progress = clamp01(local / duration);
  els.clipScrub.value = String(Math.round(progress * 1000));
  els.clipScrubLabel.textContent = `${formatTime(local)} / ${formatTime(duration)} · кадр ${state.selectedIndex + 1}`;
}

function setSelectedSlideProgress(progress) {
  const slide = selectedSlide();
  if (!slide || state.selectedIndex < 0) return;
  if (state.playing) stopPreview(false);
  const duration = Math.max(0.1, Number(slide.duration || 0));
  const local = duration * clamp01(progress);
  const slideStart = timeAtSlide(state.selectedIndex);
  const total = totalDuration();
  state.previewTimeOffset = Math.max(0, Math.min(total ? total - 0.001 : slideStart, slideStart + local));
  prepareVideoForDraw(slide, local, false);
  syncPositionModeFromProgress(clamp01(progress));
  drawCurrentPreview();
}

function applyControlChange(sourceId = '') {
  const slide = selectedSlide();
  if (!slide) return;
  normalizeSlideFrameData(slide);

  if (sourceId === 'zoomStart') {
    state.positionEditMode = 'start';
    slide.zoomStart = Number(els.zoomStart.value);
    setSelectedSlideProgress(0);
  } else if (sourceId === 'zoomEnd') {
    state.positionEditMode = 'end';
    slide.zoomEnd = Number(els.zoomEnd.value);
    setSelectedSlideProgress(1);
  } else if (sourceId === 'panX' || sourceId === 'panY') {
    setActivePan(slide, Number(els.panX.value), Number(els.panY.value));
  } else if (sourceId === 'duration') {
    slide.duration = Number(els.duration.value);
  } else if (sourceId === 'backgroundMode') {
    slide.backgroundMode = els.backgroundMode.value;
  } else if (sourceId === 'captionText') {
    slide.captionText = els.captionText.value;
  } else if (sourceId === 'captionX') {
    slide.captionX = Number(els.captionX.value);
  } else if (sourceId === 'captionY') {
    slide.captionY = Number(els.captionY.value);
  } else if (sourceId === 'captionSize') {
    slide.captionSize = Number(els.captionSize.value);
  } else if (sourceId === 'captionOpacity') {
    slide.captionOpacity = Number(els.captionOpacity.value);
  } else if (sourceId === 'captionColor') {
    slide.captionColor = els.captionColor.value;
  } else if (sourceId === 'captionBgMode') {
    slide.captionBgMode = els.captionBgMode.value;
  } else if (sourceId === 'captionBgOpacity') {
    slide.captionBgOpacity = Number(els.captionBgOpacity.value);
  } else if (sourceId === 'darken') {
    slide.darken = Number(els.darken.value);
  } else {
    setActivePan(slide, Number(els.panX.value), Number(els.panY.value));
    slide.zoomStart = Number(els.zoomStart.value);
    slide.zoomEnd = Number(els.zoomEnd.value);
    slide.duration = Number(els.duration.value);
    slide.backgroundMode = els.backgroundMode.value;
    if (els.captionText) slide.captionText = els.captionText.value;
    if (els.captionX) slide.captionX = Number(els.captionX.value);
    if (els.captionY) slide.captionY = Number(els.captionY.value);
    if (els.captionSize) slide.captionSize = Number(els.captionSize.value);
    if (els.captionOpacity) slide.captionOpacity = Number(els.captionOpacity.value);
    if (els.captionColor) slide.captionColor = els.captionColor.value;
    if (els.captionBgMode) slide.captionBgMode = els.captionBgMode.value;
    if (els.captionBgOpacity) slide.captionBgOpacity = Number(els.captionBgOpacity.value);
    if (els.darken) slide.darken = Number(els.darken.value);
  }
  normalizeTextAndOverlayData(slide);

  updateControlLabels();
  renderStats();
  drawCurrentPreview();
  renderSlideList();
}

function getOutputSize() {
  if (els.formatSelect.value === 'custom') {
    return [clampEven(Number(els.customWidth.value) || 1920, 320, 3840), clampEven(Number(els.customHeight.value) || 1080, 240, 3840)];
  }
  return els.formatSelect.value.split('x').map(Number);
}

function fitSizeToLongSide(width, height, longSide) {
  const maxSide = Math.max(width, height);
  if (maxSide <= longSide) return [clampEven(width, 320, 3840), clampEven(height, 240, 3840)];
  const scale = longSide / maxSide;
  return [clampEven(width * scale, 320, 3840), clampEven(height * scale, 240, 3840)];
}

function getExportSettings(kind = 'mp4') {
  const [baseWidth, baseHeight] = getOutputSize();
  const preset = els.exportPreset?.value || 'smooth1080';
  let width = baseWidth;
  let height = baseHeight;
  let fps = 24;
  let videoBitsPerSecond = 6000000;
  let label = 'Плавный 1080p · 24 fps · 6 Mbps';

  if (preset === 'maxSmooth720') {
    [width, height] = fitSizeToLongSide(baseWidth, baseHeight, 1280);
    fps = 24;
    videoBitsPerSecond = 4000000;
    label = 'Максимальная плавность · 720p/long 1280 · 24 fps · 4 Mbps';
  } else if (preset === 'quality1080') {
    [width, height] = fitSizeToLongSide(baseWidth, baseHeight, 1920);
    fps = 30;
    videoBitsPerSecond = 9000000;
    label = 'Качественный 1080p · 30 fps · 9 Mbps';
  } else if (preset === 'current') {
    fps = Number(els.fpsSelect.value || 24);
    videoBitsPerSecond = width >= 1920 || height >= 1920 ? 10000000 : 6000000;
    label = `Как выбрано · ${width}×${height} · ${fps} fps`;
  } else {
    [width, height] = fitSizeToLongSide(baseWidth, baseHeight, 1920);
  }

  if (kind !== 'mp4') {
    videoBitsPerSecond = Math.max(videoBitsPerSecond, 5000000);
  }

  return {
    width,
    height,
    fps,
    videoBitsPerSecond,
    audioBitsPerSecond: 128000,
    label,
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

function clampEven(value, min, max) {
  const clamped = Math.max(min, Math.min(max, Math.round(value)));
  return clamped % 2 === 0 ? clamped : clamped + 1;
}

function updatePreviewCanvasSize() {
  const [width, height] = getOutputSize();
  const wide = width >= height;
  const previewW = wide ? 960 : Math.max(360, Math.round(720 * width / height));
  const previewH = wide ? Math.round(960 * height / width) : 720;
  els.previewCanvas.width = previewW;
  els.previewCanvas.height = previewH;
  els.canvasWrap.style.aspectRatio = `${width} / ${height}`;
  els.emptyState.textContent = `Здесь появится предпросмотр ${width}×${height}`;
  els.customSizeBox.classList.toggle('visible', els.formatSelect.value === 'custom');
  drawCurrentPreview();
}

function drawCurrentPreview() {
  if (!state.slides.length) {
    previewCtx.clearRect(0, 0, els.previewCanvas.width, els.previewCanvas.height);
    els.emptyState.style.display = 'grid';
    els.currentInfo.textContent = 'Загрузи фото/видео, затем выбери кадр.';
    syncClipScrubber();
    return;
  }
  els.emptyState.style.display = 'none';
  const current = slideAtTime(state.previewTimeOffset);
  prepareVideoForDraw(current.slide, current.localTime, false);
  drawSlide(previewCtx, current.slide, current.progress, els.previewCanvas.width, els.previewCanvas.height);
  const kind = current.slide.type === 'video' ? 'Видео' : 'Фото';
  els.currentInfo.textContent = `${current.index + 1}/${state.slides.length}: ${kind} · ${current.slide.name}`;
  const total = totalDuration();
  els.previewProgress.style.width = total ? `${Math.min(100, (state.previewTimeOffset / total) * 100)}%` : '0%';
  els.timeLabel.textContent = `${formatTime(state.previewTimeOffset)} / ${formatTime(total)}`;
  syncClipScrubber();
}

function slideAtTime(time) {
  if (!state.slides.length) return { slide: null, index: -1, progress: 0, localTime: 0 };
  let cursor = 0;
  for (let i = 0; i < state.slides.length; i++) {
    const duration = Math.max(0.1, Number(state.slides[i].duration || 0));
    if (time < cursor + duration || i === state.slides.length - 1) {
      const localTime = Math.max(0, Math.min(duration, time - cursor));
      return { slide: state.slides[i], index: i, progress: Math.max(0, Math.min(1, localTime / duration)), localTime };
    }
    cursor += duration;
  }
  const last = state.slides[state.slides.length - 1];
  return { slide: last, index: state.slides.length - 1, progress: 1, localTime: last.duration };
}

function drawSlide(ctx, slide, rawProgress, width, height) {
  ctx.save();
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#02030a';
  ctx.fillRect(0, 0, width, height);
  if (!slide || !slide.source) {
    ctx.restore();
    return;
  }
  const progress = ease(rawProgress);
  const source = slide.source;
  const sourceWidth = slide.type === 'video' ? (source.videoWidth || slide.width) : slide.width;
  const sourceHeight = slide.type === 'video' ? (source.videoHeight || slide.height) : slide.height;

  if (slide.backgroundMode === 'containBlur') {
    if (state.isExporting && slide.type === 'image') drawCachedBlurBackground(ctx, slide, source, sourceWidth, sourceHeight, width, height);
    else drawBlurBackground(ctx, source, sourceWidth, sourceHeight, width, height);
  }

  let baseScale;
  if (slide.backgroundMode === 'cover') baseScale = Math.max(width / sourceWidth, height / sourceHeight);
  else baseScale = Math.min(width / sourceWidth, height / sourceHeight);

  const zoom = lerp(slide.zoomStart, slide.zoomEnd, progress);
  const scale = baseScale * zoom;
  const drawW = sourceWidth * scale;
  const drawH = sourceHeight * scale;
  const freeX = Math.max(0, Math.abs(drawW - width) / 2);
  const freeY = Math.max(0, Math.abs(drawH - height) / 2);
  normalizeSlideFrameData(slide);
  const panX = lerp(Number(slide.panStartX || 0), Number(slide.panEndX || 0), progress);
  const panY = lerp(Number(slide.panStartY || 0), Number(slide.panEndY || 0), progress);
  const offsetX = (panX / 100) * freeX;
  const offsetY = (panY / 100) * freeY;
  const dx = (width - drawW) / 2 + offsetX;
  const dy = (height - drawH) / 2 + offsetY;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = state.isExporting ? 'medium' : 'high';
  try {
    ctx.drawImage(source, dx, dy, drawW, drawH);
  } catch (_) {
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#83e6c3';
    ctx.font = `${Math.max(18, width * 0.035)}px system-ui`;
    ctx.textAlign = 'center';
    ctx.fillText('Видео загружается…', width / 2, height / 2);
  }
  drawTextAndDarkenOverlay(ctx, slide, width, height);
  ctx.restore();
}

function hexToRgb(hex) {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex || '#ffffff'));
  return match ? { r: parseInt(match[1], 16), g: parseInt(match[2], 16), b: parseInt(match[3], 16) } : { r: 255, g: 255, b: 255 };
}

function roundedRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function wrapCaptionLines(ctx, text, maxWidth) {
  const lines = [];
  const paragraphs = String(text || '').split(/\r?\n/);
  paragraphs.forEach((paragraph) => {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push('');
      return;
    }
    let line = '';
    words.forEach((word) => {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width <= maxWidth || !line) line = test;
      else {
        lines.push(line);
        line = word;
      }
    });
    if (line) lines.push(line);
  });
  return lines.slice(0, 6);
}

function drawTextAndDarkenOverlay(ctx, slide, width, height) {
  if (!slide) return;
  normalizeTextAndOverlayData(slide);
  const darkenAlpha = clamp(slide.darken, 0, 80) / 100;
  if (darkenAlpha > 0) {
    ctx.save();
    ctx.fillStyle = `rgba(0,0,0,${darkenAlpha})`;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  const text = String(slide.captionText || '').trim();
  if (!text) return;
  const baseScale = Math.max(0.18, Math.min(width / 1920, height / 1080));
  const fontPx = Math.max(10, Number(slide.captionSize || 54) * baseScale);
  const lineHeight = fontPx * 1.18;
  const maxWidth = width * 0.84;
  ctx.save();
  ctx.font = `800 ${fontPx}px Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lines = wrapCaptionLines(ctx, text, maxWidth);
  const textWidth = Math.min(maxWidth, Math.max(...lines.map((line) => ctx.measureText(line).width), 1));
  const textHeight = Math.max(lineHeight, lines.length * lineHeight);
  const x = clamp(slide.captionX, 0, 100) / 100 * width;
  const y = clamp(slide.captionY, 0, 100) / 100 * height;
  const padX = fontPx * 0.52;
  const padY = fontPx * 0.34;
  const boxW = Math.min(width - fontPx, textWidth + padX * 2);
  const boxH = textHeight + padY * 2;
  const boxX = clamp(x - boxW / 2, fontPx * 0.25, width - boxW - fontPx * 0.25);
  const boxY = clamp(y - boxH / 2, fontPx * 0.25, height - boxH - fontPx * 0.25);
  const drawX = boxX + boxW / 2;
  const firstY = boxY + padY + lineHeight / 2;

  if (slide.captionBgMode !== 'none') {
    const bgAlpha = clamp(slide.captionBgOpacity, 0, 100) / 100;
    ctx.fillStyle = slide.captionBgMode === 'light'
      ? `rgba(255,255,255,${bgAlpha})`
      : `rgba(0,0,0,${bgAlpha})`;
    roundedRect(ctx, boxX, boxY, boxW, boxH, Math.max(10, fontPx * 0.38));
    ctx.fill();
  }

  const rgb = hexToRgb(slide.captionColor);
  const alpha = clamp(slide.captionOpacity, 0, 100) / 100;
  ctx.shadowColor = 'rgba(0,0,0,.52)';
  ctx.shadowBlur = fontPx * 0.22;
  ctx.shadowOffsetY = fontPx * 0.05;
  ctx.lineWidth = Math.max(2, fontPx * 0.08);
  ctx.strokeStyle = `rgba(0,0,0,${Math.min(0.75, alpha)})`;
  ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;
  lines.forEach((line, index) => {
    const lineY = firstY + index * lineHeight;
    ctx.strokeText(line, drawX, lineY);
    ctx.fillText(line, drawX, lineY);
  });
  ctx.restore();
}

function drawBlurBackground(ctx, source, sourceWidth, sourceHeight, width, height) {
  const baseScale = Math.max(width / sourceWidth, height / sourceHeight);
  const drawW = sourceWidth * baseScale;
  const drawH = sourceHeight * baseScale;
  ctx.save();
  ctx.filter = 'blur(34px) brightness(0.62) saturate(1.15)';
  try { ctx.drawImage(source, (width - drawW) / 2, (height - drawH) / 2, drawW, drawH); } catch (_) {}
  ctx.filter = 'none';
  ctx.fillStyle = 'rgba(0,0,0,.22)';
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

function drawCachedBlurBackground(ctx, slide, source, sourceWidth, sourceHeight, width, height) {
  const key = `${slide.id}:${width}x${height}`;
  let cached = state.exportBlurCache.get(key);
  if (!cached) {
    cached = document.createElement('canvas');
    cached.width = width;
    cached.height = height;
    const cctx = cached.getContext('2d');
    drawBlurBackground(cctx, source, sourceWidth, sourceHeight, width, height);
    state.exportBlurCache.set(key, cached);
    if (state.exportBlurCache.size > 8) {
      const firstKey = state.exportBlurCache.keys().next().value;
      state.exportBlurCache.delete(firstKey);
    }
  }
  try { ctx.drawImage(cached, 0, 0, width, height); } catch (_) {
    drawBlurBackground(ctx, source, sourceWidth, sourceHeight, width, height);
  }
}

function getVideoTargetTime(slide, localTime) {
  const duration = Math.max(0.1, Number(slide.duration || slide.originalDuration || 1));
  const original = Math.max(0.1, Number(slide.originalDuration || 1));
  const ratio = original / duration;
  return Math.max(0, Math.min(original - 0.05, localTime * ratio));
}

function prepareVideoForDraw(slide, localTime, shouldPlay) {
  if (!slide || slide.type !== 'video') return;
  const video = slide.source;
  const target = getVideoTargetTime(slide, localTime);
  if (shouldPlay) {
    if (state.activeVideoId !== slide.id) {
      pauseAllVideos();
      state.activeVideoId = slide.id;
      video.currentTime = target;
    } else if (Math.abs(video.currentTime - target) > 0.45) {
      video.currentTime = target;
    }
    video.muted = true;
    video.play().catch(() => {});
  } else {
    if (!video.paused) video.pause();
    if (Math.abs(video.currentTime - target) > 0.18) {
      try { video.currentTime = target; } catch (_) {}
    }
  }
}

function pauseAllVideos() {
  state.slides.forEach((slide) => {
    if (slide.type === 'video' && slide.source) slide.source.pause();
  });
  state.activeVideoId = null;
}

function renderAll() {
  renderStats();
  renderSlideList();
  syncControls();
  updatePreviewCanvasSize();
}

function setExportStatus(text, percent = null) {
  els.exportStatusText.textContent = text;
  if (percent !== null) els.exportProgress.style.width = `${Math.max(0, Math.min(100, percent))}%`;
}

function startPreview() {
  if (!state.slides.length) return;
  if (state.playing) return;
  state.playing = true;
  els.playBtn.textContent = '⏸ Пауза';
  const total = totalDuration();
  const audio = els.audioPreview;
  if (state.audioUrl) {
    audio.currentTime = Math.min(state.previewTimeOffset, Math.max(0, audio.duration - 0.1));
    audio.play().catch(() => {});
  }
  state.playStartedAt = performance.now() - state.previewTimeOffset * 1000;
  const tick = () => {
    if (!state.playing) return;
    state.previewTimeOffset = state.audioUrl ? audio.currentTime : (performance.now() - state.playStartedAt) / 1000;
    if (state.previewTimeOffset >= total) {
      stopPreview(true);
      return;
    }
    const current = slideAtTime(state.previewTimeOffset);
    prepareVideoForDraw(current.slide, current.localTime, true);
    drawCurrentPreview();
    state.raf = requestAnimationFrame(tick);
  };
  tick();
}

function stopPreview(reset = false) {
  state.playing = false;
  els.playBtn.textContent = '▶ Смотреть';
  cancelAnimationFrame(state.raf);
  els.audioPreview.pause();
  pauseAllVideos();
  if (reset) state.previewTimeOffset = 0;
  drawCurrentPreview();
}

const DB_NAME = 'family-slideshow-maker-db';
const DB_VERSION = 1;
const PROJECT_STORE = 'projects';
const LAST_PROJECT_KEY = 'last';

function openProjectDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PROJECT_STORE)) db.createObjectStore(PROJECT_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB error'));
  });
}

async function idbPut(key, value) {
  const db = await openProjectDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECT_STORE, 'readwrite');
    tx.objectStore(PROJECT_STORE).put(value, key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error || new Error('Cannot save project')); };
  });
}

async function idbGet(key) {
  const db = await openProjectDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECT_STORE, 'readonly');
    const request = tx.objectStore(PROJECT_STORE).get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error('Cannot load project'));
    tx.oncomplete = () => db.close();
  });
}

async function idbDelete(key) {
  const db = await openProjectDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECT_STORE, 'readwrite');
    tx.objectStore(PROJECT_STORE).delete(key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error || new Error('Cannot delete project')); };
  });
}

function makeProjectSnapshot() {
  return {
    version: 3,
    savedAt: new Date().toISOString(),
    settings: {
      format: els.formatSelect.value,
      customWidth: Number(els.customWidth.value) || 1920,
      customHeight: Number(els.customHeight.value) || 1080,
      fps: els.fpsSelect.value,
    },
    audio: state.audioFile ? {
      file: state.audioFile,
      name: state.audioFile.name,
      type: state.audioFile.type,
      duration: state.audioDuration,
      lastModified: state.audioFile.lastModified,
    } : null,
    slides: state.slides.map((slide) => ({
      id: slide.id,
      file: slide.file,
      name: slide.name,
      type: slide.type,
      panX: slide.panX,
      panY: slide.panY,
      panStartX: slide.panStartX,
      panStartY: slide.panStartY,
      panEndX: slide.panEndX,
      panEndY: slide.panEndY,
      zoomStart: slide.zoomStart,
      zoomEnd: slide.zoomEnd,
      duration: slide.duration,
      backgroundMode: slide.backgroundMode,
      originalDuration: slide.originalDuration,
      aiStatus: slide.aiStatus || '',
      captionText: slide.captionText || '',
      captionX: Number(slide.captionX ?? 50),
      captionY: Number(slide.captionY ?? 82),
      captionSize: Number(slide.captionSize ?? 54),
      captionOpacity: Number(slide.captionOpacity ?? 100),
      captionColor: slide.captionColor || '#ffffff',
      captionBgMode: slide.captionBgMode || 'none',
      captionBgOpacity: Number(slide.captionBgOpacity ?? 45),
      darken: Number(slide.darken ?? 0),
    })),
  };
}

async function saveProjectToBrowser() {
  if (!state.slides.length && !state.audioFile) {
    setProjectStatus('Сначала добавь фото/видео или музыку.');
    return;
  }
  try {
    setProjectStatus('Сохраняю проект в браузере…');
    await idbPut(LAST_PROJECT_KEY, makeProjectSnapshot());
    setProjectStatus(`Проект сохранён: ${new Date().toLocaleString()}.`);
  } catch (error) {
    console.error(error);
    setProjectStatus('Не получилось сохранить проект. Возможно, файлы слишком большие для хранилища браузера.');
  }
}

function setProjectStatus(text) {
  if (els.projectStatus) els.projectStatus.textContent = text;
}

async function loadProjectFromBrowser() {
  try {
    setProjectStatus('Открываю сохранённый проект…');
    const project = await idbGet(LAST_PROJECT_KEY);
    if (!project) {
      setProjectStatus('Сохранённого проекта в этом браузере пока нет.');
      return;
    }
    stopPreview(true);
    state.slides.forEach(revokeSlideUrls);
    state.slides = [];
    state.selectedIds.clear();
    state.lastSelectionAnchor = -1;
    state.selectedIndex = -1;

    if (project.settings) {
      els.formatSelect.value = project.settings.format || '1920x1080';
      els.customWidth.value = project.settings.customWidth || 1920;
      els.customHeight.value = project.settings.customHeight || 1080;
      els.fpsSelect.value = project.settings.fps || '30';
    }

    if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);
    state.audioFile = null;
    state.audioUrl = null;
    state.audioDuration = 0;
    els.audioPreview.removeAttribute('src');
    if (project.audio && project.audio.file) {
      state.audioFile = project.audio.file;
      state.audioUrl = URL.createObjectURL(project.audio.file);
      els.audioPreview.src = state.audioUrl;
      try {
        await waitForEvent(els.audioPreview, 'loadedmetadata', 8000);
        state.audioDuration = els.audioPreview.duration || project.audio.duration || 0;
      } catch (_) {
        state.audioDuration = project.audio.duration || 0;
      }
    }

    for (const item of project.slides || []) {
      try {
        const loaded = item.type === 'video' ? await loadVideoFromFile(item.file) : await loadImageFromFile(item.file);
        state.slides.push({
          id: item.id || uid(),
          file: item.file,
          name: item.name || item.file?.name || 'media',
          ...loaded,
          panX: Number(item.panX || 0),
          panY: Number(item.panY || 0),
          panStartX: Number(item.panStartX ?? item.panX ?? 0),
          panStartY: Number(item.panStartY ?? item.panY ?? 0),
          panEndX: Number(item.panEndX ?? item.panX ?? 0),
          panEndY: Number(item.panEndY ?? item.panY ?? 0),
          zoomStart: Number(item.zoomStart ?? 1),
          zoomEnd: Number(item.zoomEnd ?? (loaded.type === 'video' ? 1 : 1.08)),
          duration: Number(item.duration || loaded.originalDuration || 4),
          backgroundMode: item.backgroundMode || 'cover',
          originalDuration: Number(item.originalDuration || loaded.originalDuration || 4),
          aiStatus: item.aiStatus || '',
          captionText: item.captionText || '',
          captionX: Number(item.captionX ?? 50),
          captionY: Number(item.captionY ?? 82),
          captionSize: Number(item.captionSize ?? 54),
          captionOpacity: Number(item.captionOpacity ?? 100),
          captionColor: item.captionColor || '#ffffff',
          captionBgMode: item.captionBgMode || 'none',
          captionBgOpacity: Number(item.captionBgOpacity ?? 45),
          darken: Number(item.darken ?? 0),
        });
      } catch (error) {
        console.warn('Cannot restore media', item.name, error);
      }
    }
    state.selectedIndex = state.slides.length ? 0 : -1;
    state.previewTimeOffset = 0;
    renderAll();
renderSelectionState();
    setProjectStatus(`Проект открыт. Кадров: ${state.slides.length}.`);
  } catch (error) {
    console.error(error);
    setProjectStatus('Не получилось открыть сохранённый проект.');
  }
}

async function deleteSavedProject() {
  try {
    await idbDelete(LAST_PROJECT_KEY);
    setProjectStatus('Сохранённый проект удалён из браузера.');
  } catch (error) {
    console.error(error);
    setProjectStatus('Не получилось удалить сохранение.');
  }
}

function findBytes(bytes, pattern, from = 0, to = bytes.length) {
  outer: for (let i = from; i <= to - pattern.length; i++) {
    for (let j = 0; j < pattern.length; j++) if (bytes[i + j] !== pattern[j]) continue outer;
    return i;
  }
  return -1;
}

function readVint(bytes, pos) {
  const first = bytes[pos];
  if (first === undefined) return null;
  let length = 1;
  let mask = 0x80;
  while (length <= 8 && !(first & mask)) { length++; mask >>= 1; }
  if (length > 8 || pos + length > bytes.length) return null;
  let value = BigInt(first & (mask - 1));
  let raw = BigInt(first);
  for (let i = 1; i < length; i++) {
    value = (value << 8n) | BigInt(bytes[pos + i]);
    raw = (raw << 8n) | BigInt(bytes[pos + i]);
  }
  const unknown = value === ((1n << BigInt(7 * length)) - 1n);
  return { length, value, unknown, raw };
}

function encodeVintSize(value, forcedLength = null) {
  let big = BigInt(Math.max(0, Math.round(Number(value))));
  let length = forcedLength || 1;
  if (!forcedLength) {
    while (length < 8 && big > ((1n << BigInt(7 * length)) - 2n)) length++;
  }
  const max = (1n << BigInt(7 * length)) - 2n;
  if (big > max) throw new Error('EBML size is too large');
  const bytes = new Uint8Array(length);
  for (let i = length - 1; i >= 0; i--) {
    bytes[i] = Number(big & 0xffn);
    big >>= 8n;
  }
  bytes[0] |= 1 << (8 - length);
  return bytes;
}

function createDurationElement(durationTicks) {
  const element = new Uint8Array(11);
  element[0] = 0x44;
  element[1] = 0x89;
  element[2] = 0x88;
  new DataView(element.buffer).setFloat64(3, durationTicks, false);
  return element;
}

function readUnsigned(bytes, pos, length) {
  let value = 0;
  for (let i = 0; i < length; i++) value = value * 256 + bytes[pos + i];
  return value;
}

async function fixWebmDuration(blob, durationMs) {
  if (!blob.type.includes('webm')) return blob;
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const infoId = [0x15, 0x49, 0xa9, 0x66];
  const infoPos = findBytes(bytes, infoId);
  if (infoPos < 0) return blob;
  const sizeInfo = readVint(bytes, infoPos + infoId.length);
  if (!sizeInfo || sizeInfo.unknown) return blob;

  const infoDataStart = infoPos + infoId.length + sizeInfo.length;
  const infoDataEnd = Math.min(bytes.length, infoDataStart + Number(sizeInfo.value));
  let timecodeScale = 1000000;
  const scalePos = findBytes(bytes, [0x2a, 0xd7, 0xb1], infoDataStart, infoDataEnd);
  if (scalePos >= 0) {
    const scaleSize = readVint(bytes, scalePos + 3);
    if (scaleSize && !scaleSize.unknown && Number(scaleSize.value) <= 8) {
      const scaleDataStart = scalePos + 3 + scaleSize.length;
      timecodeScale = readUnsigned(bytes, scaleDataStart, Number(scaleSize.value)) || timecodeScale;
    }
  }
  const durationTicks = (Number(durationMs) * 1000000) / timecodeScale;
  const durationElement = createDurationElement(durationTicks);

  let durationPos = findBytes(bytes, [0x44, 0x89], infoDataStart, infoDataEnd);
  let oldDurationLength = 0;
  if (durationPos >= 0) {
    const durSize = readVint(bytes, durationPos + 2);
    if (durSize && !durSize.unknown) oldDurationLength = 2 + durSize.length + Number(durSize.value);
  }

  let newInfoPayload;
  let newInfoPayloadSize;
  let deltaPayload;
  if (durationPos >= 0 && oldDurationLength > 0) {
    const before = bytes.slice(infoDataStart, durationPos);
    const after = bytes.slice(durationPos + oldDurationLength, infoDataEnd);
    newInfoPayloadSize = before.length + durationElement.length + after.length;
    newInfoPayload = new Uint8Array(newInfoPayloadSize);
    newInfoPayload.set(before, 0);
    newInfoPayload.set(durationElement, before.length);
    newInfoPayload.set(after, before.length + durationElement.length);
    deltaPayload = durationElement.length - oldDurationLength;
  } else {
    const oldPayload = bytes.slice(infoDataStart, infoDataEnd);
    newInfoPayloadSize = oldPayload.length + durationElement.length;
    newInfoPayload = new Uint8Array(newInfoPayloadSize);
    newInfoPayload.set(oldPayload, 0);
    newInfoPayload.set(durationElement, oldPayload.length);
    deltaPayload = durationElement.length;
  }

  let newInfoSizeBytes;
  try {
    newInfoSizeBytes = encodeVintSize(newInfoPayloadSize, sizeInfo.length);
  } catch (_) {
    newInfoSizeBytes = encodeVintSize(newInfoPayloadSize);
  }

  const beforeInfo = bytes.slice(0, infoPos);
  const afterInfo = bytes.slice(infoDataEnd);
  const newBytes = new Uint8Array(beforeInfo.length + infoId.length + newInfoSizeBytes.length + newInfoPayload.length + afterInfo.length);
  let cursor = 0;
  newBytes.set(beforeInfo, cursor); cursor += beforeInfo.length;
  newBytes.set(infoId, cursor); cursor += infoId.length;
  newBytes.set(newInfoSizeBytes, cursor); cursor += newInfoSizeBytes.length;
  newBytes.set(newInfoPayload, cursor); cursor += newInfoPayload.length;
  newBytes.set(afterInfo, cursor);

  return new Blob([newBytes], { type: blob.type });
}


function sanitizeAssetName(name, fallbackExt = '') {
  const original = String(name || 'asset');
  const dot = original.lastIndexOf('.');
  const rawBase = dot > 0 ? original.slice(0, dot) : original;
  const rawExt = dot > 0 ? original.slice(dot).toLowerCase() : fallbackExt;
  const base = rawBase
    .normalize('NFKD')
    .replace(/[\/:*?"<>|]+/g, '-')
    .replace(/[^\w\-.а-яА-ЯёЁ ]+/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 70) || 'asset';
  const ext = rawExt && /^\.[a-z0-9]{1,8}$/i.test(rawExt) ? rawExt : fallbackExt;
  return `${base}${ext}`;
}

function uniqueAssetName(usedNames, index, file, type) {
  const fallbackExt = type === 'video' ? '.mp4' : type === 'audio' ? '.mp3' : '.jpg';
  const clean = sanitizeAssetName(file?.name, fallbackExt);
  const dot = clean.lastIndexOf('.');
  const base = dot > 0 ? clean.slice(0, dot) : clean;
  const ext = dot > 0 ? clean.slice(dot) : fallbackExt;
  let candidate = `${String(index + 1).padStart(3, '0')}_${base}${ext}`;
  let counter = 2;
  while (usedNames.has(candidate)) {
    candidate = `${String(index + 1).padStart(3, '0')}_${base}_${counter}${ext}`;
    counter += 1;
  }
  usedNames.add(candidate);
  return candidate;
}

function outputNameForMp4(width, height) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `slideshow-${width}x${height}-${stamp}.mp4`;
}

function templateText(id) {
  const el = document.getElementById(id);
  return el ? el.textContent.replace(/^\n/, '') : '';
}

async function exportMp4Package() {
  if (!state.slides.length) {
    setExportStatus('Сначала добавь фото/видео.', 0);
    return;
  }
  if (!window.JSZip) {
    setExportStatus('Не загрузилась библиотека ZIP. Проверь интернет и обнови страницу Ctrl+F5.', 0);
    return;
  }
  const [width, height] = getOutputSize();
  const fps = Number(els.fpsSelect.value) || 30;
  const zip = new JSZip();
  const assets = zip.folder('assets');
  const usedNames = new Set();
  const slides = [];

  try {
    if (els.mp4PackageBtn) els.mp4PackageBtn.disabled = true;
    setExportStatus('Готовлю MP4-пакет…', 3);

    state.slides.forEach((slide, index) => {
      const assetName = uniqueAssetName(usedNames, index, slide.file, slide.type);
      assets.file(assetName, slide.file);
      slides.push({
        index,
        type: slide.type,
        name: slide.name,
        asset: assetName,
        width: slide.width,
        height: slide.height,
        duration: Number(slide.duration || slide.originalDuration || 4),
        originalDuration: Number(slide.originalDuration || slide.duration || 4),
        panX: Number(slide.panX || 0),
        panY: Number(slide.panY || 0),
        panStartX: Number(slide.panStartX ?? slide.panX ?? 0),
        panStartY: Number(slide.panStartY ?? slide.panY ?? 0),
        panEndX: Number(slide.panEndX ?? slide.panX ?? 0),
        panEndY: Number(slide.panEndY ?? slide.panY ?? 0),
        zoomStart: Number(slide.zoomStart ?? 1),
        zoomEnd: Number(slide.zoomEnd ?? (slide.type === 'video' ? 1 : 1.08)),
        backgroundMode: slide.backgroundMode || 'cover',
        aiStatus: slide.aiStatus || '',
        captionText: slide.captionText || '',
        captionX: Number(slide.captionX ?? 50),
        captionY: Number(slide.captionY ?? 82),
        captionSize: Number(slide.captionSize ?? 54),
        captionOpacity: Number(slide.captionOpacity ?? 100),
        captionColor: slide.captionColor || '#ffffff',
        captionBgMode: slide.captionBgMode || 'none',
        captionBgOpacity: Number(slide.captionBgOpacity ?? 45),
        darken: Number(slide.darken ?? 0),
      });
    });

    let audio = null;
    if (state.audioFile) {
      const audioName = uniqueAssetName(usedNames, state.slides.length, state.audioFile, 'audio');
      assets.file(audioName, state.audioFile);
      audio = {
        name: state.audioFile.name,
        asset: audioName,
        type: state.audioFile.type,
        duration: Number(state.audioDuration || 0),
      };
    }

    const project = {
      version: 4,
      exportedAt: new Date().toISOString(),
      app: 'Family Slideshow Maker',
      settings: {
        width,
        height,
        fps,
        format: els.formatSelect.value,
        outputName: outputNameForMp4(width, height),
      },
      audio,
      slides,
    };

    zip.file('project.json', JSON.stringify(project, null, 2));
    zip.file('render_mp4.py', templateText('mp4RendererPy'));
    zip.file('run_mp4_render.bat', templateText('mp4RunBat'));
    zip.file('install_ffmpeg_windows.bat', templateText('mp4InstallBat'));
    zip.file('README_MP4_RENDER.txt', templateText('mp4Readme'));

    const blob = await zip.generateAsync(
      { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
      (meta) => setExportStatus(`Упаковка MP4-пакета: ${Math.round(meta.percent)}%`, meta.percent)
    );

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.href = url;
    a.download = `slideshow-mp4-package-${stamp}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    setExportStatus('MP4-пакет скачан. Это запасной вариант: распакуй и запусти run_mp4_render.bat.', 100);
  } catch (error) {
    console.error(error);
    setExportStatus('Не удалось собрать MP4-пакет. Возможно, браузеру не хватает памяти для больших видео.', 0);
  } finally {
    if (els.mp4PackageBtn) els.mp4PackageBtn.disabled = false;
  }
}

function supportedMimeForExport(kind) {
  if (!window.MediaRecorder || !MediaRecorder.isTypeSupported) return '';
  const mp4Types = [
    'video/mp4;codecs="avc1.42E01E,mp4a.40.2"',
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs="avc1.640028,mp4a.40.2"',
    'video/mp4;codecs=avc1.640028,mp4a.40.2',
    'video/mp4;codecs=h264,aac',
    'video/mp4'
  ];
  const webmTypes = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm'
  ];
  return (kind === 'mp4' ? mp4Types : webmTypes).find((type) => MediaRecorder.isTypeSupported(type)) || '';
}

async function prepareVideosForExport() {
  const videos = state.slides.filter((slide) => slide.type === 'video' && slide.source);
  if (!videos.length) return;
  setExportStatus(`Подготавливаю видеофрагменты: 0/${videos.length}`, 3);
  for (let i = 0; i < videos.length; i += 1) {
    const video = videos[i].source;
    try {
      video.preload = 'auto';
      video.muted = true;
      video.playsInline = true;
      if (video.readyState < 2) {
        try { video.load(); } catch (_) {}
        await Promise.race([waitForEvent(video, 'loadeddata', 4000), sleep(1200)]).catch(() => {});
      }
      if (Number.isFinite(video.duration) && video.duration > 0) {
        video.currentTime = Math.min(0.01, Math.max(0, video.duration - 0.1));
        await Promise.race([waitForEvent(video, 'seeked', 2000), sleep(300)]).catch(() => {});
      }
      video.pause();
    } catch (_) {}
    setExportStatus(`Подготавливаю видеофрагменты: ${i + 1}/${videos.length}`, 3 + ((i + 1) / videos.length) * 7);
  }
}

async function exportVideo(kind = 'webm') {
  if (!state.slides.length) {
    setExportStatus('Сначала добавь фото/видео.', 0);
    return;
  }
  const total = totalDuration();
  if (!total) {
    setExportStatus('Не удалось посчитать длительность.', 0);
    return;
  }
  const isMp4 = kind === 'mp4';
  const mimeType = supportedMimeForExport(kind);
  if (!mimeType) {
    setExportStatus(isMp4
      ? 'Этот браузер не умеет прямой MP4-экспорт. Попробуй свежий Chrome/Edge или запасной MP4-пакет FFmpeg.'
      : 'Браузер не поддерживает WebM MediaRecorder. Попробуй Chrome/Edge.', 0);
    return;
  }

  stopPreview(false);
  const exportSettings = getExportSettings(kind);
  const { width, height, fps } = exportSettings;
  await prepareVideosForExport();
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = width;
  exportCanvas.height = height;
  const exportCtx = exportCanvas.getContext('2d');
  const videoStream = exportCanvas.captureStream(fps);
  const videoTrack = videoStream.getVideoTracks()[0];
  if (videoTrack) videoTrack.contentHint = 'motion';
  let audioContext = null;
  let audioSource = null;
  let mixedStream = new MediaStream(videoStream.getVideoTracks());

  try {
    if (state.audioFile) {
      setExportStatus('Готовлю аудио…', 2);
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      await audioContext.resume();
      const arrayBuffer = await state.audioFile.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
      const dest = audioContext.createMediaStreamDestination();
      audioSource = audioContext.createBufferSource();
      audioSource.buffer = audioBuffer;
      audioSource.connect(dest);
      dest.stream.getAudioTracks().forEach((track) => mixedStream.addTrack(track));
    }
  } catch (error) {
    console.warn(error);
    setExportStatus('Аудио не удалось добавить, экспортирую без музыки…', 5);
  }

  const chunks = [];
  let recorder;
  try {
    recorder = new MediaRecorder(mixedStream, {
      mimeType,
      videoBitsPerSecond: exportSettings.videoBitsPerSecond,
      audioBitsPerSecond: exportSettings.audioBitsPerSecond,
    });
  } catch (error) {
    console.error(error);
    setExportStatus(isMp4
      ? 'Не удалось запустить MP4-запись в этом браузере. Используй запасной MP4-пакет FFmpeg.'
      : 'Не удалось запустить WebM-запись.', 0);
    return;
  }

  if (els.mp4VideoBtn) els.mp4VideoBtn.disabled = true;
  if (els.exportBtn) els.exportBtn.disabled = true;
  if (els.mp4PackageBtn) els.mp4PackageBtn.disabled = true;
  setExportStatus(`${isMp4 ? 'MP4' : 'WebM'} · ${exportSettings.label}. Не закрывай вкладку…`, 0);
  state.isExporting = true;
  state.exportBlurCache.clear();
  state.exportStatusLastAt = 0;

  const done = new Promise((resolve, reject) => {
    recorder.ondataavailable = (event) => { if (event.data.size > 0) chunks.push(event.data); };
    recorder.onerror = () => reject(recorder.error || new Error('MediaRecorder error'));
    recorder.onstop = () => resolve();
  });

  recorder.start(1000);
  if (audioSource) audioSource.start();
  const startedAt = performance.now();
  const frameInterval = 1000 / fps;
  const totalFrames = Math.ceil(total * fps);
  const canvasTrack = videoStream.getVideoTracks()[0];

  for (let frameIndex = 0; frameIndex <= totalFrames; frameIndex += 1) {
    const t = Math.min(total, frameIndex / fps);
    const current = slideAtTime(t);
    prepareVideoForDraw(current.slide, current.localTime, true);
    drawSlide(exportCtx, current.slide, current.progress, width, height);
    if (canvasTrack && typeof canvasTrack.requestFrame === 'function') {
      try { canvasTrack.requestFrame(); } catch (_) {}
    }

    const now = performance.now();
    if (!state.exportStatusLastAt || now - state.exportStatusLastAt > 250 || frameIndex === totalFrames) {
      setExportStatus(`${isMp4 ? 'MP4' : 'WebM'}: ${formatTime(t)} / ${formatTime(total)} · ${width}×${height} · ${fps} fps`, (t / total) * 100);
      state.exportStatusLastAt = now;
    }

    if (frameIndex >= totalFrames) break;
    const nextFrameAt = startedAt + (frameIndex + 1) * frameInterval;
    const delay = nextFrameAt - performance.now();
    if (delay > 2) await sleep(delay);
    else await new Promise((resolve) => requestAnimationFrame(resolve));
  }

  try { if (audioSource) audioSource.stop(); } catch (_) {}
  pauseAllVideos();
  state.isExporting = false;
  recorder.stop();
  await done;
  videoStream.getTracks().forEach((track) => track.stop());
  mixedStream.getTracks().forEach((track) => track.stop());
  if (audioContext) await audioContext.close();

  const rawBlob = new Blob(chunks, { type: mimeType });
  let blob = rawBlob;
  if (!isMp4) {
    try {
      blob = await fixWebmDuration(rawBlob, total * 1000);
    } catch (error) {
      console.warn('Cannot fix WebM duration', error);
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  a.href = url;
  a.download = `slideshow-${width}x${height}-${stamp}.${isMp4 ? 'mp4' : 'webm'}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  if (els.mp4VideoBtn) els.mp4VideoBtn.disabled = false;
  if (els.exportBtn) els.exportBtn.disabled = false;
  if (els.mp4PackageBtn) els.mp4PackageBtn.disabled = false;
  state.exportBlurCache.clear();
  setExportStatus(isMp4 ? `Готово. MP4 скачан: ${width}×${height}, ${fps} fps, ${(exportSettings.videoBitsPerSecond / 1000000).toFixed(1)} Mbps.` : 'Готово. WebM-черновик скачан.', 100);
}

els.mediaInput.addEventListener('change', (event) => addFiles(event.target.files));
els.dropzone.addEventListener('dragover', (event) => { event.preventDefault(); els.dropzone.classList.add('dragover'); });
els.dropzone.addEventListener('dragleave', () => els.dropzone.classList.remove('dragover'));
els.dropzone.addEventListener('drop', (event) => {
  event.preventDefault();
  els.dropzone.classList.remove('dragover');
  addFiles(event.dataTransfer.files);
});

els.audioInput.addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (!file) return;
  state.audioFile = file;
  if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);
  state.audioUrl = URL.createObjectURL(file);
  els.audioPreview.src = state.audioUrl;
  els.audioPreview.onloadedmetadata = () => {
    state.audioDuration = els.audioPreview.duration || 0;
    fitToMusic(false);
    renderAll();
renderSelectionState();
  };
});

[els.panX, els.panY, els.zoomStart, els.zoomEnd, els.duration, els.backgroundMode, els.captionText, els.captionX, els.captionY, els.captionSize, els.captionOpacity, els.captionColor, els.captionBgMode, els.captionBgOpacity, els.darken].forEach((el) => {
  if (!el) return;
  el.addEventListener('input', () => applyControlChange(el.id));
  el.addEventListener('change', () => applyControlChange(el.id));
});

els.positionStartBtn?.addEventListener('click', () => setPositionEditMode('start', true));
els.positionEndBtn?.addEventListener('click', () => setPositionEditMode('end', true));

els.resetSlideBtn.addEventListener('click', () => {
  const slide = selectedSlide();
  if (!slide) return;
  setBothPan(slide, 0, 0);
  slide.zoomStart = 1;
  slide.zoomEnd = slide.type === 'video' ? 1 : 1.08;
  slide.backgroundMode = 'cover';
  syncControls();
  drawCurrentPreview();
});

els.fitWholeBtn.addEventListener('click', () => {
  const slide = selectedSlide();
  if (!slide) return;
  setBothPan(slide, 0, 0);
  slide.zoomStart = 1;
  slide.zoomEnd = 1;
  slide.backgroundMode = 'containBlur';
  syncControls();
  drawCurrentPreview();
});

els.coverBtn.addEventListener('click', () => {
  const slide = selectedSlide();
  if (!slide) return;
  slide.backgroundMode = 'cover';
  slide.zoomStart = Math.max(1, Number(slide.zoomStart));
  slide.zoomEnd = Math.max(1, Number(slide.zoomEnd));
  syncControls();
  drawCurrentPreview();
});

els.softZoomBtn.addEventListener('click', () => {
  const slide = selectedSlide();
  if (!slide) return;
  slide.zoomStart = Math.max(0.25, Number(slide.zoomStart));
  slide.zoomEnd = Math.min(4, Number(slide.zoomStart) + 0.08);
  syncControls();
  drawCurrentPreview();
});


els.aiAutoForNew?.addEventListener('change', () => {
  state.aiAutoForNew = Boolean(els.aiAutoForNew.checked);
  setAiStatus(state.aiAutoForNew ? 'AI будет автоматически обрабатывать новые кадры.' : 'AI авто-обработка новых кадров выключена.');
});
els.aiSelectedBtn?.addEventListener('click', () => {
  const slide = selectedSlide();
  if (!slide) return;
  smartCropIndices([state.selectedIndex], 'AI выбранный').catch((error) => {
    console.warn(error);
    setAiStatus('AI выбранного кадра не сработал.');
  });
});
els.aiAllBtn?.addEventListener('click', () => {
  smartCropIndices(state.slides.map((_, index) => index), 'AI все').catch((error) => {
    console.warn(error);
    setAiStatus('AI обработка всех кадров не сработала.');
  });
});
els.verticalBgBtn?.addEventListener('click', applyVerticalBackgroundToAll);


function getCanvasPointerDelta(event) {
  const rect = els.previewCanvas.getBoundingClientRect();
  const scaleX = els.previewCanvas.width / Math.max(1, rect.width);
  const scaleY = els.previewCanvas.height / Math.max(1, rect.height);
  return { x: event.clientX, y: event.clientY, scaleX, scaleY };
}

function nudgeActivePanByPixels(slide, dxPixels, dyPixels) {
  if (!slide) return;
  const progress = selectedSlideProgress();
  const width = els.previewCanvas.width;
  const height = els.previewCanvas.height;
  const sourceWidth = slide.type === 'video' ? (slide.source.videoWidth || slide.width) : slide.width;
  const sourceHeight = slide.type === 'video' ? (slide.source.videoHeight || slide.height) : slide.height;
  const containModes = new Set(['containBlur', 'containBlack', 'freeBlack']);
  const baseScale = containModes.has(slide.backgroundMode) ? Math.min(width / sourceWidth, height / sourceHeight) : Math.max(width / sourceWidth, height / sourceHeight);
  const zoom = state.positionEditMode === 'end' ? Number(slide.zoomEnd || 1) : Number(slide.zoomStart || 1);
  const drawW = sourceWidth * baseScale * zoom;
  const drawH = sourceHeight * baseScale * zoom;
  const freeX = Math.max(1, Math.abs(drawW - width) / 2);
  const freeY = Math.max(1, Math.abs(drawH - height) / 2);
  const pan = activePan(slide);
  setActivePan(slide, pan.x + (dxPixels / freeX) * 100, pan.y + (dyPixels / freeY) * 100);
}

els.previewCanvas?.addEventListener('wheel', (event) => {
  const slide = selectedSlide();
  if (!slide) return;
  event.preventDefault();
  const localProgress = selectedSlideProgress();
  syncPositionModeFromProgress(localProgress);
  const direction = event.deltaY < 0 ? 1 : -1;
  const factor = direction > 0 ? 1.035 : 0.965;
  if (state.positionEditMode === 'end') {
    slide.zoomEnd = clamp(Number(slide.zoomEnd || 1) * factor, 0.25, 4);
  } else {
    slide.zoomStart = clamp(Number(slide.zoomStart || 1) * factor, 0.25, 4);
  }
  syncControls();
  drawCurrentPreview();
}, { passive: false });

els.previewCanvas?.addEventListener('pointerdown', (event) => {
  const slide = selectedSlide();
  if (!slide) return;
  event.preventDefault();
  syncPositionModeFromProgress(selectedSlideProgress());
  state.draggingPreview = true;
  state.lastPointerX = event.clientX;
  state.lastPointerY = event.clientY;
  els.previewCanvas.setPointerCapture?.(event.pointerId);
  els.previewCanvas.classList.add('dragging');
});

els.previewCanvas?.addEventListener('pointermove', (event) => {
  const slide = selectedSlide();
  if (!slide || !state.draggingPreview) return;
  event.preventDefault();
  const rect = els.previewCanvas.getBoundingClientRect();
  const dx = (event.clientX - state.lastPointerX) * (els.previewCanvas.width / Math.max(1, rect.width));
  const dy = (event.clientY - state.lastPointerY) * (els.previewCanvas.height / Math.max(1, rect.height));
  state.lastPointerX = event.clientX;
  state.lastPointerY = event.clientY;
  nudgeActivePanByPixels(slide, dx, dy);
  syncControls();
  drawCurrentPreview();
});

function stopPreviewDrag(event) {
  state.draggingPreview = false;
  els.previewCanvas?.classList.remove('dragging');
  if (event?.pointerId !== undefined) els.previewCanvas?.releasePointerCapture?.(event.pointerId);
}
els.previewCanvas?.addEventListener('pointerup', stopPreviewDrag);
els.previewCanvas?.addEventListener('pointercancel', stopPreviewDrag);
els.previewCanvas?.addEventListener('pointerleave', () => {
  if (state.draggingPreview) stopPreviewDrag();
});


els.fitToMusicBtn.addEventListener('click', () => fitToMusic(true));
els.clearBtn.addEventListener('click', () => {
  stopPreview(true);
  state.slides.forEach(revokeSlideUrls);
  state.slides = [];
  state.selectedIds.clear();
  state.lastSelectionAnchor = -1;
  state.selectedIndex = -1;
  renderAll();
renderSelectionState();
});
els.playBtn.addEventListener('click', () => state.playing ? stopPreview(false) : startPreview());
els.stopBtn.addEventListener('click', () => stopPreview(true));
els.clipScrub?.addEventListener('input', () => setSelectedSlideProgress(Number(els.clipScrub.value) / 1000));
els.clipStartBtn?.addEventListener('click', () => setSelectedSlideProgress(0));
els.clipEndBtn?.addEventListener('click', () => setSelectedSlideProgress(0.999));
els.mp4VideoBtn?.addEventListener('click', () => exportVideo('mp4'));
els.exportBtn.addEventListener('click', () => exportVideo('webm'));
els.mp4PackageBtn?.addEventListener('click', exportMp4Package);
els.selectAllBtn?.addEventListener('click', selectAllOrNone);
els.deleteSelectedBtn?.addEventListener('click', deleteSelectedSlides);
els.saveProjectBtn?.addEventListener('click', saveProjectToBrowser);
els.loadProjectBtn?.addEventListener('click', loadProjectFromBrowser);
els.deleteSavedProjectBtn?.addEventListener('click', deleteSavedProject);
els.formatSelect.addEventListener('change', updatePreviewCanvasSize);
els.customWidth.addEventListener('input', updatePreviewCanvasSize);
els.customHeight.addEventListener('input', updatePreviewCanvasSize);
els.exportPreset?.addEventListener('change', () => {
  const settings = getExportSettings('mp4');
  setExportStatus(`Режим экспорта: ${settings.label}`, 0);
});

function isTypingOrControlTarget(target) {
  if (!target) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON' || target.isContentEditable;
}

document.addEventListener('keydown', (event) => {
  if (!state.slides.length || isTypingOrControlTarget(event.target) || event.ctrlKey || event.metaKey || event.altKey) return;
  const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
  if (!keys.includes(event.key)) return;
  event.preventDefault();
  const direction = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : -1;
  const currentIndex = state.selectedIndex >= 0 ? state.selectedIndex : 0;
  const nextIndex = Math.max(0, Math.min(state.slides.length - 1, currentIndex + direction));
  if (nextIndex === currentIndex) return;

  if (event.shiftKey) {
    const anchor = state.lastSelectionAnchor >= 0 ? state.lastSelectionAnchor : currentIndex;
    state.lastSelectionAnchor = anchor;
    const from = Math.min(anchor, nextIndex);
    const to = Math.max(anchor, nextIndex);
    for (let i = from; i <= to; i += 1) {
      const id = state.slides[i]?.id;
      if (id) state.selectedIds.add(id);
    }
    selectSlide(nextIndex, false);
  } else {
    selectSlide(nextIndex, true);
  }
});

renderAll();
renderSelectionState();
