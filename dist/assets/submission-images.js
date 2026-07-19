import { requireSupabase } from './supabase-client.js';

export const SUBMISSION_IMAGE_BUCKET = 'submission-images';
export const SUBMISSION_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
const SUBMISSION_IMAGE_MAX_DIMENSIONS = { width: 1600, height: 900 };
const PREVIEW_DIMENSIONS = { width: 960, height: 540 };
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function sanitizeSegment(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';
}

function extensionForType(type) {
  if (type === 'image/png') {
    return 'png';
  }
  if (type === 'image/webp') {
    return 'webp';
  }
  return 'jpg';
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function blobFromCanvas(canvas, type, quality) {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not read that image file.'));
    };
    image.src = objectUrl;
  });
}

function createCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Image processing is not supported in this browser.');
  }
  return { canvas, context };
}

function resolveCropRect(width, height, cropState = {}) {
  const targetRatio =
    SUBMISSION_IMAGE_MAX_DIMENSIONS.width / SUBMISSION_IMAGE_MAX_DIMENSIONS.height;
  const sourceRatio = width / height;
  const zoom = clamp(Number(cropState.zoom) || 1, 1, 3);
  const panX = clamp(Number(cropState.x) || 0, -1, 1);
  const panY = clamp(Number(cropState.y) || 0, -1, 1);

  let baseWidth = width;
  let baseHeight = height;

  if (sourceRatio > targetRatio) {
    baseWidth = height * targetRatio;
  } else if (sourceRatio < targetRatio) {
    baseHeight = width / targetRatio;
  }

  const cropWidth = clamp(Math.round(baseWidth / zoom), 1, width);
  const cropHeight = clamp(Math.round(baseHeight / zoom), 1, height);
  const maxOffsetX = Math.max(0, width - cropWidth);
  const maxOffsetY = Math.max(0, height - cropHeight);

  return {
    cropWidth,
    cropHeight,
    offsetX: Math.round(maxOffsetX * ((1 - panX) / 2)),
    offsetY: Math.round(maxOffsetY * ((1 - panY) / 2)),
  };
}

async function renderCroppedBlob(image, cropState, dimensions, attempts) {
  const { canvas, context } = createCanvas(dimensions.width, dimensions.height);
  const { cropWidth, cropHeight, offsetX, offsetY } = resolveCropRect(
    image.naturalWidth,
    image.naturalHeight,
    cropState,
  );

  context.drawImage(
    image,
    offsetX,
    offsetY,
    cropWidth,
    cropHeight,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  let bestBlob = null;
  let bestType = 'image/jpeg';

  for (const [type, quality] of attempts) {
    const blob = await blobFromCanvas(canvas, type, quality);
    if (!blob) {
      continue;
    }
    bestBlob = blob;
    bestType = type;
    if (blob.size <= SUBMISSION_IMAGE_MAX_BYTES) {
      return { blob, type };
    }
  }

  if (!bestBlob) {
    throw new Error('Could not process that image.');
  }

  return { blob: bestBlob, type: bestType };
}

async function standardizeImage(file, cropState) {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error('Please upload a JPG, PNG, or WebP image.');
  }

  const image = await loadImage(file);
  const attempts = [
    ['image/webp', 0.9],
    ['image/webp', 0.82],
    ['image/webp', 0.72],
    ['image/jpeg', 0.86],
    ['image/jpeg', 0.76],
    ['image/jpeg', 0.66],
  ];
  const { blob, type } = await renderCroppedBlob(
    image,
    cropState,
    SUBMISSION_IMAGE_MAX_DIMENSIONS,
    attempts,
  );

  if (blob.size > SUBMISSION_IMAGE_MAX_BYTES) {
    throw new Error('Please choose a smaller image. We could not compress it under 2 MB.');
  }

  return { blob, type };
}

function buildStoragePath({ submitterId, contentType, title, mimeType }) {
  const extension = extensionForType(mimeType);
  const slug = sanitizeSegment(title);
  const stamp = `${Date.now()}-${crypto.randomUUID()}`;
  return `${submitterId}/${contentType}/${slug}-${stamp}.${extension}`;
}

function getCropStateFromForm(form) {
  return {
    x: Number(form?.querySelector('[name="image-crop-x"]')?.value || 0),
    y: Number(form?.querySelector('[name="image-crop-y"]')?.value || 0),
    zoom: Number(form?.querySelector('[name="image-crop-zoom"]')?.value || 1),
  };
}

function setFieldValue(form, name, value) {
  const field = form?.querySelector(`[name="${name}"]`);
  if (field) {
    field.value = value ?? '';
  }
}

function setRangeValue(root, role, value) {
  const field = root?.querySelector(`[data-role="${role}"]`);
  if (field) {
    field.value = String(value);
  }
}

function isFileObjectUrl(url) {
  return Boolean(url && url.startsWith('blob:'));
}

async function makePreviewUrlFromState(state) {
  if (!state.file || !state.editorImage?.naturalWidth || !state.editorImage?.naturalHeight) {
    return '';
  }

  const { blob } = await renderCroppedBlob(
    state.editorImage,
    state.crop,
    PREVIEW_DIMENSIONS,
    [['image/webp', 0.82], ['image/jpeg', 0.78]],
  );

  if (!blob) {
    return '';
  }

  return URL.createObjectURL(blob);
}

function buildController(form, options) {
  const root = form?.querySelector('[data-submission-image-field]');
  if (!root) {
    return null;
  }

  const fileInput = form.querySelector('[name="image-file"]');
  const removeInput = form.querySelector('[name="remove-image"]');
  const currentWrap = root.querySelector('[data-role="current"]');
  const currentPreview = root.querySelector('[data-role="current-preview"]');
  const removeButton = root.querySelector('[data-role="remove-image"]');
  const fileNameLabel = root.querySelector('[data-role="file-name"]');
  const editor = root.querySelector('[data-role="editor"]');
  const frame = root.querySelector('[data-role="frame"]');
  const editorImage = root.querySelector('[data-role="editor-image"]');
  const resetButton = root.querySelector('[data-role="reset-crop"]');
  const zoomControl = root.querySelector('[data-role="zoom"]');
  const panXControl = root.querySelector('[data-role="pan-x"]');
  const panYControl = root.querySelector('[data-role="pan-y"]');

  const state = {
    file: null,
    sourceUrl: '',
    previewUrl: '',
    crop: { x: 0, y: 0, zoom: 1 },
    editorImage,
    pendingPreviewJob: 0,
    dragging: null,
    resizeObserver: null,
  };

  function revokePreviewUrl() {
    if (isFileObjectUrl(state.previewUrl)) {
      URL.revokeObjectURL(state.previewUrl);
    }
    state.previewUrl = '';
  }

  function revokeSourceUrl() {
    if (isFileObjectUrl(state.sourceUrl)) {
      URL.revokeObjectURL(state.sourceUrl);
    }
    state.sourceUrl = '';
  }

  function syncCropFields() {
    setFieldValue(form, 'image-crop-x', state.crop.x);
    setFieldValue(form, 'image-crop-y', state.crop.y);
    setFieldValue(form, 'image-crop-zoom', state.crop.zoom);
    setRangeValue(root, 'zoom', state.crop.zoom);
    setRangeValue(root, 'pan-x', state.crop.x);
    setRangeValue(root, 'pan-y', state.crop.y);
  }

  function isMarkedForRemoval() {
    return removeInput?.value === 'true';
  }

  function setRemoveState(shouldRemove) {
    if (removeInput) {
      removeInput.value = shouldRemove ? 'true' : 'false';
    }
  }

  function updateFileNameLabel(file = state.file) {
    if (!fileNameLabel) {
      return;
    }
    fileNameLabel.textContent = file?.name || 'No file selected';
  }

  function applyImageTransform() {
    if (!frame || !editorImage?.naturalWidth || !editorImage?.naturalHeight) {
      return;
    }

    const frameWidth = frame.clientWidth || 1;
    const frameHeight = frame.clientHeight || Math.round(frameWidth * 9 / 16) || 1;
    const baseScale = Math.max(
      frameWidth / editorImage.naturalWidth,
      frameHeight / editorImage.naturalHeight,
    );
    const renderWidth = editorImage.naturalWidth * baseScale * state.crop.zoom;
    const renderHeight = editorImage.naturalHeight * baseScale * state.crop.zoom;
    const maxOffsetX = Math.max(0, (renderWidth - frameWidth) / 2);
    const maxOffsetY = Math.max(0, (renderHeight - frameHeight) / 2);
    const translateX = state.crop.x * maxOffsetX;
    const translateY = state.crop.y * maxOffsetY;

    editorImage.style.width = `${renderWidth}px`;
    editorImage.style.height = `${renderHeight}px`;
    editorImage.style.transform = `translate(calc(-50% + ${translateX}px), calc(-50% + ${translateY}px))`;
  }

  function notifyPreviewChange() {
    options?.onPreviewChange?.();
  }

  async function refreshPreviewUrl() {
    if (!state.file || isMarkedForRemoval()) {
      revokePreviewUrl();
      setFieldValue(form, 'image-preview-url', isMarkedForRemoval() ? '' : form.querySelector('[name="image-url"]')?.value || '');
      notifyPreviewChange();
      return;
    }

    const job = state.pendingPreviewJob + 1;
    state.pendingPreviewJob = job;

    try {
      const previewUrl = await makePreviewUrlFromState(state);
      if (job !== state.pendingPreviewJob) {
        if (isFileObjectUrl(previewUrl)) {
          URL.revokeObjectURL(previewUrl);
        }
        return;
      }

      revokePreviewUrl();
      state.previewUrl = previewUrl;
      setFieldValue(form, 'image-preview-url', previewUrl);
      notifyPreviewChange();
    } catch {
      setFieldValue(form, 'image-preview-url', '');
      notifyPreviewChange();
    }
  }

  function updateVisibility() {
    const existingUrl = form.querySelector('[name="image-url"]')?.value || '';
    const hasExisting = Boolean(existingUrl) && !isMarkedForRemoval() && !state.file;
    const hasRemovableImage = hasExisting || Boolean(state.file);
    currentWrap.hidden = !hasExisting;
    if (hasExisting) {
      currentPreview.src = existingUrl;
    }

    editor.hidden = !state.file;
    if (removeButton) {
      removeButton.hidden = !hasRemovableImage;
      removeButton.textContent = state.file ? 'Clear selected image' : 'Remove current image';
      removeButton.classList.toggle('submission-image-remove--danger', hasRemovableImage);
    }

    if (!state.file && !isMarkedForRemoval()) {
      setFieldValue(form, 'image-preview-url', existingUrl);
    }

    if (!state.file && isMarkedForRemoval()) {
      setFieldValue(form, 'image-preview-url', '');
    }

    updateFileNameLabel();
    notifyPreviewChange();
  }

  function setCrop(nextCrop) {
    state.crop = {
      x: clamp(Number(nextCrop.x) || 0, -1, 1),
      y: clamp(Number(nextCrop.y) || 0, -1, 1),
      zoom: clamp(Number(nextCrop.zoom) || 1, 1, 3),
    };
    syncCropFields();
    applyImageTransform();
    refreshPreviewUrl();
  }

  function resetCrop() {
    setCrop({ x: 0, y: 0, zoom: 1 });
  }

  function syncFromForm() {
    const existingUrl = form.querySelector('[name="image-url"]')?.value || '';
    const previewUrl = form.querySelector('[name="image-preview-url"]')?.value || existingUrl;
    const x = Number(form.querySelector('[name="image-crop-x"]')?.value || 0);
    const y = Number(form.querySelector('[name="image-crop-y"]')?.value || 0);
    const zoom = Number(form.querySelector('[name="image-crop-zoom"]')?.value || 1);

    if (!state.file) {
      revokePreviewUrl();
      state.previewUrl = isFileObjectUrl(previewUrl) ? previewUrl : '';
      if (!isFileObjectUrl(previewUrl)) {
        setFieldValue(form, 'image-preview-url', previewUrl);
      }
    }

    state.crop = {
      x: clamp(x, -1, 1),
      y: clamp(y, -1, 1),
      zoom: clamp(zoom, 1, 3),
    };
    syncCropFields();
    setRemoveState(isMarkedForRemoval());
    updateVisibility();
  }

  function clearSelectedFile() {
    state.file = null;
    editorImage.removeAttribute('src');
    editorImage.style.removeProperty('width');
    editorImage.style.removeProperty('height');
    editorImage.style.removeProperty('transform');
    revokeSourceUrl();
    revokePreviewUrl();
    if (fileInput) {
      fileInput.value = '';
    }
    state.pendingPreviewJob += 1;
    updateFileNameLabel(null);
  }

  function handleSelectedFile(file) {
    if (!file) {
      clearSelectedFile();
      syncFromForm();
      return;
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      clearSelectedFile();
      throw new Error('Please upload a JPG, PNG, or WebP image.');
    }

    state.file = file;
    revokeSourceUrl();
    state.sourceUrl = URL.createObjectURL(file);
    editorImage.onload = () => {
      applyImageTransform();
      refreshPreviewUrl();
    };
    editorImage.src = state.sourceUrl;
    setRemoveState(false);
    resetCrop();
    updateVisibility();
  }

  function handlePointerDown(event) {
    if (!state.file || event.target !== editorImage) {
      return;
    }

    event.preventDefault();
    const pointerId = event.pointerId;
    state.dragging = {
      pointerId,
      startX: event.clientX,
      startY: event.clientY,
      cropX: state.crop.x,
      cropY: state.crop.y,
    };
    frame.setPointerCapture(pointerId);
  }

  function handlePointerMove(event) {
    if (!state.dragging || state.dragging.pointerId !== event.pointerId || !frame) {
      return;
    }

    const frameWidth = frame.clientWidth || 1;
    const frameHeight = frame.clientHeight || 1;
    const deltaX = (event.clientX - state.dragging.startX) / (frameWidth / 2);
    const deltaY = (event.clientY - state.dragging.startY) / (frameHeight / 2);

    setCrop({
      x: state.dragging.cropX + deltaX,
      y: state.dragging.cropY + deltaY,
      zoom: state.crop.zoom,
    });
  }

  function stopDragging(event) {
    if (!state.dragging || state.dragging.pointerId !== event.pointerId) {
      return;
    }

    if (frame.hasPointerCapture(event.pointerId)) {
      frame.releasePointerCapture(event.pointerId);
    }
    state.dragging = null;
  }

  fileInput?.addEventListener('change', () => {
    try {
      handleSelectedFile(fileInput.files?.[0] || null);
    } catch (error) {
      clearSelectedFile();
      syncFromForm();
      options?.onError?.(error);
    }
  });

  removeButton?.addEventListener('click', () => {
    setRemoveState(true);
    clearSelectedFile();
    updateVisibility();
    refreshPreviewUrl();
  });

  zoomControl?.addEventListener('input', () => {
    setCrop({ ...state.crop, zoom: Number(zoomControl.value) });
  });

  panXControl?.addEventListener('input', () => {
    setCrop({ ...state.crop, x: Number(panXControl.value) });
  });

  panYControl?.addEventListener('input', () => {
    setCrop({ ...state.crop, y: Number(panYControl.value) });
  });

  resetButton?.addEventListener('click', resetCrop);
  frame?.addEventListener('pointerdown', handlePointerDown);
  frame?.addEventListener('pointermove', handlePointerMove);
  frame?.addEventListener('pointerup', stopDragging);
  frame?.addEventListener('pointercancel', stopDragging);

  if (typeof ResizeObserver === 'function' && frame) {
    state.resizeObserver = new ResizeObserver(() => {
      applyImageTransform();
    });
    state.resizeObserver.observe(frame);
  }

  syncFromForm();

  return {
    syncFromForm,
    clearSelectedFile,
    destroy() {
      state.resizeObserver?.disconnect();
      clearSelectedFile();
    },
  };
}

export function initSubmissionImageField(form, options = {}) {
  if (!form) {
    return null;
  }

  form.__submissionImageController?.destroy?.();
  const controller = buildController(form, options);
  form.__submissionImageController = controller;
  return controller;
}

export function syncSubmissionImageField(form) {
  form?.__submissionImageController?.syncFromForm?.();
}

export async function uploadSubmissionImage({
  file,
  submitterId,
  contentType,
  title,
  cropState,
}) {
  const { blob, type } = await standardizeImage(file, cropState);
  const path = buildStoragePath({
    submitterId,
    contentType,
    title,
    mimeType: type,
  });

  const supabase = requireSupabase();
  const { error: uploadError } = await supabase.storage
    .from(SUBMISSION_IMAGE_BUCKET)
    .upload(path, blob, {
      cacheControl: '3600',
      contentType: type,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Image upload failed: ${uploadError.message}`);
  }

  const { data } = supabase.storage
    .from(SUBMISSION_IMAGE_BUCKET)
    .getPublicUrl(path);

  return {
    image_path: path,
    image_url: data?.publicUrl || '',
  };
}

export async function attachSubmissionImage(payload, form, { submitterId, contentType }) {
  const file = form?.querySelector('input[name="image-file"]')?.files?.[0] || null;
  const removeImage = form?.querySelector('input[name="remove-image"]')?.value === 'true';
  delete payload.image_preview_url;

  if (removeImage) {
    payload.image_path = '';
    payload.image_url = '';
  }

  if (!file) {
    return payload;
  }

  const title = payload.title || payload.name || contentType;
  const uploaded = await uploadSubmissionImage({
    file,
    submitterId,
    contentType,
    title,
    cropState: getCropStateFromForm(form),
  });

  payload.image_path = uploaded.image_path;
  payload.image_url = uploaded.image_url;
  return payload;
}
