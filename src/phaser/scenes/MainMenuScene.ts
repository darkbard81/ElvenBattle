import Phaser from 'phaser';
import { DEFAULT_FONT_FAMILY } from '../../theme';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import { createMenuButton } from '../ui/menu-button';
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
    this.add
      .image(0, 0, 'title-background')
      .setOrigin(0, 0)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x071018, 0.48).setOrigin(0, 0);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.12).setOrigin(0, 0);
  }

  private addForegroundUi(data: MainMenuSceneData): void {
    const root = this.rexUI.add.sizer(0, 0, GAME_WIDTH, MENU_HEIGHT, 'y', {
      origin: 0,
      anchor: {
        left: 'left',
        top: `top+${MENU_TOP}`,
        width: '100%',
      },
    });

    root.add(this.createTitleGroup(), {
      align: 'left-top',
      minWidth: GAME_WIDTH,
      minHeight: TITLE_HEIGHT,
      offsetOriginX: -0.5,
      offsetOriginY: -0.5,
    });
    root.add(this.createButtonLayout(), {
      align: 'center-top',
      minWidth: BUTTON_WIDTH,
      minHeight: BUTTON_STACK_HEIGHT,
      padding: { top: BUTTON_TOP_PADDING },
    });
    root.add(this.createStatusGroup(data), {
      align: 'left-top',
      minWidth: GAME_WIDTH,
      minHeight: STATUS_HEIGHT,
      offsetOriginX: -0.5,
      offsetOriginY: -0.5,
      padding: { top: STATUS_TOP_PADDING },
    });
    root.layout();
  }

  private createTitleGroup(): Phaser.GameObjects.Container {
    const group = this.add.container(0, 0);
    group.setSize(GAME_WIDTH, TITLE_HEIGHT);
    const title = this.add
      .text(GAME_WIDTH / 2, 30, 'ELVENBATTLE', {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '58px',
        fontStyle: '700',
        color: '#f5faf0',
        stroke: '#182e27',
        strokeThickness: 7,
        align: 'center',
      })
      .setOrigin(0.5);

    const subtitle = this.add
      .text(GAME_WIDTH / 2, 96, 'main menu', {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '26px',
        color: '#d9ebd1',
        align: 'center',
      })
      .setOrigin(0.5)
      .setAlpha(0.88);

    group.add([title, subtitle]);
    return group;
  }

  private createButtonLayout(): Phaser.GameObjects.GameObject {
    const buttonLayout = this.rexUI.add.sizer(0, 0, BUTTON_WIDTH, BUTTON_STACK_HEIGHT, 'y', {
      origin: 0,
      space: { item: BUTTON_GAP },
    });

    buttonLayout.add(
      this.createButton('Start Game', () => {
        this.scene.start('SaveSlotScene');
      }),
      {
        align: 'center',
        minWidth: BUTTON_WIDTH,
        minHeight: BUTTON_HEIGHT,
      },
    );

    buttonLayout.add(
      this.createButton('Card Text Tool', () => {
        window.location.assign('/tools/card-text/');
      }),
      {
        align: 'center',
        minWidth: BUTTON_WIDTH,
        minHeight: BUTTON_HEIGHT,
      },
    );

    buttonLayout.add(
      this.createButton('License', () => {
        this.showLicenseOverlay();
      }),
      {
        align: 'center',
        minWidth: BUTTON_WIDTH,
        minHeight: BUTTON_HEIGHT,
      },
    );

    return buttonLayout;
  }

  private createButton(label: string, onClick: () => void): Phaser.GameObjects.Container {
    return createMenuButton(this, {
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

    const group = this.add.container(0, 0);
    group.setSize(GAME_WIDTH, STATUS_HEIGHT);
    const status = this.add
      .text(GAME_WIDTH / 2, 44, statusText, {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '18px',
        color: '#d5e7d1',
        align: 'center',
      })
      .setOrigin(0.5)
      .setAlpha(0.92);

    const helper = this.add
      .text(GAME_WIDTH / 2, 76, 'Start Game opens the save slot screen in this phase.', {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: '16px',
        color: '#b7c9ba',
        align: 'center',
      })
      .setOrigin(0.5)
      .setAlpha(0.9);

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
    overlay.style.padding = '28px';
    overlay.style.background = 'rgba(0, 0, 0, 0.68)';
    overlay.style.boxSizing = 'border-box';

    const panel = document.createElement('section');
    panel.style.width = 'min(760px, 100%)';
    panel.style.maxHeight = 'min(760px, 88vh)';
    panel.style.overflowY = 'auto';
    panel.style.padding = '28px';
    panel.style.border = '1px solid rgba(218, 246, 211, 0.52)';
    panel.style.borderRadius = '8px';
    panel.style.background = 'rgba(7, 16, 24, 0.98)';
    panel.style.boxShadow = '0 22px 70px rgba(0, 0, 0, 0.5)';
    panel.style.color = '#f5fff0';
    panel.style.fontFamily = DEFAULT_FONT_FAMILY;
    panel.style.boxSizing = 'border-box';

    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.justifyContent = 'space-between';
    header.style.gap = '20px';
    header.style.marginBottom = '18px';

    const title = document.createElement('h2');
    title.id = 'license-dialog-title';
    title.textContent = 'License';
    title.style.margin = '0';
    title.style.fontSize = '32px';
    title.style.lineHeight = '1.2';

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.textContent = 'Close';
    closeButton.style.flex = '0 0 auto';
    closeButton.style.minHeight = '40px';
    closeButton.style.padding = '0 18px';
    closeButton.style.border = '1px solid rgba(218, 246, 211, 0.8)';
    closeButton.style.borderRadius = '6px';
    closeButton.style.background = '#1d3f31';
    closeButton.style.color = '#f5fff0';
    closeButton.style.fontFamily = DEFAULT_FONT_FAMILY;
    closeButton.style.fontSize = '18px';
    closeButton.style.cursor = 'pointer';
    closeButton.addEventListener('click', () => {
      this.removeLicenseOverlay();
    });

    header.append(title, closeButton);

    const intro = document.createElement('p');
    intro.textContent = LICENSE_INTRO_TEXT;
    intro.style.margin = '0 0 22px';
    intro.style.color = '#d9ebd1';
    intro.style.fontSize = '18px';
    intro.style.lineHeight = '1.65';

    const list = document.createElement('ul');
    list.style.display = 'grid';
    list.style.gap = '12px';
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
      link.style.padding = '14px 16px';
      link.style.border = '1px solid rgba(183, 201, 186, 0.36)';
      link.style.borderRadius = '6px';
      link.style.background = 'rgba(18, 33, 28, 0.84)';
      link.style.color = '#f5fff0';
      link.style.fontSize = '17px';
      link.style.lineHeight = '1.4';
      link.style.textDecoration = 'none';
      linkTitle.textContent = licenseLink.label;
      linkTitle.style.display = 'block';
      linkTitle.style.marginBottom = '4px';
      linkTitle.style.fontSize = '18px';
      linkTitle.style.color = '#f5fff0';
      linkPurpose.textContent = licenseLink.purpose;
      linkPurpose.style.display = 'block';
      linkPurpose.style.marginBottom = '6px';
      linkPurpose.style.color = '#d9ebd1';
      linkPurpose.style.fontSize = '15px';
      linkUrl.textContent = licenseLink.url;
      linkUrl.style.display = 'block';
      linkUrl.style.color = '#9fb6aa';
      linkUrl.style.fontSize = '13px';
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
