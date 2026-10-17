// 图片处理：压缩、缩略图、方向纠正、Word 用的小图、对象 URL 管理

const trackedURLs = new Set();

export function objectURL(blob) {
  const url = URL.createObjectURL(blob);
  trackedURLs.add(url);
  return url;
}

export function releaseObjectURLs() {
  for (const url of trackedURLs) {
    try { URL.revokeObjectURL(url); } catch { /* ignore */ }
  }
  trackedURLs.clear();
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image load failed'));
    img.src = src;
  });
}

async function loadBitmap(source) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(source, { imageOrientation: 'from-image' });
    } catch { /* try again without options */ }
    try {
      return await createImageBitmap(source);
    } catch { /* fall through */ }
  }
  const url = URL.createObjectURL(source);
  try {
    return await loadImage(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function draw(bitmap, maxEdge, cropSquare = false) {
  const sw = bitmap.width;
  const sh = bitmap.height;
  let sx = 0, sy = 0, sWidth = sw, sHeight = sh;
  if (cropSquare) {
    const side = Math.min(sw, sh);
    sx = (sw - side) / 2;
    sy = (sh - side) / 2;
    sWidth = side;
    sHeight = side;
  }
  const scale = Math.min(1, maxEdge / Math.max(sWidth, sHeight));
  const cw = Math.max(1, Math.round(sWidth * scale));
  const ch = Math.max(1, Math.round(sHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, sx, sy, sWidth, sHeight, 0, 0, cw, ch);
  return canvas;
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('toBlob failed')), 'image/jpeg', quality);
  });
}

/**
 * 处理用户拍摄/选择的照片
 * 主图长边 1600，缩略图 320 正方形（列表用）
 */
export async function compressPhoto(file, { maxEdge = 1600, quality = 0.82, thumbEdge = 320, thumbQuality = 0.72 } = {}) {
  const bitmap = await loadBitmap(file);
  const main = draw(bitmap, maxEdge, false);
  const thumb = draw(bitmap, thumbEdge, true);
  const blob = await canvasToBlob(main, quality);
  const thumbBlob = await canvasToBlob(thumb, thumbQuality);
  return { blob, thumb: thumbBlob, width: main.width, height: main.height, bytes: blob.size };
}

/** 导出 Word 时再压一次，控制文件大小 */
export async function shrinkBlob(blob, { maxEdge = 1400, quality = 0.85 } = {}) {
  const bitmap = await loadBitmap(blob);
  const canvas = draw(bitmap, maxEdge, false);
  return canvasToBlob(canvas, quality);
}
