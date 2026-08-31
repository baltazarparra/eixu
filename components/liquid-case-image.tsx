'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import {
  ClampToEdgeWrapping,
  LinearFilter,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  Vector2,
  Vector4,
  WebGLRenderer,
} from 'three';

const MAX_RIPPLES = 6;
const RIPPLE_LIFETIME = 1.7;

type LiquidCaseImageProps = {
  src: string;
  alt: string;
  width: number;
  height: number;
};

type Ripple = {
  x: number;
  y: number;
  bornAt: number;
  intensity: number;
};

export function LiquidCaseImage({
  src,
  alt,
  width,
  height,
}: LiquidCaseImageProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasHostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const rootNode = rootRef.current;
    const canvasHostNode = canvasHostRef.current;
    if (!rootNode || !canvasHostNode) return;
    const root: HTMLDivElement = rootNode;
    const canvasHost: HTMLDivElement = canvasHostNode;

    const canHover =
      window.matchMedia('(hover: hover) and (pointer: fine)').matches ||
      (navigator.maxTouchPoints === 0 && window.innerWidth > 760);
    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    if (!canHover || reducedMotion) {
      root.dataset.liquidState = 'static';
      return;
    }

    let disposed = false;
    let teardown = () => {};
    let texture: Texture | null = null;

    const initialize = () => {
      texture = new TextureLoader().load(
        src,
        (loadedTexture) => {
          if (disposed) return;

          let renderer: WebGLRenderer;
          try {
            renderer = new WebGLRenderer({
              alpha: true,
              antialias: false,
              powerPreference: 'high-performance',
            });
          } catch {
            root.dataset.liquidState = 'static';
            return;
          }

          loadedTexture.colorSpace = SRGBColorSpace;
          loadedTexture.minFilter = LinearFilter;
          loadedTexture.magFilter = LinearFilter;
          loadedTexture.wrapS = ClampToEdgeWrapping;
          loadedTexture.wrapT = ClampToEdgeWrapping;
          loadedTexture.generateMipmaps = false;
          loadedTexture.needsUpdate = true;

          renderer.outputColorSpace = SRGBColorSpace;
          renderer.setClearColor(0x000000, 0);
          renderer.domElement.className = 'liquid-case-image__canvas';
          renderer.domElement.setAttribute('aria-hidden', 'true');
          renderer.domElement.tabIndex = -1;
          canvasHost.appendChild(renderer.domElement);

          const rippleUniforms = Array.from(
            { length: MAX_RIPPLES },
            () => new Vector4(),
          );
          const image = loadedTexture.image as {
            naturalWidth?: number;
            naturalHeight?: number;
            width?: number;
            height?: number;
          };
          const imageWidth = image.naturalWidth ?? image.width ?? width;
          const imageHeight = image.naturalHeight ?? image.height ?? height;
          const material = new ShaderMaterial({
            depthTest: false,
            depthWrite: false,
            uniforms: {
              uTexture: { value: loadedTexture },
              uPlaneSize: { value: new Vector2(1, 1) },
              uImageSize: { value: new Vector2(imageWidth, imageHeight) },
              uPointer: { value: new Vector2(0.5, 0.5) },
              uMotion: { value: new Vector2() },
              uVelocity: { value: 0 },
              uHover: { value: 0 },
              uTime: { value: 0 },
              uRipples: { value: rippleUniforms },
            },
            vertexShader: `
            varying vec2 vUv;

            void main() {
              vUv = uv;
              gl_Position = vec4(position.xy, 0.0, 1.0);
            }
          `,
            fragmentShader: `
            precision highp float;

            uniform sampler2D uTexture;
            uniform vec2 uPlaneSize;
            uniform vec2 uImageSize;
            uniform vec2 uPointer;
            uniform vec2 uMotion;
            uniform float uVelocity;
            uniform float uHover;
            uniform float uTime;
            uniform vec4 uRipples[${MAX_RIPPLES}];
            varying vec2 vUv;

            vec2 coverUv(vec2 uv) {
              float planeRatio = uPlaneSize.x / max(uPlaneSize.y, 1.0);
              float imageRatio = uImageSize.x / max(uImageSize.y, 1.0);
              vec2 scale = planeRatio < imageRatio
                ? vec2(planeRatio / imageRatio, 1.0)
                : vec2(1.0, imageRatio / planeRatio);
              return clamp((uv - 0.5) * scale + 0.5, 0.002, 0.998);
            }

            void main() {
              float aspect = uPlaneSize.x / max(uPlaneSize.y, 1.0);
              vec2 displacement = vec2(0.0);
              vec2 pointerDelta = vUv - uPointer;
              vec2 pointerMetric = vec2(pointerDelta.x * aspect, pointerDelta.y);
              float pointerDistance = length(pointerMetric);
              vec2 pointerDirection = normalize(pointerDelta + vec2(0.0001));
              float pointerCore = exp(-pointerDistance * pointerDistance * 25.0);
              float pointerWake = exp(-pointerDistance * pointerDistance * 9.0)
                * sin(pointerDistance * 31.0 - uTime * 5.2);

              displacement += pointerDirection * pointerCore * uVelocity * 0.026;
              displacement += pointerDirection * pointerWake * uVelocity * 0.005;
              displacement -= uMotion * pointerCore * uVelocity * 0.018;

              for (int index = 0; index < ${MAX_RIPPLES}; index++) {
                vec4 ripple = uRipples[index];
                vec2 delta = vUv - ripple.xy;
                vec2 metric = vec2(delta.x * aspect, delta.y);
                float distanceFromRipple = length(metric);
                float life = exp(-ripple.z * 2.35);
                float envelope = exp(-distanceFromRipple * 9.5);
                float wave = sin(distanceFromRipple * 48.0 - ripple.z * 10.5);
                displacement += normalize(delta + vec2(0.0001))
                  * wave * envelope * life * ripple.w * 0.012;
              }

              displacement *= uHover;
              vec2 baseUv = coverUv(vUv);
              vec2 liquidUv = coverUv(vUv + displacement);
              vec2 refraction = displacement * 0.36;
              vec3 base = texture2D(uTexture, baseUv).rgb;
              vec3 liquid = texture2D(uTexture, liquidUv).rgb;
              liquid.r = texture2D(uTexture, clamp(liquidUv + refraction, 0.002, 0.998)).r;
              liquid.b = texture2D(uTexture, clamp(liquidUv - refraction * 0.72, 0.002, 0.998)).b;

              float distortionStrength = clamp(length(displacement) * 42.0, 0.0, 1.0);
              vec3 color = mix(base, liquid, uHover);
              color = mix(color, color * vec3(1.012, 1.0, 0.988), distortionStrength * 0.16);
              gl_FragColor = vec4(color, 1.0);
              #include <colorspace_fragment>
            }
          `,
          });
          material.customProgramCacheKey = () => 'eixu-liquid-case-v1';

          const geometry = new PlaneGeometry(2, 2);
          const scene = new Scene();
          const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
          camera.position.z = 1;
          scene.add(new Mesh(geometry, material));

          let ripples: Ripple[] = [];
          let animationFrame = 0;
          let isRunning = false;
          let isInside = false;
          let hover = 0;
          let velocity = 0;
          let velocityTarget = 0;
          let lastFrameAt = performance.now();
          let lastPointerAt = lastFrameAt;
          let lastRippleAt = 0;
          const pointerTarget = new Vector2(0.5, 0.5);
          const pointerSmooth = new Vector2(0.5, 0.5);
          const pointerPrevious = new Vector2(0.5, 0.5);
          const motionTarget = new Vector2();
          const motionSmooth = new Vector2();

          const localPointer = (event: PointerEvent) => {
            const bounds = root.getBoundingClientRect();
            return new Vector2(
              Math.min(
                1,
                Math.max(0, (event.clientX - bounds.left) / bounds.width),
              ),
              1 -
                Math.min(
                  1,
                  Math.max(0, (event.clientY - bounds.top) / bounds.height),
                ),
            );
          };

          const addRipple = (point: Vector2, intensity: number) => {
            const now = performance.now();
            ripples.push({ x: point.x, y: point.y, bornAt: now, intensity });
            if (ripples.length > MAX_RIPPLES)
              ripples = ripples.slice(-MAX_RIPPLES);
            lastRippleAt = now;
          };

          const start = () => {
            if (isRunning) return;
            isRunning = true;
            lastFrameAt = performance.now();
            animationFrame = window.requestAnimationFrame(animate);
          };

          const handlePointerEnter = (event: PointerEvent) => {
            const point = localPointer(event);
            pointerTarget.copy(point);
            pointerSmooth.copy(point);
            pointerPrevious.copy(point);
            isInside = true;
            velocityTarget = 0.48;
            root.dataset.liquidState = 'active';
            addRipple(point, 0.92);
            start();
          };

          const handlePointerMove = (event: PointerEvent) => {
            if (!isInside) return;
            const now = performance.now();
            const point = localPointer(event);
            const elapsed = Math.max(12, now - lastPointerAt);
            const distance = point.distanceTo(pointerPrevious);
            motionTarget.copy(point).sub(pointerPrevious);
            if (motionTarget.lengthSq() > 0.000001) motionTarget.normalize();
            velocityTarget = Math.min(1.25, 0.24 + (distance / elapsed) * 92);
            pointerTarget.copy(point);

            if (distance > 0.026 && now - lastRippleAt > 54) {
              addRipple(point, Math.min(1.05, 0.42 + velocityTarget * 0.46));
            }

            pointerPrevious.copy(point);
            lastPointerAt = now;
            start();
          };

          const handlePointerLeave = () => {
            isInside = false;
            velocityTarget = 0;
            root.dataset.liquidState = 'leaving';
            start();
          };

          const handlePointerDown = (event: PointerEvent) => {
            if (!isInside) return;
            addRipple(localPointer(event), 1.18);
            velocityTarget = 1.1;
            start();
          };

          const resize = () => {
            const bounds = root.getBoundingClientRect();
            const renderWidth = Math.max(1, Math.round(bounds.width));
            const renderHeight = Math.max(1, Math.round(bounds.height));
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.4));
            renderer.setSize(renderWidth, renderHeight, false);
            material.uniforms.uPlaneSize.value.set(renderWidth, renderHeight);
            if (isInside) start();
          };

          function animate(now: number) {
            if (!isRunning) return;
            const elapsed = Math.min(
              0.05,
              Math.max(0.001, (now - lastFrameAt) / 1000),
            );
            lastFrameAt = now;
            const pointerEase = 1 - Math.exp(-elapsed * 12);
            const motionEase = 1 - Math.exp(-elapsed * 8);
            const hoverEase = 1 - Math.exp(-elapsed * (isInside ? 9 : 5.5));

            pointerSmooth.lerp(pointerTarget, pointerEase);
            motionSmooth.lerp(motionTarget, motionEase);
            hover += ((isInside ? 1 : 0) - hover) * hoverEase;
            velocity += (velocityTarget - velocity) * motionEase;
            velocityTarget *= Math.exp(-elapsed * 5.8);
            motionTarget.multiplyScalar(Math.exp(-elapsed * 4.6));
            ripples = ripples.filter(
              (ripple) => (now - ripple.bornAt) / 1000 < RIPPLE_LIFETIME,
            );

            for (let index = 0; index < MAX_RIPPLES; index += 1) {
              const ripple = ripples[index];
              rippleUniforms[index].set(
                ripple?.x ?? 0,
                ripple?.y ?? 0,
                ripple ? (now - ripple.bornAt) / 1000 : RIPPLE_LIFETIME,
                ripple?.intensity ?? 0,
              );
            }

            material.uniforms.uPointer.value.copy(pointerSmooth);
            material.uniforms.uMotion.value.copy(motionSmooth);
            material.uniforms.uVelocity.value = velocity;
            material.uniforms.uHover.value = hover;
            material.uniforms.uTime.value = now / 1000;
            renderer.render(scene, camera);

            const shouldContinue =
              isInside ||
              hover > 0.012 ||
              velocity > 0.012 ||
              ripples.length > 0;
            if (shouldContinue) {
              animationFrame = window.requestAnimationFrame(animate);
            } else {
              isRunning = false;
              root.dataset.liquidState = 'idle';
            }
          }

          const resizeObserver = new ResizeObserver(resize);
          resizeObserver.observe(root);
          root.addEventListener('pointerenter', handlePointerEnter, {
            passive: true,
          });
          root.addEventListener('pointermove', handlePointerMove, {
            passive: true,
          });
          root.addEventListener('pointerleave', handlePointerLeave, {
            passive: true,
          });
          root.addEventListener('pointerdown', handlePointerDown, {
            passive: true,
          });
          resize();
          root.dataset.liquidState = 'idle';

          teardown = () => {
            window.cancelAnimationFrame(animationFrame);
            resizeObserver.disconnect();
            root.removeEventListener('pointerenter', handlePointerEnter);
            root.removeEventListener('pointermove', handlePointerMove);
            root.removeEventListener('pointerleave', handlePointerLeave);
            root.removeEventListener('pointerdown', handlePointerDown);
            geometry.dispose();
            material.dispose();
            renderer.dispose();
            renderer.domElement.remove();
          };
        },
        undefined,
        () => {
          root.dataset.liquidState = 'static';
        },
      );
    };

    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        intersectionObserver.disconnect();
        initialize();
      },
      { rootMargin: '240px' },
    );
    intersectionObserver.observe(root);

    return () => {
      disposed = true;
      intersectionObserver.disconnect();
      teardown();
      texture?.dispose();
    };
  }, [height, src, width]);

  return (
    <div
      ref={rootRef}
      className="liquid-case-image"
      data-liquid-state="loading"
    >
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading="lazy"
        decoding="async"
      />
      <div
        ref={canvasHostRef}
        className="liquid-case-image__surface"
        aria-hidden="true"
      />
    </div>
  );
}
