import './styles.css';
import Phaser from 'phaser';
import RexBBCodeText from 'phaser3-rex-plugins/plugins/bbcodetext';

const RUNTIME_FONT_FAMILY = 'CardTextRuntime';
const urlParams = new URLSearchParams(window.location.search);
const INITIAL_CARD_ID = urlParams.get('cardId');
const captureId = urlParams.get('captureId');
const isCaptureMode = urlParams.get('capture') === '1';

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
  paddingX: number;
  paddingY: number;
  description: string;
};

type EditorData = {
  canvas: {
    width: number;
    height: number;
  };
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
let bbcodeGame: Phaser.Game | null = null;
let bbcodeScene: Phaser.Scene | null = null;
let bbcodeTextObject: InstanceType<typeof RexBBCodeText> | null = null;
let nameBbcodeGame: Phaser.Game | null = null;
let nameBbcodeScene: Phaser.Scene | null = null;
let nameBbcodeTextObject: InstanceType<typeof RexBBCodeText> | null = null;

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
    createBBCodePreviews();
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
    const response = await postJson('/api/card-text-tool/generate', {
      cardId: currentCardId,
      area: abilityArea,
      nameArea,
      artImage: selectedArtImage,
      referenceImage: selectedReferenceImage,
      artOffsetY,
    });
    const result = (await response.json()) as { outputPath: string; outputUrl: string };
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
  artImageElement.src = toAssetUrl(selectedArtImage);
  referenceImageElement.src = toAssetUrl(selectedReferenceImage);
  artImageElement.style.transform = `translateY(${artOffsetY}px)`;
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

  return activeAreaKey === 'ability'
    ? editorData.abilityText
    : editorData.nameText;
}

function createBBCodePreviews(): void {
  createAbilityBBCodePreview();
  createNameBBCodePreview();
}

function createAbilityBBCodePreview(): void {
  if (bbcodeGame) {
    syncAbilityBBCodePreview();
    return;
  }

  const { width, height } = readPreviewSize(bbcodePreviewElement);
  class BBCodePreviewScene extends Phaser.Scene {
    constructor() {
      super('bbcode-preview');
    }

    create(): void {
      registerBBCodeScene(this);
      bbcodeTextObject = new RexBBCodeText(this, 0, 0, '', {
        fontFamily: RUNTIME_FONT_FAMILY,
        fontSize: '18px',
        fontStyle: '700',
        color: '#17251A',
      });
      this.add.existing(bbcodeTextObject);
      syncAbilityBBCodePreview();
    }
  }

  bbcodeGame = new Phaser.Game({
    type: Phaser.CANVAS,
    parent: bbcodePreviewElement,
    width,
    height,
    transparent: true,
    backgroundColor: 'rgba(0,0,0,0)',
    scene: BBCodePreviewScene,
    audio: {
      noAudio: true,
    },
  });
}

function createNameBBCodePreview(): void {
  if (nameBbcodeGame) {
    syncNameBBCodePreview();
    return;
  }

  const { width, height } = readPreviewSize(nameBbcodePreviewElement);
  class NameBBCodePreviewScene extends Phaser.Scene {
    constructor() {
      super('name-bbcode-preview');
    }

    create(): void {
      registerNameBBCodeScene(this);
      nameBbcodeTextObject = new RexBBCodeText(this, 0, 0, '', {
        fontFamily: RUNTIME_FONT_FAMILY,
        fontSize: '18px',
        fontStyle: '700',
        color: '#FFFFFF',
      });
      this.add.existing(nameBbcodeTextObject);
      syncNameBBCodePreview();
    }
  }

  nameBbcodeGame = new Phaser.Game({
    type: Phaser.CANVAS,
    parent: nameBbcodePreviewElement,
    width,
    height,
    transparent: true,
    backgroundColor: 'rgba(0,0,0,0)',
    scene: NameBBCodePreviewScene,
    audio: {
      noAudio: true,
    },
  });
}

function syncBBCodePreviews(): void {
  syncAbilityBBCodePreview();
  syncNameBBCodePreview();
  if (bbcodeTextObject && nameBbcodeTextObject) {
    requestAnimationFrame(() => {
      window.__CARD_TEXT_TOOL_READY = true;
    });
  }
}

function syncAbilityBBCodePreview(): void {
  if (!editorData || !abilityArea || !bbcodeGame || !bbcodeScene || !bbcodeTextObject) {
    return;
  }

  const { width, height } = readPreviewSize(bbcodePreviewElement);
  bbcodeGame.scale.resize(width, height);
  bbcodeScene.cameras.main.setSize(width, height);

  const stageRect = stage.getBoundingClientRect();
  const scale = stageRect.width / editorData.canvas.width;
  const fontSize = Math.max(10, Math.round(abilityArea.fontSize * scale));
  const lineSpacing = Math.max(1, Math.round(fontSize * 0.18));

  bbcodeTextObject
    .setText(editorData.abilityText)
    .setStyle({
      fontFamily: RUNTIME_FONT_FAMILY,
      fontSize: `${fontSize}px`,
      fontStyle: '700',
      color: abilityArea.textColor,
      fixedWidth: width,
      fixedHeight: height,
      lineSpacing,
    })
    .setFixedSize(width, height)
    .setWrapMode('char')
    .setWrapWidth(width)
    .setLineSpacing(lineSpacing)
    .updateText(true);
}

function syncNameBBCodePreview(): void {
  if (!editorData || !nameArea || !nameBbcodeGame || !nameBbcodeScene || !nameBbcodeTextObject) {
    return;
  }

  const { width, height } = readPreviewSize(nameBbcodePreviewElement);
  nameBbcodeGame.scale.resize(width, height);
  nameBbcodeScene.cameras.main.setSize(width, height);

  const stageRect = stage.getBoundingClientRect();
  const scale = stageRect.width / editorData.canvas.width;
  const fontSize = Math.max(10, Math.round(nameArea.fontSize * scale));
  nameBbcodeTextObject
    .setText(editorData.nameText)
    .setStyle({
      fontFamily: RUNTIME_FONT_FAMILY,
      fontSize: `${fontSize}px`,
      fontStyle: '700',
      color: nameArea.textColor,
      fixedWidth: width,
      fixedHeight: height,
      halign: 'center',
      valign: 'center',
    })
    .setFixedSize(width, height)
    .setWrapMode('char')
    .setWrapWidth(width)
    .updateText(true);
}

function registerBBCodeScene(scene: Phaser.Scene): void {
  bbcodeScene = scene;
}

function registerNameBBCodeScene(scene: Phaser.Scene): void {
  nameBbcodeScene = scene;
}

function readPreviewSize(element: HTMLElement): { width: number; height: number } {
  const rect = element.getBoundingClientRect();
  return {
    width: Math.max(1, Math.round(rect.width)),
    height: Math.max(1, Math.round(rect.height)),
  };
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
  resetButton.disabled = isBusy;
}

function setStatus(message: string): void {
  statusElement.textContent = message;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function toAssetUrl(projectPath: string): string {
  return projectPath.startsWith('/') ? projectPath : `/${projectPath}`;
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
