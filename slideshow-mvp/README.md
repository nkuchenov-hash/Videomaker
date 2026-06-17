# Family Slideshow Maker

Быстрое статическое веб-приложение для семейного слайдшоу.

## Что умеет

- загрузка фото и видео;
- загрузка музыки;
- авто-подгонка длительности фото под длину трека;
- видео остаются в общей последовательности кадров;
- форматы 16:9, 4:3, 1:1, 9:16 и свой размер;
- ручное кадрирование X/Y;
- зум от 0.25× до 4×;
- режимы заполнения/вписывания кадра;
- список кадров слева на одном уровне с предпросмотром;
- переключение кадров стрелками ↑/↓ и ←/→;
- Shift+клик и Shift+стрелки для выделения диапазона;
- удаление выбранных файлов пачкой;
- сохранение проекта локально в браузере;
- отдельный ползунок проверки выбранного кадра: начало, середина, конец, любой момент внутри кадра;
- экспорт WebM в браузере через Canvas + MediaRecorder.

## Как обновить на GitHub Pages

Загрузи файлы из этой папки в:

```text
https://github.com/nkuchenov-hash/Videomaker/upload/main/slideshow-mvp
```

Файлы для загрузки:

```text
index.html
styles.css
app.js
README.md
.nojekyll
```

После загрузки нажми `Commit changes`, подожди 1–2 минуты и обнови сайт через `Ctrl + F5`.

## Ограничение

Веб-версия экспортирует WebM. Для максимально совместимого MP4/H.264 под телевизоры лучше делать отдельный локальный/desktop экспорт через FFmpeg.


## MP4 / H.264 export

Browser WebM export is kept only as a quick draft preview. For final video use **Скачать пакет для MP4** in the app. The downloaded package contains:

- `project.json` with slideshow settings;
- `assets/` with your selected photos, videos and music;
- `render_mp4.py`;
- `run_mp4_render.bat`;
- `install_ffmpeg_windows.bat`.

Unzip the package and run `run_mp4_render.bat`. It renders a normal **MP4 / H.264 / AAC** file with FFmpeg, so video clips should keep full duration and the result should seek correctly in players and on TV.
