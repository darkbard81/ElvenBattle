import js from '@eslint/js';
import tseslint from 'typescript-eslint';

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
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.type='MemberExpression'][callee.object.type='MemberExpression'][callee.object.object.type='MemberExpression'][callee.object.object.object.type='ThisExpression'][callee.object.object.property.name='rexUI']",
          message: 'Scene의 rexUI 직접 호출은 금지됩니다. CanvasUiFactory를 사용하세요.',
        },
        {
          selector:
            "CallExpression[callee.type='MemberExpression'][callee.property.name='text'][callee.object.type='MemberExpression'][callee.object.object.type='ThisExpression'][callee.object.property.name='add']",
          message: 'Scene의 직접 Text 생성은 금지됩니다. CanvasUiFactory.text()를 사용하세요.',
        },
      ],
    },
  },
  {
    files: [
      'src/phaser/scenes/DeckBuildScene.ts',
      'src/phaser/scenes/EquipmentScene.ts',
      'src/phaser/scenes/GrowthScene.ts',
      'src/phaser/scenes/LoaderScene.ts',
      'src/phaser/scenes/MainMenuScene.ts',
      'src/phaser/scenes/SaveSlotScene.ts',
      'src/phaser/scenes/StageScene.ts',
      'src/phaser/scenes/TitleScene.ts',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.type='MemberExpression'][callee.object.type='MemberExpression'][callee.object.object.type='ThisExpression'][callee.object.property.name='add']",
          message: 'Presentation Scene의 GameObject 생성은 CanvasUiFactory를 사용하세요.',
        },
      ],
    },
  },
);
