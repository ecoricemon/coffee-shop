import * as THREE from 'three';

export default class RendererOnDemand extends THREE.WebGLRenderer{
  constructor(parameters) {
    super(parameters);
    this.updates = [];
    this.breakers = [];
  }

  addUpdate(update) {
    this.updates.push(update);
  }

  addBreak(breaker) {
    this.breakers.push(breaker);
  }

  makeUpdateOnOrbitControls(controls, camera) {
    this.cameraRot = [0, 0, 0];
    this.addUpdate(() => controls.update());
    this.addBreak(() => {
      const eps = .0001;
      const curRot = camera.rotation.toArray().slice(0, 3);
      const res = curRot.every((angle, i) => Math.abs(angle - this.cameraRot[i]) < eps);
      this.cameraRot = curRot;
      return res;
    });
  }

  startRendering() {
    if (!this.isRendering) {
      this.isRendering = true;
      this.setAnimationLoop(() => this.update());
    }
  }

  stopRendering() {
    if (this.isRendering) {
      this.isRendering = false;
      this.setAnimationLoop(null);
    }
  }

  update() {
    // Update and stop rendering if all breakers are activated
    this.updates.forEach(update => update());
    const stop = this.breakers.every(breaker => breaker());
    if (stop)
      this.stopRendering();
  }

  get canvas() {
    return this.domElement;
  }
}