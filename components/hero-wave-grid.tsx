'use client';

import { useEffect, useRef } from 'react';
import {
  ACESFilmicToneMapping,
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  InstancedMesh,
  MeshPhongMaterial,
  Object3D,
  OrthographicCamera,
  Plane,
  Raycaster,
  Scene,
  SRGBColorSpace,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderer,
} from 'three';

const MAX_WAVES = 8;
const WAVE_LIFETIME = 5.6;

type Wave = {
  x: number;
  y: number;
  bornAt: number;
  intensity: number;
};

export function HeroWaveGrid() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const initialBounds = root.getBoundingClientRect();

    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({
        alpha: true,
        antialias: initialBounds.width > 760,
        powerPreference: 'high-performance',
      });
    } catch {
      root.dataset.state = 'fallback';
      return;
    }

    const scene = new Scene();
    const camera = new OrthographicCamera(-10, 10, 10, -10, 0.1, 80);
    camera.position.set(1.8, -1.15, 20);
    camera.lookAt(0, 0, 0);

    renderer.setClearColor(0x12120f, 0);
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.86;
    renderer.domElement.setAttribute('aria-hidden', 'true');
    renderer.domElement.tabIndex = -1;
    root.appendChild(renderer.domElement);

    const columns = 42;
    const rows = 36;
    const spacing = 0.98;
    const geometry = new BoxGeometry(0.88, 0.88, 1, 1, 1, 1);
    const material = new MeshPhongMaterial({
      color: 0x8f8b80,
      emissive: 0x141410,
      emissiveIntensity: 0.12,
      shininess: 24,
      transparent: true,
      opacity: 0.78,
    });
    const mesh = new InstancedMesh(geometry, material, columns * rows);
    mesh.frustumCulled = false;

    const helper = new Object3D();
    let instance = 0;
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        helper.position.set(
          (column - (columns - 1) / 2) * spacing,
          (row - (rows - 1) / 2) * spacing,
          0,
        );
        helper.updateMatrix();
        mesh.setMatrixAt(instance, helper.matrix);
        instance += 1;
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    scene.add(mesh);

    const ambientLight = new AmbientLight(0xb8b2a5, 0.36);
    const directionalLight = new DirectionalLight(0xcfc6b5, 1.75);
    directionalLight.position.set(-7, 10, 16);
    scene.add(ambientLight, directionalLight);

    const uniformWaves = Array.from({ length: MAX_WAVES }, () => new Vector4());
    let shaderRef: Parameters<typeof material.onBeforeCompile>[0] | null = null;

    material.onBeforeCompile = (shader) => {
      shader.uniforms.uWaves = { value: uniformWaves };
      shader.uniforms.uWaveCount = { value: 0 };
      shader.uniforms.uMotion = { value: reducedMotion ? 0 : 1 };
      shader.uniforms.uColorBase = { value: new Color(0x3d3c37) };
      shader.uniforms.uColorHigh = { value: new Color(0x89867d) };

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
          uniform vec4 uWaves[${MAX_WAVES}];
          uniform int uWaveCount;
          uniform float uMotion;
          varying float vWaveLift;`,
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          vec2 gridPosition = instanceMatrix[3].xy;
          float waveLift = 0.0;

          for (int waveIndex = 0; waveIndex < ${MAX_WAVES}; waveIndex++) {
            if (waveIndex >= uWaveCount) break;
            vec4 wave = uWaves[waveIndex];
            float distanceFromOrigin = distance(gridPosition, wave.xy);
            float waveFront = wave.z * 4.8;
            float relativeDistance = distanceFromOrigin - waveFront;
            float envelope = exp(-(relativeDistance * relativeDistance) / 2.15);
            float ripple = 0.58 + 0.42 * cos(relativeDistance * 3.0);
            float fade = exp(-wave.z * 0.52);
            float distanceFade = 1.0 / (1.0 + distanceFromOrigin * 0.035);
            waveLift += max(0.0, envelope * ripple * fade * distanceFade * wave.w * 4.2);
          }

          float staticRelief = 0.035 * (sin(gridPosition.x * 0.42 + gridPosition.y * 0.31) + 1.0);
          waveLift = min(waveLift, 3.8);
          float depth = 0.09 + staticRelief + waveLift * uMotion;
          transformed.z = position.z * depth + depth * 0.5;
          vWaveLift = waveLift * uMotion;`,
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          uniform vec3 uColorBase;
          uniform vec3 uColorHigh;
          varying float vWaveLift;`,
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          float waveColor = clamp(vWaveLift / 2.7, 0.0, 1.0);
          diffuseColor.rgb = mix(uColorBase, uColorHigh, waveColor);`,
        );

      shaderRef = shader;
    };
    material.customProgramCacheKey = () => 'eixu-hero-wave-grid-v2';

    let waves: Wave[] = [];
    let lastPointerAt = 0;
    let lastWaveAt = 0;
    const lastWavePosition = new Vector2(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
    const pointer = new Vector2();
    const raycaster = new Raycaster();
    const rayPlane = new Plane(new Vector3(0, 0, 1), 0);
    const hitPoint = new Vector3();

    const addWave = (x: number, y: number, intensity = 1) => {
      const now = performance.now();
      waves.push({ x, y, bornAt: now, intensity });
      if (waves.length > MAX_WAVES) waves = waves.slice(-MAX_WAVES);
      lastWaveAt = now;
      lastWavePosition.set(x, y);
    };

    const projectPointer = (event: PointerEvent) => {
      const bounds = root.getBoundingClientRect();
      if (
        event.clientX < bounds.left ||
        event.clientX > bounds.right ||
        event.clientY < bounds.top ||
        event.clientY > bounds.bottom
      ) {
        return null;
      }

      pointer.set(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      return raycaster.ray.intersectPlane(rayPlane, hitPoint) ? hitPoint : null;
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (reducedMotion) return;
      const point = projectPointer(event);
      if (!point) return;

      const now = performance.now();
      lastPointerAt = now;
      const distance = Math.hypot(point.x - lastWavePosition.x, point.y - lastWavePosition.y);
      if (distance > 1.45 && now - lastWaveAt > 92) {
        addWave(point.x, point.y, Math.min(1.25, 0.72 + distance * 0.08));
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (reducedMotion) return;
      const point = projectPointer(event);
      if (!point) return;
      lastPointerAt = performance.now();
      addWave(point.x, point.y, 1.28);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerdown', handlePointerDown, { passive: true });

    const resize = () => {
      const bounds = root.getBoundingClientRect();
      const width = Math.max(1, Math.round(bounds.width));
      const height = Math.max(1, Math.round(bounds.height));
      const aspect = width / height;
      const viewHeight = width < 760 ? 22.5 : 20;

      camera.left = (-viewHeight * aspect) / 2;
      camera.right = (viewHeight * aspect) / 2;
      camera.top = viewHeight / 2;
      camera.bottom = -viewHeight / 2;
      camera.updateProjectionMatrix();

      renderer.setPixelRatio(Math.min(window.devicePixelRatio, width < 760 ? 1.25 : 1.5));
      renderer.setSize(width, height, false);
      renderer.render(scene, camera);
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(root);
    resize();

    addWave(-7, 2.5, 1.04);
    waves[0].bornAt -= 760;
    addWave(6, -3.5, 0.92);
    waves[1].bornAt -= 1680;

    let animationFrame = 0;
    let isRunning = false;
    let isVisible = true;
    let lastFrameAt = performance.now();

    const animate = (now: number) => {
      if (!isRunning) return;
      animationFrame = window.requestAnimationFrame(animate);
      if (!isVisible || document.hidden) return;

      const elapsed = Math.min(48, now - lastFrameAt);
      if (elapsed < 14) return;
      lastFrameAt = now;

      waves = waves.filter((wave) => (now - wave.bornAt) / 1000 < WAVE_LIFETIME);

      if (now - lastPointerAt > 2200 && now - lastWaveAt > 1750) {
        const angle = now * 0.00043;
        addWave(Math.cos(angle) * 8.5, Math.sin(angle * 1.37) * 7.5, 0.82);
      }

      if (shaderRef) {
        const count = Math.min(waves.length, MAX_WAVES);
        for (let index = 0; index < MAX_WAVES; index += 1) {
          const wave = waves[index];
          uniformWaves[index].set(
            wave?.x ?? 0,
            wave?.y ?? 0,
            wave ? (now - wave.bornAt) / 1000 : 0,
            wave?.intensity ?? 0,
          );
        }
        shaderRef.uniforms.uWaveCount.value = count;
      }

      renderer.render(scene, camera);
    };

    const start = () => {
      if (isRunning || reducedMotion) return;
      isRunning = true;
      lastFrameAt = performance.now();
      animationFrame = window.requestAnimationFrame(animate);
    };

    const stop = () => {
      isRunning = false;
      window.cancelAnimationFrame(animationFrame);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) stop();
      else if (isVisible) start();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting;
        if (isVisible) start();
        else stop();
      },
      { threshold: 0.02 },
    );
    intersectionObserver.observe(root);

    renderer.render(scene, camera);
    root.dataset.state = 'ready';
    if (reducedMotion) renderer.render(scene, camera);
    else start();

    return () => {
      stop();
      intersectionObserver.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={rootRef} className="hero-wave-grid" aria-hidden="true" data-state="loading" />;
}
