import * as THREE from 'three';
import { BlendFunction } from 'postprocessing';

class Document {
  static canvasId = "canvas1";
  static toggleInputClass = '.toggle';
}

class Renderer {
  static getConstructorParam = canvas => {
    return {
      powerPreference: "low-power",
      antialias: false,
      stencil: false,
      depth: false,
      canvas
    };
  }
}

class Model {
  static path = new URL('../assets/model/CoffeeShop.glb', import.meta.url).href;
  static ground = 'Ground';
  static wall = 'Wall';
  static building = 'Shop';
  static mug = 'Mug';
  static table = 'Table';
  static streetLamp = 'StreetLamp';
  static streetLampBulb = 'StreetLampBulb';
  static buildingLampBulbs = ['ShopLampBulbLeft', 'ShopLampBulbRight'];
  static shadowReceivings = [Model.ground, Model.wall, Model.table];
  static shadowCastings = [Model.building, Model.mug, Model.streetLamp, Model.table];
}

class Camera {
  static position = [-3.98, 5.43, 4];
  static getConstructorParam = aspectRatio => {
    const viewHeight = 11.5;
    return {
      left: aspectRatio * -viewHeight / 2,
      right: aspectRatio * viewHeight / 2, 
      root: viewHeight / 2,
      bottom: -viewHeight / 2, 
      near: .1,
      far: 15 
    };
  }
  static getConstructorArray = aspectRatio => {
    return [...Object.values(Camera.getConstructorParam(aspectRatio))];
  }
}

class Orbit {
  static lookAt = [.1, 2.6, 0];
  static azimuthRange = [-100 * Math.PI / 180, 10 * Math.PI / 180];
  static polarRange = [0 * Math.PI / 180, 110 * Math.PI / 180];
  static zoomRange = [.9, 9];
  static dampingFactor = .35;
}

class Light {
  static hemi = {
    getConstructorParam: isNight => {
      return {
        skyColor: isNight ? [0, 0.047, 0.239] : [1, 1, 1],
        groundColor: isNight ? [0.145, 0.18, 0.678] : [.5, .5, .5],
        intensity: .82,
      };
    },
    getConstructorArray: isNight => {
      const obj = Light.hemi.getConstructorParam(isNight);
      return [
        new THREE.Color(...obj.skyColor),
        new THREE.Color(...obj.groundColor),
        obj.intensity
      ];
    },
    position: [2.7, 6.1, -10]
  };
  static spot = {
    getConstructorParam: isNight => {
      return {
        color: 0xffffff,
        intensity: isNight ? .36 : 0,
        distance: 7.18,
        angle: 46 * Math.PI / 180,
        penumbra: 0.14,
        decay: 0
      };
    },
    getConstructorArray: isNight => {
      return [...Object.values(Light.spot.getConstructorParam(isNight))];
    },
    getPosition: root => {
      return root.getObjectByName(Model.streetLampBulb).geometry.boundingSphere.center.toArray()
    },
    getTargetPosition: root => {
      const pos = Light.spot.getPosition(root);
      return [pos[0], 0, pos[2]];
    },
    shadowBias: -.001
  };
  static rect = {
    getConstructorParam: isNight => {
      return {
        color: 0xc3c610,
        intensity: isNight ? 3 : 0,
        width: 5,
        height: 3
      };
    },
    getConstructorArray: isNight => {
      return [...Object.values(Light.rect.getConstructorParam(isNight))];
    },
    position: [0.84, 3, 3],
    rotation: [-93 * Math.PI / 180, 0, 0]
  }
}

class Effect {
  static godRays = {
    constructorParam: {
      blendFunction: BlendFunction.SCREEN,
      samples: 60,
      density: .97,
      decay: .95,
      weight: 1,
      exposure: .9,
      clampMax: 1.0,
      resolutionScale: .5,
    },
    geometry: [.1, .05, .1],  // width, height, depth
    getMaterial: isNight => {
      return {
        color: 0xfeefd5,
        opacity: isNight ? 1 : 0
      };
    },
    getPosition: root => {
      const bb = root.getObjectByName(Model.streetLampBulb).geometry.boundingBox;
      return [
        (bb.max.x + bb.min.x) / 2,
        (bb.max.y + bb.min.y) / 2 - .08,
        (bb.min.z + bb.min.z) / 2 + .25
      ];
    }
  };
}

export default class Conf {
  static document = Document;
  static renderer = Renderer;
  static model = Model;
  static camera = Camera;
  static orbit = Orbit;
  static light = Light;
  static effect = Effect;
}