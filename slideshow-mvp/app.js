const state = {
  slides: [],
  selectedIndex: -1,
  audioFile: null,
  audioUrl: null,
  audioDuration: 0,
  playing: false,
  playStartedAt: 0,
  previewTimeOffset: 0,
  raf: null,
  activeVideoId: null,
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
  formatSelect: $('formatSelect'), customSizeBox: $('customSizeBox'), customWidth: $('customWidth'), customHeight: $('customHeight'), fpsSelect: $('fpsSelect'), exportBtn: $('exportBtn'),
  exportProgress: $('exportProgress'), exportStatusText: $('exportStatusText'), audioPreview: $('audioPreview'),
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

async function addFiles(fileList) {
  const files = [...fileList].filter((file) => file.type.startsWith('image/') || file.type.startsWith('video/'));
  if (!files.length) return;
  setExportStatus(`Загружаю ${files.length} файл(ов)…`, 0);
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
        zoomStart: 1,
        zoomEnd: loaded.type === 'video' ? 1 : 1.08,
        duration: loaded.type === 'video' ? loaded.originalDuration : 4,
        backgroundMode: 'cover',
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
    empty.className = 'slide-card';
    empty.textContent = 'Пока нет фото/видео';
    els.slideList.appendChild(empty);
    return;
  }
  state.slides.forEach((slide, index) => {
    const card = document.createElement('div');
    card.className = `slide-card ${index === state.selectedIndex ? 'selected' : ''}`;
    card.draggable = true;
    const thumbHtml = slide.thumbUrl
      ? `<img src="${slide.thumbUrl}" alt="" />`
      : `<span class="thumb-fallback">${slide.type === 'video' ? '▶' : 'IMG'}</span>`;
    const kind = slide.type === 'video' ? 'Видео' : 'Фото';
    card.innerHTML = `
      ${thumbHtml}
      <span class="slide-title">
        <strong>${index + 1}. ${escapeHtml(slide.name)}</strong>
        <span>${kind} · ${slide.width}×${slide.height} · ${Number(slide.duration).toFixed(1)} сек.</span>
      </span>
      <span class="slide-actions">
        <button type="button" title="Выше">↑</button>
        <button type="button" title="Ниже">↓</button>
      </span>
    `;
    card.addEventListener('click', (event) => {
      if (event.target.tagName === 'BUTTON') return;
      selectSlide(index);
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
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function moveSlide(from, to) {
  if (to < 0 || to >= state.slides.length || from === to) return;
  const [slide] = state.slides.splice(from, 1);
  state.slides.splice(to, 0, slide);
  if (state.selectedIndex === from) state.selectedIndex = to;
  else if (state.selectedIndex > from && state.selectedIndex <= to) state.selectedIndex -= 1;
  else if (state.selectedIndex < from && state.selectedIndex >= to) state.selectedIndex += 1;
  renderAll();
}

function selectSlide(index) {
  pauseAllVideos();
  state.selectedIndex = index;
  state.previewTimeOffset = timeAtSlide(index);
  syncControls();
  renderAll();
}

function timeAtSlide(index) {
  return state.slides.slice(0, index).reduce((sum, slide) => sum + Number(slide.duration || 0), 0);
}

function syncControls() {
  const slide = selectedSlide();
  const disabled = !slide;
  [els.panX, els.panY, els.zoomStart, els.zoomEnd, els.duration, els.backgroundMode, els.resetSlideBtn, els.fitWholeBtn, els.coverBtn, els.softZoomBtn].forEach((el) => { el.disabled = disabled; });
  if (!slide) {
    updateControlLabels();
    return;
  }
  els.panX.value = slide.panX;
  els.panY.value = slide.panY;
  els.zoomStart.value = slide.zoomStart;
  els.zoomEnd.value = slide.zoomEnd;
  els.duration.max = Math.max(60, Math.ceil(slide.duration * 2), Math.ceil((slide.originalDuration || 4) * 2));
  els.duration.value = Math.max(0.5, Math.min(Number(els.duration.max), slide.duration));
  els.backgroundMode.value = slide.backgroundMode || 'cover';
  els.videoHint.style.display = slide.type === 'video' ? 'block' : 'none';
  updateControlLabels();
}

function updateControlLabels() {
  const slide = selectedSlide();
  els.panXValue.textContent = slide ? slide.panX : '0';
  els.panYValue.textContent = slide ? slide.panY : '0';
  els.zoomStartValue.textContent = slide ? `${Number(slide.zoomStart).toFixed(2)}×` : '1.00×';
  els.zoomEndValue.textContent = slide ? `${Number(slide.zoomEnd).toFixed(2)}×` : '1.08×';
  els.durationValue.textContent = slide ? `${Number(slide.duration).toFixed(1)} сек.` : '—';
}

function applyControlChange() {
  const slide = selectedSlide();
  if (!slide) return;
  slide.panX = Number(els.panX.value);
  slide.panY = Number(els.panY.value);
  slide.zoomStart = Number(els.zoomStart.value);
  slide.zoomEnd = Number(els.zoomEnd.value);
  slide.duration = Number(els.duration.value);
  slide.backgroundMode = els.backgroundMode.value;
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

  if (slide.backgroundMode === 'containBlur') drawBlurBackground(ctx, source, sourceWidth, sourceHeight, width, height);

  let baseScale;
  if (slide.backgroundMode === 'cover') baseScale = Math.max(width / sourceWidth, height / sourceHeight);
  else baseScale = Math.min(width / sourceWidth, height / sourceHeight);

  const zoom = lerp(slide.zoomStart, slide.zoomEnd, progress);
  const scale = baseScale * zoom;
  const drawW = sourceWidth * scale;
  const drawH = sourceHeight * scale;
  const freeX = Math.max(0, Math.abs(drawW - width) / 2);
  const freeY = Math.max(0, Math.abs(drawH - height) / 2);
  const offsetX = (slide.panX / 100) * freeX;
  const offsetY = (slide.panY / 100) * freeY;
  const dx = (width - drawW) / 2 + offsetX;
  const dy = (height - drawH) / 2 + offsetY;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
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

async function exportVideo() {
  if (!state.slides.length) {
    setExportStatus('Сначала добавь фото/видео.', 0);
    return;
  }
  const total = totalDuration();
  if (!total) {
    setExportStatus('Не удалось посчитать длительность.', 0);
    return;
  }
  stopPreview(false);
  const [width, height] = getOutputSize();
  const fps = Number(els.fpsSelect.value);
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = width;
  exportCanvas.height = height;
  const exportCtx = exportCanvas.getContext('2d');
  const videoStream = exportCanvas.captureStream(fps);
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

  const mimeType = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm'
  ].find((type) => MediaRecorder.isTypeSupported(type));

  if (!mimeType) {
    setExportStatus('Браузер не поддерживает WebM MediaRecorder. Попробуй Chrome/Edge.', 0);
    return;
  }

  const chunks = [];
  const recorder = new MediaRecorder(mixedStream, {
    mimeType,
    videoBitsPerSecond: width >= 1920 || height >= 1920 ? 14000000 : 8000000,
    audioBitsPerSecond: 192000,
  });

  els.exportBtn.disabled = true;
  setExportStatus('Идёт экспорт в реальном времени. Не закрывай вкладку…', 0);

  const done = new Promise((resolve, reject) => {
    recorder.ondataavailable = (event) => { if (event.data.size > 0) chunks.push(event.data); };
    recorder.onerror = () => reject(recorder.error || new Error('MediaRecorder error'));
    recorder.onstop = () => resolve();
  });

  recorder.start(1000);
  if (audioSource) audioSource.start();
  const startedAt = performance.now();

  await new Promise((resolve) => {
    const frame = () => {
      const elapsed = (performance.now() - startedAt) / 1000;
      const t = Math.min(total, elapsed);
      const current = slideAtTime(t);
      prepareVideoForDraw(current.slide, current.localTime, true);
      drawSlide(exportCtx, current.slide, current.progress, width, height);
      setExportStatus(`Экспорт: ${formatTime(t)} / ${formatTime(total)}`, (t / total) * 100);
      if (elapsed >= total) {
        resolve();
        return;
      }
      requestAnimationFrame(frame);
    };
    frame();
  });

  try { if (audioSource) audioSource.stop(); } catch (_) {}
  pauseAllVideos();
  recorder.stop();
  await done;
  videoStream.getTracks().forEach((track) => track.stop());
  mixedStream.getTracks().forEach((track) => track.stop());
  if (audioContext) await audioContext.close();

  const blob = new Blob(chunks, { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  a.href = url;
  a.download = `slideshow-${width}x${height}-${stamp}.webm`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  els.exportBtn.disabled = false;
  setExportStatus('Готово. Файл WebM скачан.', 100);
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
  };
});

[els.panX, els.panY, els.zoomStart, els.zoomEnd, els.duration, els.backgroundMode].forEach((el) => {
  el.addEventListener('input', applyControlChange);
  el.addEventListener('change', applyControlChange);
});

els.resetSlideBtn.addEventListener('click', () => {
  const slide = selectedSlide();
  if (!slide) return;
  slide.panX = 0;
  slide.panY = 0;
  slide.zoomStart = 1;
  slide.zoomEnd = slide.type === 'video' ? 1 : 1.08;
  slide.backgroundMode = 'cover';
  syncControls();
  drawCurrentPreview();
});

els.fitWholeBtn.addEventListener('click', () => {
  const slide = selectedSlide();
  if (!slide) return;
  slide.panX = 0;
  slide.panY = 0;
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

els.fitToMusicBtn.addEventListener('click', () => fitToMusic(true));
els.clearBtn.addEventListener('click', () => {
  stopPreview(true);
  state.slides.forEach((slide) => {
    try { URL.revokeObjectURL(slide.url); } catch (_) {}
    if (slide.thumbUrl && slide.thumbUrl.startsWith('blob:')) {
      try { URL.revokeObjectURL(slide.thumbUrl); } catch (_) {}
    }
  });
  state.slides = [];
  state.selectedIndex = -1;
  renderAll();
});
els.playBtn.addEventListener('click', () => state.playing ? stopPreview(false) : startPreview());
els.stopBtn.addEventListener('click', () => stopPreview(true));
els.exportBtn.addEventListener('click', exportVideo);
els.formatSelect.addEventListener('change', updatePreviewCanvasSize);
els.customWidth.addEventListener('input', updatePreviewCanvasSize);
els.customHeight.addEventListener('input', updatePreviewCanvasSize);

renderAll();
