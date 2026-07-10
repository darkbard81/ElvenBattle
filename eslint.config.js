import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const NO_DIRECT_REX_UI_CALL = {
  selector:
    "CallExpression[callee.type='MemberExpression'][callee.object.type='MemberExpression'][callee.object.object.type='MemberExpression'][callee.object.object.object.type='ThisExpression'][callee.object.object.property.name='rexUI'][callee.object.property.name='add']",
  message: 'Scene의 rexUI 직접 호출은 금지됩니다. CanvasUiFactory를 사용하세요.',
};

const NO_DIRECT_TEXT_CALL = {
  selector:
    "CallExpression[callee.type='MemberExpression'][callee.property.name='text'][callee.object.type='MemberExpression'][callee.object.object.type='ThisExpression'][callee.object.property.name='add']",
  message: 'Scene의 직접 Text 생성은 금지됩니다. CanvasUiFactory.text()를 사용하세요.',
};

const NO_DIRECT_NON_TEXT_GAME_OBJECT_CALL = {
  selector:
    "CallExpression[callee.type='MemberExpression'][callee.property.name!='text'][callee.object.type='MemberExpression'][callee.object.object.type='ThisExpression'][callee.object.property.name='add']",
  message: 'Presentation Scene의 GameObject 생성은 CanvasUiFactory를 사용하세요.',
};

const SCENE_UI_BOUNDARY_RESTRICTIONS = [NO_DIRECT_REX_UI_CALL, NO_DIRECT_TEXT_CALL];
const PRESENTATION_SCENE_UI_BOUNDARY_RESTRICTIONS = [
  ...SCENE_UI_BOUNDARY_RESTRICTIONS,
  NO_DIRECT_NON_TEXT_GAME_OBJECT_CALL,
];

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'generated/**', 'assets/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts', 'tests/**/*.ts', 'scripts/**/*.ts', 'vite.config.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
  },
  {
    files: ['src/phaser/scenes/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['phaser4-rex-plugins/**'],
              message: 'Scene은 rexUI를 직접 import하지 말고 CanvasUiFactory를 사용하세요.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/phaser/scenes/**/*Scene.ts'],
    rules: {
      'no-restricted-syntax': ['error', ...SCENE_UI_BOUNDARY_RESTRICTIONS],
    },
  },
  {
    files: ['src/phaser/scenes/**/*Scene.ts'],
    ignores: ['src/phaser/scenes/BattlefieldScene.ts'],
    rules: {
      'no-restricted-syntax': ['error', ...PRESENTATION_SCENE_UI_BOUNDARY_RESTRICTIONS],
    },
  },
);
