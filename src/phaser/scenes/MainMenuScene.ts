import Phaser from 'phaser';
import { UI_THEME } from '../../theme';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import { CanvasUiFactory } from '../ui/CanvasUiFactory';
import type { MainMenuSceneData } from './scene-data';

const MENU_TOP = 88;
const TITLE_HEIGHT = 142;
const BUTTON_WIDTH = 360;
const BUTTON_HEIGHT = 72;
const BUTTON_GAP = 22;
const BUTTON_COUNT = 3;
const BUTTON_STACK_HEIGHT = BUTTON_HEIGHT * BUTTON_COUNT + BUTTON_GAP * (BUTTON_COUNT - 1);
const BUTTON_TOP_PADDING = 128;
const STATUS_HEIGHT = 96;
const STATUS_TOP_PADDING = 52;
const MENU_HEIGHT =
  TITLE_HEIGHT + BUTTON_TOP_PADDING + BUTTON_STACK_HEIGHT + STATUS_TOP_PADDING + STATUS_HEIGHT;

type LicenseLink = {
  label: string;
  purpose: string;
  url: string;
};

const LICENSE_LINKS: LicenseLink[] = [
  {
    label: 'ORC License',
    purpose: '게임룰 / PF2e Remaster 기반 규칙',
    url: 'https://downloads.paizo.com/ORC_License_FINAL.pdf',
  },
  {
    label: 'OpenAI Terms',
    purpose: 'Codex 소스코딩 / OpenAI 이미지 생성',
    url: 'https://openai.com/policies/row-terms-of-use/',
  },
  {
    label: 'Suno Terms',
    purpose: 'BGM / 사운드 에셋',
    url: 'https://suno.com/terms-of-service',
  },
  {
    label: 'xAI Terms',
    purpose: 'Grok 영상 에셋',
    url: 'https://x.ai/legal/terms-of-service',
  },
  {
    label: 'Phaser License',
    purpose: '게임 엔진',
    url: 'https://github.com/phaserjs/phaser/blob/master/LICENSE.md',
  },
  {
    label: 'rexUI License',
    purpose: 'Phaser UI 플러그인',
    url: 'https://github.com/rexrainbow/phaser3-rex-notes/blob/master/LICENSE',
  },
  {
    label: 'Node.js License',
    purpose: '런타임 / 서버 / 빌드 포함 요소',
    url: 'https://github.com/nodejs/node/blob/main/LICENSE',
  },
];

const LICENSE_INTRO_TEXT =
  '이 프로그램은 생성형 AI를 사용하여 만들어졌습니다. 상업적 이용을 목적으로 하지 않으며, 관련 라이선스와 서비스 약관을 지키기 위해 노력했습니다.';

/**
 * 자산 로딩이 끝난 뒤 사용자가 실제로 진입할 메인 메뉴를 보여주는 씬이다.
 * 현재 단계에서는 저장 슬롯, 카드 텍스트 툴, 라이선스 링크 진입을 제공한다.
 */
export class MainMenuScene extends Phaser.Scene {
  private readonly ui = new CanvasUiFactory(this);
  private licenseOverlay: HTMLDivElement | null = null;
  private licenseEscapeHandler: ((event: KeyboardEvent) => void) | null = null;

  constructor() {
    super({ key: 'MainMenuScene' });
  }

  /**
   * 메뉴 배경, 제목, 버튼과 로딩 결과 요약을 화면에 구성한다.
   */
  create(data: MainMenuSceneData): void {
    this.addBackground();
    this.addForegroundUi(data);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.removeLicenseOverlay();
    });
  }

  private addBackground(): void {
    this.ui.image({
      x: 0,
      y: 0,
      key: 'title-background',
      origin: { x: 0, y: 0 },
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
    });
    this.ui.panel({
      x: 0,
      y: 0,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      variant: 'menuBackdrop',
      origin: 0,
    });
    this.ui.panel({
      x: 0,
      y: 0,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      variant: 'menuShade',
      origin: 0,
    });
  }

  private addForegroundUi(data: MainMenuSceneData): void {
    this.ui.stack({
      x: 0,
      y: 0,
      width: GAME_WIDTH,
      height: MENU_HEIGHT,
      orientation: 'y',
      origin: 0,
      anchor: {
        left: 'left',
        top: `top+${MENU_TOP}`,
        width: '100%',
      },
      children: [
        {
          gameObject: this.createTitleGroup(),
          align: 'left-top',
          minWidth: GAME_WIDTH,
          minHeight: TITLE_HEIGHT,
          offsetOriginX: -0.5,
          offsetOriginY: -0.5,
        },
        {
          gameObject: this.createButtonLayout(),
          align: 'center-top',
          minWidth: BUTTON_WIDTH,
          minHeight: BUTTON_STACK_HEIGHT,
          padding: { top: BUTTON_TOP_PADDING },
        },
        {
          gameObject: this.createStatusGroup(data),
          align: 'left-top',
          minWidth: GAME_WIDTH,
          minHeight: STATUS_HEIGHT,
          offsetOriginX: -0.5,
          offsetOriginY: -0.5,
          padding: { top: STATUS_TOP_PADDING },
        },
      ],
    });
  }

  private createTitleGroup(): Phaser.GameObjects.Container {
    const group = this.ui.container({ width: GAME_WIDTH, height: TITLE_HEIGHT });
    const title = this.ui.text({
      x: GAME_WIDTH / 2,
      y: 30,
      text: 'ELVENBATTLE',
      variant: 'menuTitle',
      align: 'center',
      origin: 0.5,
    });
    const subtitle = this.ui.text({
      x: GAME_WIDTH / 2,
      y: 96,
      text: 'main menu',
      variant: 'menuSubtitle',
      align: 'center',
      origin: 0.5,
      alpha: 0.88,
    });

    group.add([title, subtitle]);
    return group;
  }

  private createButtonLayout(): Phaser.GameObjects.GameObject {
    return this.ui.stack({
      x: 0,
      y: 0,
      width: BUTTON_WIDTH,
      height: BUTTON_STACK_HEIGHT,
      orientation: 'y',
      origin: 0,
      gap: BUTTON_GAP,
      children: [
        {
          gameObject: this.createButton('Start Game', () => {
            this.scene.start('SaveSlotScene');
          }),
          align: 'center',
          minWidth: BUTTON_WIDTH,
          minHeight: BUTTON_HEIGHT,
        },
        {
          gameObject: this.createButton('Card Text Tool', () => {
            window.location.assign('/tools/card-text/');
          }),
          align: 'center',
          minWidth: BUTTON_WIDTH,
          minHeight: BUTTON_HEIGHT,
        },
        {
          gameObject: this.createButton('License', () => {
            this.showLicenseOverlay();
          }),
          align: 'center',
          minWidth: BUTTON_WIDTH,
          minHeight: BUTTON_HEIGHT,
        },
      ],
    });
  }

  private createButton(label: string, onClick: () => void): Phaser.GameObjects.Container {
    return this.ui.button({
      x: 0,
      y: 0,
      width: BUTTON_WIDTH,
      height: BUTTON_HEIGHT,
      label,
      enabled: true,
      onClick,
    });
  }

  private createStatusGroup(data: MainMenuSceneData): Phaser.GameObjects.Container {
    const statusText =
      data.failedCount > 0
        ? `Loaded ${data.loadedCount} assets, skipped ${data.failedCount}`
        : `Loaded ${data.loadedCount} assets`;

    const group = this.ui.container({ width: GAME_WIDTH, height: STATUS_HEIGHT });
    const status = this.ui.text({
      x: GAME_WIDTH / 2,
      y: 44,
      text: statusText,
      variant: 'menuStatus',
      align: 'center',
      origin: 0.5,
      alpha: 0.92,
    });
    const helper = this.ui.text({
      x: GAME_WIDTH / 2,
      y: 76,
      text: 'Start Game opens the save slot screen in this phase.',
      variant: 'helper',
      align: 'center',
      origin: 0.5,
      alpha: 0.9,
    });

    group.add([status, helper]);
    return group;
  }

  private showLicenseOverlay(): void {
    if (this.licenseOverlay) {
      this.licenseOverlay.focus();
      return;
    }

    const overlay = this.createLicenseOverlay();
    const mount = document.querySelector<HTMLDivElement>('#app') ?? document.body;
    mount.append(overlay);
    this.licenseOverlay = overlay;
    overlay.focus();
  }

  private removeLicenseOverlay(): void {
    this.licenseOverlay?.remove();
    this.licenseOverlay = null;

    if (this.licenseEscapeHandler) {
      document.removeEventListener('keydown', this.licenseEscapeHandler);
      this.licenseEscapeHandler = null;
    }
  }

  private createLicenseOverlay(): HTMLDivElement {
    const theme = UI_THEME.dom.licenseDialog;
    const overlay = document.createElement('div');
    overlay.tabIndex = -1;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'license-dialog-title');
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.zIndex = '20';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.padding = theme.overlayPadding;
    overlay.style.background = theme.overlayBackground;
    overlay.style.boxSizing = 'border-box';

    const panel = document.createElement('section');
    panel.style.width = 'min(760px, 100%)';
    panel.style.maxHeight = 'min(760px, 88vh)';
    panel.style.overflowY = 'auto';
    panel.style.padding = theme.panelPadding;
    panel.style.border = theme.panelBorder;
    panel.style.borderRadius = theme.panelRadius;
    panel.style.background = theme.panelBackground;
    panel.style.boxShadow = theme.panelShadow;
    panel.style.color = UI_THEME.colors.primary.css;
    panel.style.fontFamily = UI_THEME.fontFamily;
    panel.style.boxSizing = 'border-box';

    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.justifyContent = 'space-between';
    header.style.gap = theme.headerGap;
    header.style.marginBottom = theme.headerMarginBottom;

    const title = document.createElement('h2');
    title.id = 'license-dialog-title';
    title.textContent = 'License';
    title.style.margin = '0';
    title.style.fontSize = theme.titleFontSize;
    title.style.lineHeight = '1.2';

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.textContent = 'Close';
    closeButton.style.flex = '0 0 auto';
    closeButton.style.minHeight = theme.closeButtonHeight;
    closeButton.style.padding = theme.closeButtonPadding;
    closeButton.style.border = theme.closeButtonBorder;
    closeButton.style.borderRadius = theme.closeButtonRadius;
    closeButton.style.background = UI_THEME.surfaces.button.fill.css;
    closeButton.style.color = UI_THEME.colors.primary.css;
    closeButton.style.fontFamily = UI_THEME.fontFamily;
    closeButton.style.fontSize = theme.closeButtonFontSize;
    closeButton.style.cursor = 'pointer';
    closeButton.addEventListener('click', () => {
      this.removeLicenseOverlay();
    });

    header.append(title, closeButton);

    const intro = document.createElement('p');
    intro.textContent = LICENSE_INTRO_TEXT;
    intro.style.margin = theme.introMargin;
    intro.style.color = UI_THEME.colors.secondary.css;
    intro.style.fontSize = theme.introFontSize;
    intro.style.lineHeight = theme.introLineHeight;

    const list = document.createElement('ul');
    list.style.display = 'grid';
    list.style.gap = theme.listGap;
    list.style.margin = '0';
    list.style.padding = '0';
    list.style.listStyle = 'none';

    for (const licenseLink of LICENSE_LINKS) {
      const item = document.createElement('li');
      const link = document.createElement('a');
      const linkTitle = document.createElement('strong');
      const linkPurpose = document.createElement('span');
      const linkUrl = document.createElement('span');

      link.href = licenseLink.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.style.display = 'block';
      link.style.padding = theme.linkPadding;
      link.style.border = theme.linkBorder;
      link.style.borderRadius = theme.linkRadius;
      link.style.background = theme.linkBackground;
      link.style.color = UI_THEME.colors.primary.css;
      link.style.fontSize = theme.linkFontSize;
      link.style.lineHeight = theme.linkLineHeight;
      link.style.textDecoration = 'none';
      linkTitle.textContent = licenseLink.label;
      linkTitle.style.display = 'block';
      linkTitle.style.marginBottom = theme.linkTitleMarginBottom;
      linkTitle.style.fontSize = theme.linkTitleFontSize;
      linkTitle.style.color = UI_THEME.colors.primary.css;
      linkPurpose.textContent = licenseLink.purpose;
      linkPurpose.style.display = 'block';
      linkPurpose.style.marginBottom = theme.linkPurposeMarginBottom;
      linkPurpose.style.color = UI_THEME.colors.secondary.css;
      linkPurpose.style.fontSize = theme.linkPurposeFontSize;
      linkUrl.textContent = licenseLink.url;
      linkUrl.style.display = 'block';
      linkUrl.style.color = theme.linkUrlColor;
      linkUrl.style.fontSize = theme.linkUrlFontSize;
      linkUrl.style.overflowWrap = 'anywhere';
      link.append(linkTitle, linkPurpose, linkUrl);
      item.append(link);
      list.append(item);
    }

    panel.append(header, intro, list);
    overlay.append(panel);

    this.licenseEscapeHandler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        this.removeLicenseOverlay();
      }
    };
    document.addEventListener('keydown', this.licenseEscapeHandler);

    return overlay;
  }
}
