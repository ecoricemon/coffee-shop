import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib';
import { EffectComposer, RenderPass, EffectPass, GodRaysEffect, BloomEffect, BlendFunction } from 'postprocessing';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import TWEEN from '@tweenjs/tween.js';
import RendererOnDemand from './RendererOnDemand';
import Conf from './Conf';

export default class Shop {
  constructor() {
    if (!Shop.instance) {
      Shop.instance = this;
      this.#init();
    }
    return Shop.instance;
  }

  async #init() {
    this.tweens = {
      dayToNight: [],
      nightToDay: []
    };

    // Determine whether day or night now
    this.isNight = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.querySelector(Conf.document.toggleInputClass).checked = this.isNight;

    // Make world primitives
    const promGLTF = new GLTFLoader().loadAsync(Conf.model.path);
    const canvas = this.#createCanvas(Conf.document.canvasId);
    const camera = this.#createCamera(canvas.width / canvas.height);
    const controls = this.#createOrbitControl(camera, canvas);
    this.renderer = this.#createRenderer(canvas);
    this.#setRenderer(controls, camera);

    // Make scene with the model, then render it one time
    this.composer = this.#createComposer();
    const scene = new THREE.Scene();
    const renderPass = new RenderPass(scene, camera);
    const {root, streetLampMesh} = await this.#setScene(scene, promGLTF);
    if (!root)
      return;
    const effectPass = this.#createEffectPass(camera, streetLampMesh);
    this.#compose(renderPass, effectPass);
    this.renderer.startRendering();

    // React to outside the world
    this.#beResponsive();
    this.#enableToggle();
  }

  #createCanvas(canvasId) {
    const canvas = document.getElementById(canvasId);
    const pixelRatio = this.#pixelRatio;
    canvas.width = (canvas.clientWidth * pixelRatio) | 0;
    canvas.height = (canvas.clientHeight * pixelRatio) | 0;
    return canvas;
  }

  get #pixelRatio() {
    return window.devicePixelRatio;
  }

  #createRenderer(canvas) {
    const renderer = new RendererOnDemand(Conf.renderer.getConstructorParam(canvas));
    renderer.shadowMap.enabled = true;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.setClearAlpha(0);
    return renderer;
  }

  #setRenderer(controls, camera) {
    this.renderer.addUpdate(() => {
      this.composer.render();
      if (this.#isTweenPlaying)
        TWEEN.update();
    });
    this.renderer.makeUpdateOnOrbitControls(controls, camera);
    this.renderer.addBreak(() => !this.#isTweenPlaying);
  }

  #createCamera(aspectRatio) {
    const camera = new THREE.OrthographicCamera(...Conf.camera.getConstructorArray(aspectRatio));
    camera.position.set(...Conf.camera.position);
    return camera;
  }

  #createOrbitControl(camera, canvas) {
    const controls = new OrbitControls(camera, canvas);
    controls.target.set(...Conf.orbit.lookAt);
    controls.minAzimuthAngle = Conf.orbit.azimuthRange[0];
    controls.maxAzimuthAngle = Conf.orbit.azimuthRange[1];
    controls.minPolarAngle = Conf.orbit.polarRange[0]; 
    controls.maxPolarAngle = Conf.orbit.polarRange[1];
    controls.enableDamping = true;
    controls.dampingFactor = Conf.orbit.dampingFactor;
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.addEventListener('change', () => {
        this.renderer.startRendering();
    });
    return controls;
  }

  #createComposer() {
    return new EffectComposer(this.renderer, {frameBufferType: THREE.HalfFloatType});
  }

  #createStreetLampMesh(scene, root) {
    const geo = new THREE.BoxGeometry(...Conf.effect.godRays.geometry);
    const mat = new THREE.MeshBasicMaterial(Conf.effect.godRays.getMaterial(this.isNight));
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(...Conf.effect.godRays.getPosition(root));
    scene.add(mesh);
    return mesh;
  }

  #createEffectPass(camera, godRaysEffectSource) {
    return new EffectPass(camera,
      this.#createBloomEffect(),
      this.#createGodRaysEffect(camera, godRaysEffectSource),
    );
  }

  #createBloomEffect() {
    const effectConf = {
      blendFunction: BlendFunction.ADD
    };
    return new BloomEffect(effectConf);
  }

  #createGodRaysEffect(camera, lightSource) {
    return new GodRaysEffect(camera, lightSource, Conf.effect.godRays.constructorParam);
  }

  #compose(...passes) {
    passes.forEach(pass => this.composer.addPass(pass));
  }

  #beResponsive() {
    window.addEventListener('resize', () => {
      const canvas = this.renderer.canvas;
      const newWidth = (canvas.clientWidth * this.#pixelRatio) | 0;
      const newHeight = (canvas.clientHeight * this.#pixelRatio) | 0;
      if (canvas.width !== newWidth || canvas.height !== newHeight) {
        this.renderer.setSize(newWidth, newHeight, false);
        this.composer.setSize(newWidth, newHeight);
        this.renderer.startRendering();
      }
    });
  }

  #enableToggle() {
    const toggleInput = document.querySelector(Conf.document.toggleInputClass);
    toggleInput.addEventListener('click', () => {
      this.#turn(() => {toggleInput.disabled = false});
      toggleInput.disabled = true;
      toggleInput.textContent = this.isNight ? 'Night' : 'Day';
    });
  }

  #turn(onComplete) {
    this.isNight = !this.isNight;
    const tweens = this.isNight ? this.tweens.dayToNight : this.tweens.nightToDay;
    this.renderer.startRendering();
    tweens.forEach(tween => tween.start());
    const id = setInterval(() => {
      if (!this.#isTweenPlaying) {
        onComplete();
        // It needs to update one more to reach the last state of the tweens (render could stop ahead of it)
        this.renderer.update();
        clearInterval(id);
      }
    }, 100);
  }

  async #setScene(scene, promGLTF) {
    return await promGLTF
      .then(container => {
        const root = container.scene;
        const lights = this.#createSceneLight(scene, root);
        const streetLampMesh = this.#createStreetLampMesh(scene, root);
        this.#setShadow(root);
        this.#createTween(root, lights, streetLampMesh);
        scene.add(root);
        return {root, streetLampMesh};
      })
      .catch(e => {
        console.error(e);
      });
  }

  get #isTweenPlaying() {
    return !Object.values(this.tweens).every(
      arr => arr.find(tween => tween.isPlaying()) === undefined
    );
  }

  #createSceneLight(scene, root) {
    // Environment light
    const envLight = new THREE.HemisphereLight(...Conf.light.hemi.getConstructorArray(this.isNight));
    envLight.position.set(...Conf.light.hemi.position);
    scene.add(envLight);

    // Street lamp light
    const streetLight = new THREE.SpotLight(...Conf.light.spot.getConstructorArray(this.isNight));
    streetLight.position.set(...Conf.light.spot.getPosition(root));
    streetLight.target.position.set(...Conf.light.spot.getTargetPosition(root));
    streetLight.castShadow = true;
    streetLight.shadow.bias = Conf.light.spot.shadowBias;
    scene.add(streetLight);
    scene.add(streetLight.target);

    // Window light
    RectAreaLightUniformsLib.init();
    const windowLight = new THREE.RectAreaLight(...Conf.light.rect.getConstructorArray(this.isNight));
    windowLight.position.set(...Conf.light.rect.position);
    windowLight.rotation.set(...Conf.light.rect.rotation);
    scene.add(windowLight);

    return {
      envLight: envLight,
      streetLight: streetLight,
      windowLight: windowLight
    };
  }

  #setShadow(root) {
    const helper = (obj, cast, receive) => {
      if (obj.type == 'Mesh') {
        if (cast)
          obj.castShadow = cast;
        if (receive)
          obj.receiveShadow = receive;
      } else if (obj.type == 'Group')
        obj.children.forEach(child => helper(child, cast, receive));
    };
    Conf.model.shadowReceivings.forEach(name => helper(root.getObjectByName(name), null, true));
    Conf.model.shadowCastings.forEach(name => helper(root.getObjectByName(name), true, null));
  }

  #createTween(root, lights, streetLamp) {
    // Helper
    const add = (gen) => {
      Object.values(this.tweens).forEach(arr => arr.push(gen.next().value));
    };
    const transpose = matrix => {
      return [...Array(matrix[0].length).keys()].map(ri => matrix.map(col => col[ri]));
    };
    const addColor = (color, vals, durations, repeats) => {
      const channelVals = transpose(vals); // [[r0, r1, ...], [g0, g1, ...], [b0, b1, ...]]
      ['r', 'g', 'b'].forEach((prop, i) => {
        add(this.#createSimpleTween(color, prop, channelVals[i], durations, repeats));
      });
    };
    let prop, vals;

    // Environment light tween
    vals = [
      Conf.light.hemi.getConstructorParam(false).skyColor,
      Conf.light.hemi.getConstructorParam(true).skyColor,
    ];
    addColor(lights.envLight.color, vals);
    vals = [
      Conf.light.hemi.getConstructorParam(false).groundColor,
      Conf.light.hemi.getConstructorParam(true).groundColor,
    ];
    addColor(lights.envLight.color, vals);

    // Building lamp's material tween
    vals = [
      [.1, .1, 0], // Day color
      [10, 10, 0]  // Night color, high value for a huge bloom effect
    ];
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(...(this.isNight ? vals[1] : vals[0]))
    });
    const bulbs = Conf.model.buildingLampBulbs.map(name => root.getObjectByName(name));
    bulbs.forEach(mesh => mesh.material = mat);
    addColor(mat.color, vals, [125, 500], [3, 0]);

    // Window light tween
    prop = 'intensity';
    vals = [
      Conf.light.rect.getConstructorParam(false)[prop],
      Conf.light.rect.getConstructorParam(true)[prop]
    ];
    add(this.#createSimpleTween(lights.windowLight, prop, vals));

    // Street lamp's light tween
    vals = [
      Conf.light.spot.getConstructorParam(false)[prop],
      Conf.light.spot.getConstructorParam(true)[prop]
    ];
    add(this.#createSimpleTween(lights.streetLight, prop, vals));
    
    // Street lamp's material tween
    prop = 'opacity';
    vals = [
      Conf.effect.godRays.getMaterial(false)[prop],
      Conf.effect.godRays.getMaterial(true)[prop]
    ];
    add(this.#createSimpleTween(streetLamp.material, prop, vals));
  }

  *#createSimpleTween(sceneObj, prop, vals = [0, 1], durations = [500, 500], repeats = [0, 0]) {
    for (let i = 0; i < vals.length; ++i) {
      const obj = {v: vals[i]}; // Object that TWEEN will manipulate
      const target = {v: vals[(i + 1) % vals.length]} // Object that TWEEN will refer to
      yield new TWEEN.Tween(obj)
        .to(target, durations[i])
        .repeat(repeats[i])
        .onUpdate(o => sceneObj[prop] = o.v);
    };
  }
}