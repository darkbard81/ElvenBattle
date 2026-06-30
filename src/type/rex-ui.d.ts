declare module 'phaser4-rex-plugins/templates/ui/ui-plugin.js' {
  const UIPlugin: typeof Phaser.Plugins.ScenePlugin;
  export default UIPlugin;
}

type RexUIObjectFactory = {
  sizer: (...args: unknown[]) => Phaser.GameObjects.GameObject;
  gridSizer: (...args: unknown[]) => Phaser.GameObjects.GameObject;
  overlapSizer: (...args: unknown[]) => Phaser.GameObjects.GameObject;
};

type RexUIPluginInstance = Phaser.Plugins.ScenePlugin & {
  add: RexUIObjectFactory;
};

declare global {
  namespace Phaser {
    interface Scene {
      rexUI: RexUIPluginInstance;
    }
  }
}

export {};
