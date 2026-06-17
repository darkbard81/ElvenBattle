import './styles.css';

const RUNTIME_FONT_FAMILY = 'CardTextRuntime';
const urlParams = new URLSearchParams(window.location.search);
const INITIAL_CARD_ID = urlParams.get('cardId');
const captureId = urlParams.get('captureId');
const isCaptureMode = urlParams.get('capture') === '1';

const COLOR_OPEN_TAG = '[color=';
const COLOR_CLOSE_TAG = '[/color]';
const ESC_OPEN_TAG = '[esc]';
const ESC_CLOSE_TAG = '[/esc]';
const TEXT_STROKE_SHADOW_DIRECTIONS = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
] as const;

declare global {
  interface Window {
    __CARD_TEXT_TOOL_READY?: boolean;
  }
}

type Ability = {
  id: string;
  category: string;
  name: string;
  text: string;
};

type Card = {
  id: string;
  name: string;
  abilities: Ability[];
};

type AssetImage = {
  name: string;
  path: string;
};

type TextAreaRegion = {
  type: 'text_area';
  x: number;
  y: number;
  width: number;
  height: number;
  cornerRadius: number;
  fill: string;
  opacity: number;
  stroke: string;
  fontFamily: string;
  fontFile: string;
  fontSize: number;
  titleFontSize: number;
  nameColor: string;
  titleColor: string;
  textColor: string;
  textStrokeColor: string;
  textStrokeWidth: number;
  paddingX: number;
  paddingY: number;
  description: string;
};

type EditorData = {
  canvas: {
    width: number;
    height: number;
  };
  assetBaseUrl: string;
  card: Card;
  abilityText: string;
  nameText: string;
  textArea: TextAreaRegion;
  nameTextArea: TextAreaRegion;
  artImages: AssetImage[];
  referenceImages: AssetImage[];
  selectedArtImage: string;
  selectedReferenceImage: string;
  artOffsetY: number;
};

type AreaKey = 'ability' | 'name';

type DragState =
  | {
      mode: 'move';
      pointerId: number;
      startX: number;
      startY: number;
      originalX: number;
      originalY: number;
    }
  | {
      mode: 'resize';
      pointerId: number;
      startX: number;
      startY: number;
      originalWidth: number;
      originalHeight: number;
    };

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('#app element not found');
}

app.innerHTML = `
  <main class="app">
    <section class="preview-shell" aria-label="카드 미리보기">
      <div class="stage" data-stage>
        <canvas class="render-ready-canvas" width="1" height="1" aria-hidden="true"></canvas>
        <img class="card-layer art-layer" data-art-image alt="selected card art" />
        <img class="card-layer reference-layer" data-reference-image alt="card frame reference" />
        <div class="text-area ability-text-area" data-area-key="ability" data-text-area>
          <div class="bbcode-preview" data-bbcode-preview></div>
          <span class="resize-handle" data-resize-handle aria-hidden="true"></span>
        </div>
        <div class="text-area name-text-area" data-area-key="name" data-name-text-area>
          <div class="bbcode-preview name-bbcode-preview" data-name-bbcode-preview></div>
          <span class="resize-handle" data-name-resize-handle aria-hidden="true"></span>
        </div>
      </div>
    </section>
    <aside class="panel">
      <h1>카드 텍스트 영역</h1>
      <div class="card-summary" data-card-summary></div>
      <div class="asset-controls">
        <div class="field">
          <label for="artImage">Art</label>
          <select id="artImage" data-art-select></select>
        </div>
        <div class="field">
          <label for="referenceImage">Reference</label>
          <select id="referenceImage" data-reference-select></select>
        </div>
        <div class="field">
          <label for="artOffsetY">Art Y</label>
          <input id="artOffsetY" data-art-offset-y type="number" step="1" />
        </div>
      </div>
      <pre class="text-preview" data-text-preview></pre>
      <div class="area-tabs" aria-label="편집 영역">
        <button type="button" data-area-tab="ability" class="active">어빌리티</button>
        <button type="button" data-area-tab="name">이름</button>
      </div>
      <div class="controls">
        <div class="field">
          <label for="x">X</label>
          <input id="x" data-field="x" type="number" min="0" step="1" />
        </div>
        <div class="field">
          <label for="y">Y</label>
          <input id="y" data-field="y" type="number" min="0" step="1" />
        </div>
        <div class="field">
          <label for="width">Width</label>
          <input id="width" data-field="width" type="number" min="120" step="1" />
        </div>
        <div class="field">
          <label for="height">Height</label>
          <input id="height" data-field="height" type="number" min="80" step="1" />
        </div>
      </div>
      <div class="actions">
        <button type="button" data-save>저장</button>
        <button type="button" data-generate>생성</button>
        <button type="button" data-generate-all>일괄생성</button>
        <button type="button" class="secondary" data-reset>기본값</button>
      </div>
      <p class="status" data-status></p>
    </aside>
  </main>
`;

const stage = mustQuery<HTMLDivElement>('[data-stage]');
const artImageElement = mustQuery<HTMLImageElement>('[data-art-image]');
const referenceImageElement = mustQuery<HTMLImageElement>('[data-reference-image]');
const textAreaElement = mustQuery<HTMLDivElement>('[data-text-area]');
const resizeHandle = mustQuery<HTMLSpanElement>('[data-resize-handle]');
const nameTextAreaElement = mustQuery<HTMLDivElement>('[data-name-text-area]');
const nameResizeHandle = mustQuery<HTMLSpanElement>('[data-name-resize-handle]');
const bbcodePreviewElement = mustQuery<HTMLDivElement>('[data-bbcode-preview]');
const nameBbcodePreviewElement = mustQuery<HTMLDivElement>('[data-name-bbcode-preview]');
const cardSummaryElement = mustQuery<HTMLDivElement>('[data-card-summary]');
const textPreviewElement = mustQuery<HTMLPreElement>('[data-text-preview]');
const statusElement = mustQuery<HTMLParagraphElement>('[data-status]');
const saveButton = mustQuery<HTMLButtonElement>('[data-save]');
const generateButton = mustQuery<HTMLButtonElement>('[data-generate]');
const generateAllButton = mustQuery<HTMLButtonElement>('[data-generate-all]');
const resetButton = mustQuery<HTMLButtonElement>('[data-reset]');
const artSelect = mustQuery<HTMLSelectElement>('[data-art-select]');
const referenceSelect = mustQuery<HTMLSelectElement>('[data-reference-select]');
const artOffsetYInput = mustQuery<HTMLInputElement>('[data-art-offset-y]');
const fields = {
  x: mustQuery<HTMLInputElement>('[data-field="x"]'),
  y: mustQuery<HTMLInputElement>('[data-field="y"]'),
  width: mustQuery<HTMLInputElement>('[data-field="width"]'),
  height: mustQuery<HTMLInputElement>('[data-field="height"]'),
};
const areaTabs = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-area-tab]'));

let editorData: EditorData | null = null;
let abilityArea: TextAreaRegion | null = null;
let nameArea: TextAreaRegion | null = null;
let defaultAbilityArea: TextAreaRegion | null = null;
let defaultNameArea: TextAreaRegion | null = null;
let selectedArtImage = '';
let selectedReferenceImage = '';
let artOffsetY = 0;
let defaultArtOffsetY = 0;
let currentCardId = INITIAL_CARD_ID ?? '';
let activeAreaKey: AreaKey = 'ability';
let dragState: DragState | null = null;

void initialize();

async function initialize(): Promise<void> {
  window.__CARD_TEXT_TOOL_READY = false;
  document.body.classList.toggle('capture', isCaptureMode);
  setBusy(true);
  setStatus('데이터를 불러오는 중입니다.');

  try {
    const initialData = await fetchEditorData({
      cardId: INITIAL_CARD_ID,
      captureId,
      artImage: urlParams.get('artImage'),
      referenceImage: urlParams.get('referenceImage'),
      artOffsetY: urlParams.get('artOffsetY'),
    });
    applyEditorData(initialData, { resetAreas: true, resetDefaults: true });
    if (!abilityArea) {
      throw new Error('Ability text area was not initialized.');
    }
    await loadRuntimeFont(abilityArea.fontFile);
    await document.fonts.ready;
    syncBBCodePreviews();
    bindEvents();
    setStatus('마우스로 흰색 영역을 드래그하거나 우하단 핸들로 크기를 조정할 수 있습니다.');
  } catch (error) {
    setStatus(formatError(error));
  } finally {
    setBusy(false);
  }
}

function bindEvents(): void {
  bindAreaDrag('ability', textAreaElement, resizeHandle);
  bindAreaDrag('name', nameTextAreaElement, nameResizeHandle);

  artSelect.addEventListener('change', () => {
    void selectArtImage(artSelect.value);
  });

  referenceSelect.addEventListener('change', () => {
    selectedReferenceImage = referenceSelect.value;
    renderImageLayers();
  });

  artOffsetYInput.addEventListener('input', () => {
    artOffsetY = readNumber(artOffsetYInput);
    renderImageLayers();
  });

  Object.values(fields).forEach((field) => {
    field.addEventListener('input', () => {
      const area = getActiveArea();
      if (!editorData || !area) {
        return;
      }

      area.x = clamp(readNumber(fields.x), 0, editorData.canvas.width - area.width);
      area.y = clamp(readNumber(fields.y), 0, editorData.canvas.height - area.height);
      area.width = clamp(readNumber(fields.width), 120, editorData.canvas.width - area.x);
      area.height = clamp(readNumber(fields.height), 48, editorData.canvas.height - area.y);
      renderAreas();
    });
  });

  areaTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const key = tab.dataset.areaTab;
      if (key === 'ability' || key === 'name') {
        setActiveArea(key);
      }
    });
  });

  saveButton.addEventListener('click', () => {
    void saveArea();
  });

  generateButton.addEventListener('click', () => {
    void generateCard();
  });

  generateAllButton.addEventListener('click', () => {
    void generateAllCards();
  });

  resetButton.addEventListener('click', () => {
    if (!defaultAbilityArea || !defaultNameArea) {
      return;
    }
    abilityArea = cloneArea(defaultAbilityArea);
    nameArea = cloneArea(defaultNameArea);
    artOffsetY = defaultArtOffsetY;
    renderImageLayers();
    renderAreas();
    setStatus('두 텍스트 영역을 기본 위치로 되돌렸습니다. 저장을 누르면 메타 파일에 반영됩니다.');
  });
}

function bindAreaDrag(
  key: AreaKey,
  areaElement: HTMLDivElement,
  handleElement: HTMLSpanElement,
): void {
  areaElement.addEventListener('pointerdown', (event) => {
    const area = getArea(key);
    if (!area || event.target === handleElement) {
      return;
    }

    setActiveArea(key);
    const point = toCanvasPoint(event);
    dragState = {
      mode: 'move',
      pointerId: event.pointerId,
      startX: point.x,
      startY: point.y,
      originalX: area.x,
      originalY: area.y,
    };
    areaElement.setPointerCapture(event.pointerId);
  });

  handleElement.addEventListener('pointerdown', (event) => {
    const area = getArea(key);
    if (!area) {
      return;
    }

    event.stopPropagation();
    setActiveArea(key);
    const point = toCanvasPoint(event);
    dragState = {
      mode: 'resize',
      pointerId: event.pointerId,
      startX: point.x,
      startY: point.y,
      originalWidth: area.width,
      originalHeight: area.height,
    };
    areaElement.setPointerCapture(event.pointerId);
  });

  areaElement.addEventListener('pointermove', (event) => {
    const area = getArea(key);
    if (!editorData || !area || !dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const point = toCanvasPoint(event);
    const deltaX = Math.round(point.x - dragState.startX);
    const deltaY = Math.round(point.y - dragState.startY);

    if (dragState.mode === 'move') {
      area.x = clamp(dragState.originalX + deltaX, 0, editorData.canvas.width - area.width);
      area.y = clamp(dragState.originalY + deltaY, 0, editorData.canvas.height - area.height);
    } else {
      area.width = clamp(dragState.originalWidth + deltaX, 120, editorData.canvas.width - area.x);
      area.height = clamp(dragState.originalHeight + deltaY, 48, editorData.canvas.height - area.y);
    }

    renderAreas();
  });

  areaElement.addEventListener('pointerup', (event) => finishDrag(event, areaElement));
  areaElement.addEventListener('pointercancel', (event) => finishDrag(event, areaElement));
}

function finishDrag(event: PointerEvent, areaElement: HTMLDivElement): void {
  if (dragState?.pointerId === event.pointerId) {
    dragState = null;
    areaElement.releasePointerCapture(event.pointerId);
  }
}

async function saveArea(): Promise<void> {
  if (!abilityArea || !nameArea) {
    return;
  }

  setBusy(true);
  setStatus('card_frame_meta.json에 텍스트 영역을 저장하는 중입니다.');

  try {
    const response = await postJson('/api/card-text-tool/save-area', {
      cardId: currentCardId,
      area: abilityArea,
      nameArea,
    });
    const result = (await response.json()) as { savedPath: string };
    setStatus(`${result.savedPath}에 저장했습니다.`);
  } catch (error) {
    setStatus(formatError(error));
  } finally {
    setBusy(false);
  }
}

async function generateCard(): Promise<void> {
  if (!abilityArea || !nameArea) {
    return;
  }

  setBusy(true);
  setStatus('텍스트 영역을 합성한 PNG를 생성하는 중입니다.');

  try {
    const result = await generateCardImage({
      cardId: currentCardId,
      artImage: selectedArtImage,
      area: cloneArea(abilityArea),
      nameArea: cloneArea(nameArea),
      referenceImage: selectedReferenceImage,
      artOffsetY,
    });
    setStatus(`생성 완료: ${result.outputPath}\n`);
    const link = document.createElement('a');
    link.className = 'output-link';
    link.href = `${result.outputUrl}?t=${Date.now()}`;
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.textContent = '생성된 PNG 열기';
    statusElement.append(link);
  } catch (error) {
    setStatus(formatError(error));
  } finally {
    setBusy(false);
  }
}

async function generateAllCards(): Promise<void> {
  if (!editorData || !abilityArea || !nameArea) {
    return;
  }

  const artImages = editorData.artImages;
  if (artImages.length === 0) {
    setStatus('일괄 생성할 art 이미지를 찾지 못했습니다.');
    return;
  }

  const area = cloneArea(abilityArea);
  const nameAreaSnapshot = cloneArea(nameArea);
  const referenceImage = selectedReferenceImage;
  const artOffsetYSnapshot = artOffsetY;

  setBusy(true);
  setStatus(`art list 전체를 생성하는 중입니다. 0 / ${artImages.length}`);

  const failures: string[] = [];
  let processed = 0;
  let successes = 0;
  let lastResult: { outputPath: string; outputUrl: string } | null = null;

  try {
    for (const artImage of artImages) {
      processed += 1;
      const cardId = cardIdFromAssetPath(artImage.path);

      try {
        const result = await generateCardImage({
          cardId,
          artImage: artImage.path,
          area,
          nameArea: nameAreaSnapshot,
          referenceImage,
          artOffsetY: artOffsetYSnapshot,
        });
        successes += 1;
        lastResult = result;
        setStatus(`일괄 생성 중입니다. ${processed} / ${artImages.length} (${cardId})`);
      } catch (error) {
        failures.push(`${cardId}: ${formatError(error)}`);
      }
    }

    if (failures.length === 0) {
      setStatus(`일괄 생성 완료: ${successes} / ${artImages.length}`);
    } else {
      setStatus(
        `일괄 생성 완료: ${successes} / ${artImages.length}, 실패 ${failures.length}건\n${failures.join('\n')}`,
      );
    }

    if (lastResult) {
      const link = document.createElement('a');
      link.className = 'output-link';
      link.href = `${lastResult.outputUrl}?t=${Date.now()}`;
      link.target = '_blank';
      link.rel = 'noreferrer';
      link.textContent = '마지막 생성된 PNG 열기';
      statusElement.append(link);
    }
  } finally {
    setBusy(false);
  }
}

async function generateCardImage(input: {
  cardId: string;
  artImage: string;
  area: TextAreaRegion;
  nameArea: TextAreaRegion;
  referenceImage: string;
  artOffsetY: number;
}): Promise<{ outputPath: string; outputUrl: string }> {
  const response = await postJson('/api/card-text-tool/generate', {
    cardId: input.cardId,
    area: input.area,
    nameArea: input.nameArea,
    artImage: input.artImage,
    referenceImage: input.referenceImage,
    artOffsetY: input.artOffsetY,
  });

  return (await response.json()) as { outputPath: string; outputUrl: string };
}

async function postJson(path: string, body: unknown): Promise<Response> {
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response;
}

async function fetchEditorData(input: {
  cardId?: string | null;
  captureId?: string | null;
  artImage?: string | null;
  referenceImage?: string | null;
  artOffsetY?: string | number | null;
}): Promise<EditorData> {
  const query = new URLSearchParams();
  setOptionalQueryParam(query, 'cardId', input.cardId);
  setOptionalQueryParam(query, 'captureId', input.captureId);
  setOptionalQueryParam(query, 'artImage', input.artImage);
  setOptionalQueryParam(query, 'referenceImage', input.referenceImage);
  setOptionalQueryParam(query, 'artOffsetY', input.artOffsetY);

  const response = await fetch(`/api/card-text-tool/data?${query.toString()}`);
  if (!response.ok) {
    throw new Error(await response.text());
  }

  return (await response.json()) as EditorData;
}

function applyEditorData(
  data: EditorData,
  options: { resetAreas: boolean; resetDefaults: boolean },
): void {
  editorData = data;
  currentCardId = data.card.id;
  if (options.resetAreas || !abilityArea || !nameArea) {
    abilityArea = cloneArea(data.textArea);
    nameArea = cloneArea(data.nameTextArea);
  }
  selectedArtImage = data.selectedArtImage;
  selectedReferenceImage = data.selectedReferenceImage;
  artOffsetY = data.artOffsetY;

  if (options.resetDefaults) {
    defaultArtOffsetY = data.artOffsetY;
    defaultAbilityArea = {
      ...cloneArea(data.textArea),
      x: 128,
      y: 1010,
      width: 768,
      height: 270,
    };
    defaultNameArea = cloneArea(data.nameTextArea);
  }

  renderCardText(data);
  renderAssetControls(data);
  renderImageLayers();
  renderAreas();
}

async function selectArtImage(artImage: string): Promise<void> {
  setBusy(true);
  setStatus('선택한 일러스트의 카드 정보를 불러오는 중입니다.');

  try {
    const nextCardId = cardIdFromAssetPath(artImage);
    const nextData = await fetchEditorData({
      cardId: nextCardId,
      artImage,
      referenceImage: selectedReferenceImage,
      artOffsetY,
    });
    applyEditorData(nextData, { resetAreas: false, resetDefaults: false });
    setStatus(`${nextData.card.name} / ${nextData.card.id} 정보를 반영했습니다.`);
  } catch (error) {
    setStatus(formatError(error));
  } finally {
    setBusy(false);
  }
}

function renderCardText(data: EditorData): void {
  cardSummaryElement.textContent = `${data.card.name} / ${data.card.id}`;
  renderActiveAreaFields();
  syncBBCodePreviews();
}

function renderAssetControls(data: EditorData): void {
  renderAssetOptions(artSelect, data.artImages, selectedArtImage);
  renderAssetOptions(referenceSelect, data.referenceImages, selectedReferenceImage);
  artOffsetYInput.value = String(artOffsetY);
}

function renderAssetOptions(
  select: HTMLSelectElement,
  images: AssetImage[],
  selectedPath: string,
): void {
  select.replaceChildren(
    ...images.map((image) => {
      const option = document.createElement('option');
      option.value = image.path;
      option.textContent = image.name;
      option.selected = image.path === selectedPath;
      return option;
    }),
  );
}

function renderImageLayers(): void {
  if (!editorData) {
    return;
  }

  artImageElement.src = toAssetUrl(editorData.assetBaseUrl, selectedArtImage);
  referenceImageElement.src = toAssetUrl(editorData.assetBaseUrl, selectedReferenceImage);

  const scaledArtOffsetY = editorData
    ? artOffsetY * (stage.clientHeight / editorData.canvas.height)
    : artOffsetY;

  artImageElement.style.transform = `translateY(${scaledArtOffsetY}px)`;
  artOffsetYInput.value = String(artOffsetY);
}

function renderAreas(): void {
  if (!editorData || !abilityArea || !nameArea) {
    return;
  }

  renderAreaElement(textAreaElement, abilityArea);
  renderAreaElement(nameTextAreaElement, nameArea);
  renderActiveAreaFields();

  requestAnimationFrame(syncBBCodePreviews);
}

function renderAreaElement(element: HTMLDivElement, area: TextAreaRegion): void {
  if (!editorData) {
    return;
  }

  const canvas = editorData.canvas;
  element.style.left = `${(area.x / canvas.width) * 100}%`;
  element.style.top = `${(area.y / canvas.height) * 100}%`;
  element.style.width = `${(area.width / canvas.width) * 100}%`;
  element.style.height = `${(area.height / canvas.height) * 100}%`;
  element.style.borderRadius = `${(area.cornerRadius / canvas.width) * 100}%`;
  element.style.padding = `${(area.paddingY / canvas.height) * stage.clientHeight}px ${
    (area.paddingX / canvas.width) * stage.clientWidth
  }px`;
  element.style.background = rgbaFromHex(area.fill, area.opacity);
  element.style.borderColor = area.stroke;
}

function renderActiveAreaFields(): void {
  const area = getActiveArea();
  if (!area) {
    return;
  }

  fields.x.value = String(area.x);
  fields.y.value = String(area.y);
  fields.width.value = String(area.width);
  fields.height.value = String(area.height);
  textAreaElement.classList.toggle('active', activeAreaKey === 'ability');
  nameTextAreaElement.classList.toggle('active', activeAreaKey === 'name');
  areaTabs.forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.areaTab === activeAreaKey);
  });
  textPreviewElement.textContent = getActiveTextPreview();
}

function setActiveArea(key: AreaKey): void {
  activeAreaKey = key;
  renderActiveAreaFields();
}

function getActiveArea(): TextAreaRegion | null {
  return getArea(activeAreaKey);
}

function getArea(key: AreaKey): TextAreaRegion | null {
  return key === 'ability' ? abilityArea : nameArea;
}

function getActiveTextPreview(): string {
  if (!editorData) {
    return '';
  }

  return activeAreaKey === 'ability' ? editorData.abilityText : editorData.nameText;
}

function syncBBCodePreviews(): void {
  syncAbilityBBCodePreview();
  syncNameBBCodePreview();
  requestAnimationFrame(() => {
    window.__CARD_TEXT_TOOL_READY = true;
  });
}

function syncAbilityBBCodePreview(): void {
  if (!editorData || !abilityArea) {
    return;
  }

  const fontSize = readScaledFontSize(abilityArea.fontSize);
  const lineSpacing = Math.max(1, Math.round(fontSize * 0.18));

  bbcodePreviewElement.style.fontFamily = RUNTIME_FONT_FAMILY;
  bbcodePreviewElement.style.fontSize = `${fontSize}px`;
  bbcodePreviewElement.style.fontWeight = '700';
  bbcodePreviewElement.style.color = abilityArea.textColor;
  bbcodePreviewElement.style.lineHeight = `${fontSize + lineSpacing}px`;
  bbcodePreviewElement.style.textAlign = 'left';
  bbcodePreviewElement.style.display = 'block';
  applyTextStroke(bbcodePreviewElement, abilityArea);

  renderInlineBBCode(bbcodePreviewElement, editorData.abilityText);
}

function syncNameBBCodePreview(): void {
  if (!editorData || !nameArea) {
    return;
  }

  const fontSize = readScaledFontSize(nameArea.fontSize);

  nameBbcodePreviewElement.style.fontFamily = RUNTIME_FONT_FAMILY;
  nameBbcodePreviewElement.style.fontSize = `${fontSize}px`;
  nameBbcodePreviewElement.style.fontWeight = '700';
  nameBbcodePreviewElement.style.color = nameArea.textColor;
  nameBbcodePreviewElement.style.lineHeight = `${Math.round(fontSize * 1.18)}px`;
  nameBbcodePreviewElement.style.textAlign = 'center';
  nameBbcodePreviewElement.style.display = 'flex';
  nameBbcodePreviewElement.style.alignItems = 'center';
  nameBbcodePreviewElement.style.justifyContent = 'center';
  applyTextStroke(nameBbcodePreviewElement, nameArea);

  renderInlineBBCode(nameBbcodePreviewElement, editorData.nameText);
}

function applyTextStroke(element: HTMLElement, area: TextAreaRegion): void {
  const strokeWidth = readScaledStrokeWidth(area.textStrokeWidth);
  const strokeColor = isSafeColor(area.textStrokeColor) ? area.textStrokeColor : 'transparent';

  if (strokeWidth <= 0 || strokeColor === 'transparent') {
    element.style.removeProperty('-webkit-text-stroke');
    element.style.removeProperty('-webkit-text-stroke-color');
    element.style.removeProperty('-webkit-text-stroke-width');
    element.style.textShadow = '';
    return;
  }

  element.style.setProperty('-webkit-text-stroke', `${strokeWidth}px ${strokeColor}`);
  element.style.textShadow = buildTextStrokeShadow(strokeWidth, strokeColor);
}

function buildTextStrokeShadow(strokeWidth: number, strokeColor: string): string {
  const offset = Math.max(1, Math.ceil(strokeWidth));
  return TEXT_STROKE_SHADOW_DIRECTIONS.map(
    ([x, y]) => `${x * offset}px ${y * offset}px 0 ${strokeColor}`,
  ).join(', ');
}

function readScaledFontSize(fontSize: number): number {
  if (!editorData) {
    return fontSize;
  }

  const stageRect = stage.getBoundingClientRect();
  const scale = stageRect.width / editorData.canvas.width;
  return Math.max(10, Math.round(fontSize * scale));
}

function readScaledStrokeWidth(strokeWidth: number): number {
  if (!Number.isFinite(strokeWidth) || strokeWidth <= 0) {
    return 0;
  }

  if (!editorData) {
    return strokeWidth;
  }

  const stageRect = stage.getBoundingClientRect();
  const scale = stageRect.width / editorData.canvas.width;
  return Number(Math.max(0.5, strokeWidth * scale).toFixed(2));
}

function renderInlineBBCode(target: HTMLElement, source: string): void {
  const fragment = document.createDocumentFragment();
  const colorStack: HTMLElement[] = [];
  const lowerSource = source.toLowerCase();
  let index = 0;

  const append = (node: Node): void => {
    const parent = colorStack[colorStack.length - 1];
    if (parent) {
      parent.append(node);
    } else {
      fragment.append(node);
    }
  };

  while (index < source.length) {
    if (lowerSource.startsWith(COLOR_OPEN_TAG, index)) {
      const tagEnd = source.indexOf(']', index);
      if (tagEnd !== -1) {
        const color = source.slice(index + COLOR_OPEN_TAG.length, tagEnd).trim();
        if (isSafeColor(color)) {
          const span = document.createElement('span');
          span.style.color = color;
          append(span);
          colorStack.push(span);
          index = tagEnd + 1;
          continue;
        }
      }
    }

    if (lowerSource.startsWith(COLOR_CLOSE_TAG, index)) {
      colorStack.pop();
      index += COLOR_CLOSE_TAG.length;
      continue;
    }

    if (lowerSource.startsWith(ESC_OPEN_TAG, index)) {
      index += ESC_OPEN_TAG.length;
      continue;
    }

    if (lowerSource.startsWith(ESC_CLOSE_TAG, index)) {
      index += ESC_CLOSE_TAG.length;
      continue;
    }

    if (source[index] === '\n') {
      append(document.createElement('br'));
      index += 1;
      continue;
    }

    const nextIndex = findNextBBCodeBoundary(lowerSource, index + 1);
    append(document.createTextNode(source.slice(index, nextIndex)));
    index = nextIndex;
  }

  target.replaceChildren(fragment);
}

function findNextBBCodeBoundary(source: string, fromIndex: number): number {
  const candidates = [
    source.indexOf(COLOR_OPEN_TAG, fromIndex),
    source.indexOf(COLOR_CLOSE_TAG, fromIndex),
    source.indexOf(ESC_OPEN_TAG, fromIndex),
    source.indexOf(ESC_CLOSE_TAG, fromIndex),
    source.indexOf('\n', fromIndex),
  ].filter((value) => value !== -1);

  if (candidates.length === 0) {
    return source.length;
  }

  return Math.min(...candidates);
}

function isSafeColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{3,8}$/i.test(value);
}

function toCanvasPoint(event: PointerEvent): { x: number; y: number } {
  if (!editorData) {
    return { x: 0, y: 0 };
  }

  const rect = stage.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * editorData.canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * editorData.canvas.height,
  };
}

function readNumber(input: HTMLInputElement): number {
  const value = Number(input.value);
  return Number.isFinite(value) ? Math.round(value) : 0;
}

function cloneArea(area: TextAreaRegion): TextAreaRegion {
  return { ...area };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(Math.round(value), min), max);
}

function rgbaFromHex(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(normalized)) {
    return `rgba(255, 255, 255, ${alpha})`;
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

async function loadRuntimeFont(fontFile: string): Promise<void> {
  const font = new FontFace(RUNTIME_FONT_FAMILY, `url("${encodeURI(`/${fontFile}`)}")`);
  await font.load();
  document.fonts.add(font);
}

function setBusy(isBusy: boolean): void {
  saveButton.disabled = isBusy;
  generateButton.disabled = isBusy;
  generateAllButton.disabled = isBusy;
  resetButton.disabled = isBusy;
}

function setStatus(message: string): void {
  statusElement.textContent = message;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function toAssetUrl(assetBaseUrl: string, projectPath: string): string {
  const normalizedBaseUrl = assetBaseUrl.startsWith('/')
    ? assetBaseUrl.replace(/\/+$/, '')
    : `/${assetBaseUrl.replace(/^\/+/, '')}`;

  return `${normalizedBaseUrl}/${projectPath.replace(/^\/+/, '')}`;
}

function setOptionalQueryParam(
  target: URLSearchParams,
  key: string,
  value: string | number | null | undefined,
): void {
  if (value !== null && value !== undefined && String(value) !== '') {
    target.set(key, String(value));
  }
}

function cardIdFromAssetPath(assetPath: string): string {
  const fileName = assetPath.split('/').pop() ?? assetPath;
  return fileName.replace(/\.(?:png|webp|jpe?g)$/i, '');
}

function mustQuery<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`${selector} element not found`);
  }
  return element;
}
