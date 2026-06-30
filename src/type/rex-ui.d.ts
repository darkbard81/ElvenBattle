import type GridSizer from 'phaser4-rex-plugins/templates/ui/gridsizer/GridSizer';
import type OverlapSizer from 'phaser4-rex-plugins/templates/ui/overlapsizer/OverlapSizer';
import type Sizer from 'phaser4-rex-plugins/templates/ui/sizer/Sizer';

declare module 'phaser4-rex-plugins/templates/ui/ui-plugin.js' {
  const UIPlugin: typeof Phaser.Plugins.ScenePlugin;
  export default UIPlugin;
}

type RexUIObjectFactory = {
  sizer: (
    ...args:
      | [config?: Sizer.IConfig]
      | [x: number, y: number, config?: Sizer.IConfig]
      | [x: number, y: number, width: number, height: number, config?: Sizer.IConfig]
      | [
          x: number,
          y: number,
          width: number,
          height: number,
          orientation?: Sizer.OrientationTypes,
          config?: Sizer.IConfig,
        ]
  ) => Sizer;
  gridSizer: (
    ...args:
      | [config?: GridSizer.IConfig]
      | [x: number, y: number, config?: GridSizer.IConfig]
      | [x: number, y: number, width: number, height: number, config?: GridSizer.IConfig]
      | [
          x: number,
          y: number,
          width: number,
          height: number,
          columns: number,
          rows: number,
          config?: GridSizer.IConfig,
        ]
  ) => GridSizer;
  overlapSizer: (
    ...args:
      | [config?: OverlapSizer.IConfig]
      | [x: number, y: number, config?: OverlapSizer.IConfig]
      | [x: number, y: number, width: number, height: number, config?: OverlapSizer.IConfig]
  ) => OverlapSizer;
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
