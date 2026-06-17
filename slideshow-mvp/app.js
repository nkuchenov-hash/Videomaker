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
};

const $ = (id) => document.getElementById(id);
const els = {
  photoInput: $('photoInput'), audioInput: $('audioInput'), dropzone: $('dropzone'),
  photoCount: $('photoCount'), audioDuration: $('audioDuration'), slideDuration: $('slideDuration'),
  fitToMusicBtn: $('fitToMusicBtn'), clearBtn: $('clearBtn'), slideList: $('slideList'),
  previewCanvas: $('previewCanvas'), emptyState: $('emptyState'), currentInfo: $('currentInfo'),
  playBtn: $('playBtn'), stopBtn: $('stopBtn'), previewProgress: $('previewProgress'), timeLabel: $('timeLabel'),
  panX: $('panX'), panY: $('panY'), zoomStart: $('zoomStart'), zoomEnd: $('zoomEnd'), duration: $('duration'),
  panXValue: $('panXValue'), panYValue: $('panYValue'), zoomStartValue: $('zoomStartValue'), zoomEndValue: $('zoomEndValue'), durationValue: $('durationValue'),
  backgroundMode: $('backgroundMode'), resetSlideBtn: $('resetSlideBtn'),
  resolutionSelect: $('resolutionSelect'), fpsSelect: $('fpsSelect'), exportBtn: $('exportBtn'),
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

async function loadImageFromFile(file) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  await img.decode();
  return { img, url };
}

async function addFiles(fileList) {
  const files = [...fileList].filter((file) => file.type.startsWith('image/'));
  for (const file of files) {
    try {
      const { img, url } = await loadImageFromFile(file);
      state.slides.push({
        id: uid(),
        file,
        url,
        image: img,
        name: file.name,
        width: img.naturalWidth,
        height: img.naturalHeight,
        panX: 0,
        panY: 0,
        zoomStart: 1,
        zoomEnd: 1.08,
        duration: state.audioDuration && state.slides.length >= 0 ? 4 : 4,
        backgroundMode: 'cover',
      });
    } catch (error) {
      console.warn('Cannot load image', file.name, error);
    }
  }
  if (state.selectedIndex === -1 && state.slides.length) state.selectedIndex = 0;
  if (state.audioDuration) fitToMusic(false);
  renderAll();
}

function fitToMusic(showMessage = true) {
  if (!state.slides.length || !state.audioDuration) return;
  const perSlide = Math.max(1, state.audioDuration / state.slides.length);
  state.slides.forEach((slide) => { slide.duration = perSlide; });
  if (showMessage) setExportStatus(`Готово: ${formatTime(state.audioDuration)} / ${state.slides.length} фото = ${perSlide.toFixed(1)} сек. на фото`, 0);
  renderAll();
}

function renderStats() {
  els.photoCount.textContent = state.slides.length;
  els.audioDuration.textContent = state.audioDuration ? formatTime(state.audioDuration) : '—';
  const per = state.slides.length ? totalDuration() / state.slides.length : 0;
  els.slideDuration.textContent = per ? `${per.toFixed(1)} c` : '—';
  els.timeLabel.textContent = `${formatTime(state.previewTimeOffset)} / ${formatTime(totalDuration())}`;
}

function renderSlideList() {
  els.slideList.innerHTML = '';
  if (!state.slides.length) {
    const empty = document.createElement('div');
    empty.className = 'slide-card';
    empty.textContent = 'Пока нет фото';
    els.slideList.appendChild(empty);
    return;
  }
  state.slides.forEach((slide, index) => {
    const card = document.createElement('div');
    card.className = `slide-card ${index === state.selectedIndex ? 'selected' : ''}`;
    card.draggable = true;
    card.innerHTML = `
      <img src="${slide.url}" alt="" />
      <span class="slide-title">
        <strong>${index + 1}. ${escapeHtml(slide.name)}</strong>
        <span>${slide.width}×${slide.height} · ${Number(slide.duration).toFixed(1)} сек.</span>
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
  [els.panX, els.panY, els.zoomStart, els.zoomEnd, els.duration, els.backgroundMode, els.resetSlideBtn].forEach((el) => { el.disabled = disabled; });
  if (!slide) return;
  els.panX.value = slide.panX;
  els.panY.value = slide.panY;
  els.zoomStart.value = slide.zoomStart;
  els.zoomEnd.value = slide.zoomEnd;
  els.duration.value = Math.max(1, Math.min(15, slide.duration));
  els.backgroundMode.value = slide.backgroundMode || 'cover';
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

function drawCurrentPreview() {
  if (!state.slides.length) {
    previewCtx.clearRect(0, 0, els.previewCanvas.width, els.previewCanvas.height);
    els.emptyState.style.display = 'grid';
    els.currentInfo.textContent = 'Загрузи фото, затем выбери кадр.';
    return;
  }
  els.emptyState.style.display = 'none';
  const current = slideAtTime(state.previewTimeOffset);
  drawSlide(previewCtx, current.slide, current.progress, els.previewCanvas.width, els.previewCanvas.height);
  els.currentInfo.textContent = `${current.index + 1}/${state.slides.length}: ${current.slide.name}`;
  const total = totalDuration();
  els.previewProgress.style.width = total ? `${Math.min(100, (state.previewTimeOffset / total) * 100)}%` : '0%';
  els.timeLabel.textContent = `${formatTime(state.previewTimeOffset)} / ${formatTime(total)}`;
}

function slideAtTime(time) {
  if (!state.slides.length) return { slide: null, index: -1, progress: 0 };
  let cursor = 0;
  for (let i = 0; i < state.slides.length; i++) {
    const duration = Math.max(0.1, Number(state.slides[i].duration || 0));
    if (time < cursor + duration || i === state.slides.length - 1) {
      return { slide: state.slides[i], index: i, progress: Math.max(0, Math.min(1, (time - cursor) / duration)) };
    }
    cursor += duration;
  }
  return { slide: state.slides[state.slides.length - 1], index: state.slides.length - 1, progress: 1 };
}

function drawSlide(ctx, slide, rawProgress, width, height) {
  ctx.save();
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#02030a';
  ctx.fillRect(0, 0, width, height);
  if (!slide || !slide.image) {
    ctx.restore();
    return;
  }
  const progress = ease(rawProgress);
  if (slide.backgroundMode === 'containBlur') drawBlurBackground(ctx, slide.image, width, height);

  const baseScale = slide.backgroundMode === 'containBlur'
    ? Math.min(width / slide.width, height / slide.height)
    : Math.max(width / slide.width, height / slide.height);
  const zoom = lerp(slide.zoomStart, slide.zoomEnd, progress);
  const scale = baseScale * zoom;
  const drawW = slide.width * scale;
  const drawH = slide.height * scale;
  const overflowX = Math.max(0, (drawW - width) / 2);
  const overflowY = Math.max(0, (drawH - height) / 2);
  const offsetX = (slide.panX / 100) * overflowX;
  const offsetY = (slide.panY / 100) * overflowY;
  const dx = (width - drawW) / 2 + offsetX;
  const dy = (height - drawH) / 2 + offsetY;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(slide.image, dx, dy, drawW, drawH);
  ctx.restore();
}

function drawBlurBackground(ctx, image, width, height) {
  const baseScale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const drawW = image.naturalWidth * baseScale;
  const drawH = image.naturalHeight * baseScale;
  ctx.save();
  ctx.filter = 'blur(28px) brightness(0.65) saturate(1.15)';
  ctx.drawImage(image, (width - drawW) / 2, (height - drawH) / 2, drawW, drawH);
  ctx.filter = 'none';
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

function renderAll() {
  renderStats();
  renderSlideList();
  syncControls();
  drawCurrentPreview();
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
  if (reset) state.previewTimeOffset = 0;
  drawCurrentPreview();
}

async function exportVideo() {
  if (!state.slides.length) {
    setExportStatus('Сначала добавь фото.', 0);
    return;
  }
  const total = totalDuration();
  if (!total) {
    setExportStatus('Не удалось посчитать длительность.', 0);
    return;
  }
  stopPreview(false);
  const [width, height] = els.resolutionSelect.value.split('x').map(Number);
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
    videoBitsPerSecond: width >= 1920 ? 12000000 : 7000000,
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
  a.download = `slideshow-${stamp}.webm`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  els.exportBtn.disabled = false;
  setExportStatus('Готово. Файл WebM скачан.', 100);
}

els.photoInput.addEventListener('change', (event) => addFiles(event.target.files));
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
  slide.zoomEnd = 1.08;
  slide.backgroundMode = 'cover';
  syncControls();
  drawCurrentPreview();
});
els.fitToMusicBtn.addEventListener('click', () => fitToMusic(true));
els.clearBtn.addEventListener('click', () => {
  stopPreview(true);
  state.slides.forEach((slide) => URL.revokeObjectURL(slide.url));
  state.slides = [];
  state.selectedIndex = -1;
  renderAll();
});
els.playBtn.addEventListener('click', () => state.playing ? stopPreview(false) : startPreview());
els.stopBtn.addEventListener('click', () => stopPreview(true));
els.exportBtn.addEventListener('click', exportVideo);

renderAll();
