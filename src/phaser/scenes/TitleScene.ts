import Phaser from 'phaser';
import { AuthApiError } from '../../game/auth/client';
import { UI_THEME } from '../../theme';
import { DEFAULT_ASSET_BASE_URL, GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import { getGameServices } from '../services/game-services';
import { CanvasUiFactory } from '../ui/CanvasUiFactory';
import '../ui/title-login.css';
import type { LoaderSceneData, TitleSceneData } from './scene-data';

const TITLE_GROUP_HEIGHT = 260;

/** 타이틀 배경 위에서 계정 로그인과 신규 가입을 받는 첫 진입 Scene이다. */
export class TitleScene extends Phaser.Scene {
  private readonly ui = new CanvasUiFactory(this);
  private loginOverlay: HTMLDivElement | null = null;
  private idInput: HTMLInputElement | null = null;
  private passwordInput: HTMLInputElement | null = null;
  private statusElement: HTMLParagraphElement | null = null;
  private actionButtons: HTMLButtonElement[] = [];

  constructor() {
    super({ key: 'TitleScene' });
  }

  /** 배경과 DOM form을 구성하고 기존 쿠키 세션의 자동 복원을 시도한다. */
  create(data: TitleSceneData = {}): void {
    this.addBackground();
    this.addForegroundUi();
    this.createLoginForm();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.removeLoginForm());
    void this.restoreSession(data.statusMessage);
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
      variant: 'titleBackdrop',
      origin: 0,
    });
    this.ui.panel({
      x: 0,
      y: 0,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      variant: 'titleShade',
      origin: 0,
    });
  }

  private addForegroundUi(): void {
    this.ui.overlay({
      x: 0,
      y: 0,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      origin: 0,
      anchor: {
        left: 'left',
        top: 'top',
        width: '100%',
        height: '100%',
      },
      children: [
        {
          gameObject: this.createTitleGroup(),
          align: 'left-top',
          minWidth: GAME_WIDTH,
          minHeight: TITLE_GROUP_HEIGHT,
          offsetOriginX: -0.5,
          offsetOriginY: -0.5,
        },
      ],
    });
  }

  private createTitleGroup(): Phaser.GameObjects.Container {
    const group = this.ui.container({ width: GAME_WIDTH, height: TITLE_GROUP_HEIGHT });
    const title = this.ui.text({
      x: GAME_WIDTH / 2,
      y: 140,
      text: 'ELVENBATTLE',
      variant: 'heroTitle',
      align: 'center',
      origin: 0.5,
    });
    const subtitle = this.ui.text({
      x: GAME_WIDTH / 2,
      y: 228,
      text: 'the elven card battler',
      variant: 'titleTagline',
      align: 'center',
      origin: 0.5,
      alpha: 0.92,
    });

    group.add([title, subtitle]);
    return group;
  }

  private createLoginForm(): void {
    const overlay = document.createElement('div');
    overlay.className = 'title-login-overlay';
    overlay.setAttribute('data-title-login', 'true');
    applyLoginTheme(overlay);

    const panel = document.createElement('section');
    panel.className = 'title-login-panel';
    panel.setAttribute('aria-labelledby', 'title-login-heading');

    const heading = document.createElement('h2');
    heading.id = 'title-login-heading';
    heading.className = 'title-login-heading';
    heading.textContent = 'Sign in';

    const helper = document.createElement('p');
    helper.className = 'title-login-helper';
    helper.textContent = 'Use your ID and password, or create a new account.';

    const form = document.createElement('form');
    form.className = 'title-login-form';
    form.autocomplete = 'on';

    const idField = createField({
      label: 'ID',
      name: 'id',
      type: 'text',
      autocomplete: 'username',
      minLength: 4,
      maxLength: 20,
      pattern: '[A-Za-z0-9_\\-]{4,20}',
    });
    const passwordField = createField({
      label: 'Password',
      name: 'password',
      type: 'password',
      autocomplete: 'current-password',
      minLength: 8,
      maxLength: 64,
    });
    this.idInput = idField.input;
    this.passwordInput = passwordField.input;

    const actions = document.createElement('div');
    actions.className = 'title-login-actions';
    const loginButton = createActionButton('Login', 'login');
    const registerButton = createActionButton('Create Account', 'register');
    this.actionButtons = [loginButton, registerButton];
    actions.append(loginButton, registerButton);

    const status = document.createElement('p');
    status.className = 'title-login-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    this.statusElement = status;

    form.append(idField.label, passwordField.label, actions, status);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const submitter = (event as SubmitEvent).submitter;
      const intent = submitter instanceof HTMLButtonElement ? submitter.value : 'login';
      void this.submitCredentials(intent === 'register');
    });
    panel.append(heading, helper, form);
    overlay.append(panel);

    const mount = document.querySelector<HTMLDivElement>('#app') ?? document.body;
    mount.append(overlay);
    this.loginOverlay = overlay;
  }

  private async restoreSession(initialStatus?: string): Promise<void> {
    this.setFormBusy(true);
    this.setStatus('Checking session...', false);
    try {
      const session = await getGameServices(this).auth.restore();
      if (session && this.scene.isActive()) {
        this.openGame();
        return;
      }
      this.setFormBusy(false);
      this.setStatus(initialStatus ?? 'Enter your account details to continue.', false);
      this.idInput?.focus();
    } catch (error) {
      this.setFormBusy(false);
      this.setStatus(formatAuthError(error), true);
      this.idInput?.focus();
    }
  }

  private async submitCredentials(register: boolean): Promise<void> {
    if (!this.idInput || !this.passwordInput) {
      return;
    }
    if (!this.idInput.reportValidity() || !this.passwordInput.reportValidity()) {
      return;
    }

    const credentials = {
      id: this.idInput.value,
      password: this.passwordInput.value,
    };
    this.setFormBusy(true);
    this.setStatus(register ? 'Creating account...' : 'Signing in...', false);
    try {
      const auth = getGameServices(this).auth;
      if (register) {
        await auth.register(credentials);
      } else {
        await auth.login(credentials);
      }
      this.passwordInput.value = '';
      if (this.scene.isActive()) {
        this.openGame();
      }
    } catch (error) {
      this.passwordInput.value = '';
      this.setFormBusy(false);
      this.setStatus(formatAuthError(error), true);
      this.passwordInput.focus();
    }
  }

  private openGame(): void {
    this.removeLoginForm();
    this.scene.start('LoaderScene', {
      assetBaseUrl: DEFAULT_ASSET_BASE_URL,
    } satisfies LoaderSceneData);
  }

  private setFormBusy(busy: boolean): void {
    if (this.idInput) {
      this.idInput.disabled = busy;
    }
    if (this.passwordInput) {
      this.passwordInput.disabled = busy;
    }
    for (const button of this.actionButtons) {
      button.disabled = busy;
    }
  }

  private setStatus(message: string, isError: boolean): void {
    if (!this.statusElement) {
      return;
    }
    this.statusElement.textContent = message;
    this.statusElement.dataset.error = String(isError);
  }

  private removeLoginForm(): void {
    this.loginOverlay?.remove();
    this.loginOverlay = null;
    this.idInput = null;
    this.passwordInput = null;
    this.statusElement = null;
    this.actionButtons = [];
  }
}

function createField(options: {
  label: string;
  name: string;
  type: 'text' | 'password';
  autocomplete: string;
  minLength: number;
  maxLength: number;
  pattern?: string;
}): { label: HTMLLabelElement; input: HTMLInputElement } {
  const label = document.createElement('label');
  label.className = 'title-login-field';
  const labelText = document.createElement('span');
  labelText.textContent = options.label;
  const input = document.createElement('input');
  input.name = options.name;
  input.type = options.type;
  input.setAttribute('autocomplete', options.autocomplete);
  input.minLength = options.minLength;
  input.maxLength = options.maxLength;
  input.required = true;
  if (options.pattern) {
    input.pattern = options.pattern;
  }
  label.append(labelText, input);
  return { label, input };
}

function createActionButton(label: string, intent: 'login' | 'register'): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'submit';
  button.name = 'intent';
  button.value = intent;
  button.textContent = label;
  return button;
}

function applyLoginTheme(element: HTMLElement): void {
  const theme = UI_THEME.dom.login;
  element.style.setProperty('--eb-login-font', UI_THEME.fontFamily);
  element.style.setProperty('--eb-login-text', UI_THEME.colors.primary.css);
  element.style.setProperty('--eb-login-muted', UI_THEME.colors.secondary.css);
  element.style.setProperty('--eb-login-danger', UI_THEME.colors.danger.css);
  element.style.setProperty('--eb-login-panel', theme.panelBackground);
  element.style.setProperty('--eb-login-border', theme.panelBorder);
  element.style.setProperty('--eb-login-shadow', theme.panelShadow);
  element.style.setProperty('--eb-login-input', theme.inputBackground);
  element.style.setProperty('--eb-login-input-border', theme.inputBorder);
  element.style.setProperty('--eb-login-focus', UI_THEME.colors.accent.css);
  element.style.setProperty('--eb-login-focus-ring', theme.focusRing);
  element.style.setProperty('--eb-login-button', UI_THEME.surfaces.button.fill.css);
  element.style.setProperty('--eb-login-button-hover', UI_THEME.colors.surfaceHover.css);
  element.style.setProperty('--eb-login-button-border', theme.buttonBorder);
}

function formatAuthError(error: unknown): string {
  if (error instanceof AuthApiError || error instanceof Error) {
    return error.message;
  }
  return String(error);
}
