'use client';

import { useEffect, useRef } from 'react';
import {
  ACESFilmicToneMapping,
  BufferAttribute,
  BufferGeometry,
  Mesh,
  PerspectiveCamera,
  Raycaster,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { CreationProgress } from '@/lib/generation/progress';

/**
 * Diamante negro lapidado que ocupa a prévia enquanto a composição ainda não
 * gravou a primeira página. As facetas se fecham conforme as etapas medidas.
 * Gestos horizontais dão impulso ao giro, sem alterar o progresso real.
 */

type Props = {
  progress: CreationProgress;
  /** Há execução viva: o diamante gira com mais intensidade. */
  active: boolean;
  /** Versão de 40 px para a barra da prévia quando já existe página. */
  compact?: boolean;
  /** Frase de apoio abaixo do diamante, só na versão grande. */
  message?: string;
};

const TAU = Math.PI * 2;

/**
 * Lapidação brilhante: mesa, oito facetas principais da coroa, oito estrelas,
 * dezesseis facetas superiores da cintura, cintura, dezesseis inferiores e
 * oito principais do pavilhão até a culaça. Facetas planas, sem índice, para
 * a sombra e os brilhos caírem por faceta, como num lapidado de verdade.
 */
function brilliantCut(): BufferGeometry {
  const positions: number[] = [];
  const orders: number[] = [];
  const centers: number[] = [];
  const tableRadius = 0.56;
  const crownTop = 0.31;
  const girdleTop = 0.03;
  const girdleBottom = -0.03;
  const breakRadius = 0.86;
  const pavilionRadius = 0.74;
  const culet = -0.9;
  const half = Math.PI / 8;
  const cos = Math.cos(half);
  // Os pontos de quebra ficam sobre o plano da faceta principal: assim cada
  // pipa é plana e o brilho não racha ao meio.
  const crownBreak =
    crownTop +
    ((breakRadius * cos - tableRadius) * (girdleTop - crownTop)) /
      (1 - tableRadius);
  const pavilionBreak =
    girdleBottom + (1 - pavilionRadius * cos) * (culet - girdleBottom);

  const point = (radius: number, height: number, angle: number) =>
    new Vector3(Math.cos(angle) * radius, height, Math.sin(angle) * radius);
  const mains = Array.from({ length: 8 }, (_, k) => half + (k * TAU) / 8);
  const betweens = mains.map((angle) => angle + half);

  const table = mains.map((angle) => point(tableRadius, crownTop, angle));
  const crownBreaks = betweens.map((angle) =>
    point(breakRadius, crownBreak, angle),
  );
  const girdleMainTop = mains.map((angle) => point(1, girdleTop, angle));
  const girdleBetweenTop = betweens.map((angle) => point(1, girdleTop, angle));
  const girdleMainBottom = mains.map((angle) => point(1, girdleBottom, angle));
  const girdleBetweenBottom = betweens.map((angle) =>
    point(1, girdleBottom, angle),
  );
  const pavilionBreaks = betweens.map((angle) =>
    point(pavilionRadius, pavilionBreak, angle),
  );
  const culetPoint = new Vector3(0, culet, 0);

  const facet = (vertices: Vector3[], order: number) => {
    const center = vertices
      .reduce((sum, vertex) => sum.add(vertex), new Vector3())
      .divideScalar(vertices.length);
    for (let index = 1; index < vertices.length - 1; index += 1) {
      for (const vertex of [
        vertices[0],
        vertices[index],
        vertices[index + 1],
      ]) {
        positions.push(vertex.x, vertex.y, vertex.z);
        orders.push(order);
        centers.push(center.x, center.y, center.z);
      }
    }
  };
  // A ordem de fechamento sobe da culaça à mesa e varre em torno do eixo: o
  // pavilhão se forma primeiro, a mesa fecha por último.
  const order = (height: number, angle: number) => {
    const vertical = (height - culet) / (crownTop - culet);
    return vertical * 0.82 + (((angle % TAU) + TAU) % TAU) / TAU / 6;
  };

  for (let k = 0; k < 8; k += 1) {
    const next = (k + 1) % 8;
    const previous = (k + 7) % 8;
    // Pavilhão: pipa principal e duas facetas inferiores da cintura.
    facet(
      [
        girdleMainBottom[k],
        pavilionBreaks[k],
        culetPoint,
        pavilionBreaks[previous],
      ],
      order(pavilionBreak, mains[k]),
    );
    facet(
      [girdleMainBottom[k], girdleBetweenBottom[k], pavilionBreaks[k]],
      order((girdleBottom + pavilionBreak) / 2, betweens[k] - half / 2),
    );
    facet(
      [girdleBetweenBottom[k], girdleMainBottom[next], pavilionBreaks[k]],
      order((girdleBottom + pavilionBreak) / 2, betweens[k] + half / 2),
    );
    // Cintura: dois quadriláteros por setor.
    facet(
      [
        girdleMainTop[k],
        girdleBetweenTop[k],
        girdleBetweenBottom[k],
        girdleMainBottom[k],
      ],
      order(0, betweens[k] - half / 2),
    );
    facet(
      [
        girdleBetweenTop[k],
        girdleMainTop[next],
        girdleMainBottom[next],
        girdleBetweenBottom[k],
      ],
      order(0, betweens[k] + half / 2),
    );
    // Coroa: duas facetas superiores da cintura, a pipa principal e a estrela.
    facet(
      [girdleMainTop[k], crownBreaks[k], girdleBetweenTop[k]],
      order((girdleTop + crownBreak) / 2, betweens[k] - half / 2),
    );
    facet(
      [girdleBetweenTop[k], crownBreaks[k], girdleMainTop[next]],
      order((girdleTop + crownBreak) / 2, betweens[k] + half / 2),
    );
    facet(
      [table[k], crownBreaks[k], girdleMainTop[k], crownBreaks[previous]],
      order(crownBreak, mains[k]),
    );
    facet(
      [table[k], table[next], crownBreaks[k]],
      order((crownTop + crownBreak) / 2, betweens[k]),
    );
  }
  facet(table, 1);

  const geometry = new BufferGeometry();
  geometry.setAttribute(
    'position',
    new BufferAttribute(new Float32Array(positions), 3),
  );
  geometry.setAttribute(
    'aCenter',
    new BufferAttribute(new Float32Array(centers), 3),
  );
  geometry.setAttribute(
    'aOrder',
    new BufferAttribute(new Float32Array(orders), 1),
  );
  geometry.computeVertexNormals();
  return geometry;
}

/** Estúdio escuro com poucas fontes largas: é o que um diamante reflete. */
const STUDIO_GLSL = /* glsl */ `
  const float PI = 3.141592653589793;
  float bar(float az, float el, float az0, float el0, float w, float h) {
    float da = abs(mod(az - az0 + PI, PI * 2.0) - PI);
    return (1.0 - smoothstep(w * 0.55, w, da)) * (1.0 - smoothstep(h * 0.55, h, abs(el - el0)));
  }
  vec3 studio(vec3 d, float drift) {
    float el = asin(clamp(d.y, -1.0, 1.0));
    float az = atan(d.z, d.x) + drift;
    vec3 warm = vec3(1.0, 0.78, 0.52);
    vec3 cool = vec3(0.74, 0.84, 1.0);
    vec3 base = mix(vec3(0.004, 0.0035, 0.003), vec3(0.02, 0.018, 0.016), smoothstep(-1.0, 1.0, d.y));
    vec3 c = base;
    c += bar(az, el, 0.85, 0.95, 0.62, 0.22) * warm * 3.4;
    c += bar(az, el, -2.25, 0.3, 0.2, 0.95) * cool * 1.9;
    c += bar(az, el, 2.55, -0.18, 0.75, 0.05) * vec3(1.0) * 2.6;
    c += bar(az, el, 0.0, 1.38, 3.2, 0.1) * warm * 1.1;
    c += bar(az, el, -0.6, -0.95, 1.4, 0.08) * cool * 0.7;
    c += bar(az, el, 1.9, 0.35, 0.05, 0.6) * vec3(1.0) * 2.2;
    return c;
  }
`;

const GEM_VERTEX = /* glsl */ `
  attribute vec3 aCenter;
  attribute float aOrder;
  uniform float uProgress;
  uniform float uSpread;
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vWorld;
  varying float vOpen;
  void main() {
    float open = 1.0 - smoothstep(aOrder - 0.16, aOrder + 0.02, uProgress);
    float hover = 0.7 + 0.3 * sin(uTime * 1.3 + aOrder * 14.0);
    vec3 outward = normalize(aCenter + normal * 0.35);
    vec3 displaced = position + outward * (uSpread * open * hover);
    vOpen = open;
    vec4 world = modelMatrix * vec4(displaced, 1.0);
    vWorld = world.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const GEM_FRAGMENT = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform float uFire;
  uniform float uDrift;
  varying vec3 vNormal;
  varying vec3 vWorld;
  varying float vOpen;
  ${STUDIO_GLSL}
  float glint(vec3 r, vec3 l, float power) {
    return pow(max(dot(r, normalize(l)), 0.0), power);
  }
  void main() {
    vec3 n = normalize(vNormal);
    vec3 v = normalize(cameraPosition - vWorld);
    float ndv = clamp(dot(n, v), 0.0, 1.0);
    // Índice de refração do diamante: 2,42. F0 ≈ 0,17.
    float fresnel = 0.17 + 0.83 * pow(1.0 - ndv, 5.0);
    vec3 r = reflect(-v, n);
    vec3 reflection = studio(r, uDrift);
    // Dispersão: cada canal refrata com índice próprio e o fogo aparece nas
    // bordas das fontes de luz, não como cor chapada.
    vec3 tr = refract(-v, n, 1.0 / 2.38);
    vec3 tg = refract(-v, n, 1.0 / 2.42);
    vec3 tb = refract(-v, n, 1.0 / 2.47);
    vec3 inner = vec3(
      studio(tr, uDrift).r,
      studio(tg, uDrift).g,
      studio(tb, uDrift).b
    );
    // Segundo rebote pelo pavilhão: o raio refratado volta por outra faceta.
    vec3 bounce = reflect(tg, normalize(vec3(-n.x, -abs(n.y) - 0.6, -n.z)));
    vec3 fire = vec3(
      studio(reflect(tr, normalize(vec3(-n.x, -abs(n.y) - 0.6, -n.z))), uDrift + 0.4).r,
      studio(bounce, uDrift + 0.4).g,
      studio(reflect(tb, normalize(vec3(-n.x, -abs(n.y) - 0.6, -n.z))), uDrift + 0.4).b
    );
    vec3 body = vec3(0.06, 0.05, 0.05);
    vec3 color = reflection * fresnel;
    color += (inner * 0.55 + fire * 0.9) * (1.0 - fresnel) * body * (5.0 + 9.0 * uFire);
    color += glint(r, vec3(0.6, 0.9, 0.4), 700.0) * vec3(1.0, 0.86, 0.66) * (1.6 + 1.4 * uFire);
    color += glint(r, vec3(-0.8, 0.35, 0.5), 900.0) * vec3(0.8, 0.9, 1.0) * (1.2 + 1.0 * uFire);
    color += pow(1.0 - ndv, 4.0) * vec3(0.05, 0.045, 0.04);
    float alpha = mix(1.0, 0.5, vOpen);
    gl_FragColor = vec4(color, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** O que a etapa faz quando ela não tem unidade medida para mostrar. */
const STAGE_HINT: Record<CreationProgress['stage']['id'], string> = {
  preparar: 'briefing e direção de arte',
  criar: 'imagens e páginas',
  conferir: 'revisão visual',
};

export function GenerationDiamond({
  progress,
  active,
  compact = false,
  message,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<{
    fraction: number;
    active: boolean;
  }>({
    fraction: progress.fraction,
    active,
  });
  const requestFrameRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    targetRef.current = {
      fraction: progress.fraction,
      active,
    };
    requestFrameRef.current?.();
  }, [progress.fraction, active]);

  useEffect(() => {
    const root = rootRef.current;
    const host = hostRef.current;
    if (!root || !host) return;

    const motionPreference = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    );
    let reducedMotion = motionPreference.matches;

    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      });
    } catch {
      root.dataset.state = 'fallback';
      return;
    }

    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = compact ? 1.3 : 1.05;
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.setAttribute('aria-hidden', 'true');
    renderer.domElement.tabIndex = -1;
    host.appendChild(renderer.domElement);

    const scene = new Scene();
    const camera = new PerspectiveCamera(compact ? 34 : 24, 1, 0.1, 40);
    camera.position.set(0, 1.3, compact ? 6.6 : 7.9);
    camera.lookAt(0, -0.08, 0);

    const gemMaterial = new ShaderMaterial({
      vertexShader: GEM_VERTEX,
      fragmentShader: GEM_FRAGMENT,
      transparent: true,
      uniforms: {
        uProgress: { value: 0 },
        uSpread: { value: compact ? 0.06 : 0.13 },
        uTime: { value: 0 },
        uFire: { value: 0 },
        uDrift: { value: 0 },
      },
    });
    gemMaterial.customProgramCacheKey = () => 'eixu-generation-gem-v1';
    const gemGeometry = brilliantCut();
    const gem = new Mesh(gemGeometry, gemMaterial);
    gem.rotation.x = -0.34;
    gem.scale.setScalar((compact ? 1.18 : 1) * 0.7);
    scene.add(gem);

    // As mudanças de progresso chegam a cada leitura do servidor; a animação
    // as alcança em cerca de um segundo em vez de saltar.
    let shownFraction = targetRef.current.fraction;
    let fire = 0;
    let spin = 0.3;
    let animationFrame = 0;
    let running = false;
    let lastFrameAt = performance.now();
    let disposed = false;
    // O navegador pode recolher o contexto de uma aba aberta o dia todo. Sem
    // isto, o canvas ficava preto e o laço seguia desenhando no vazio.
    let lost = false;

    const applyTargets = (elapsed: number) => {
      const target = targetRef.current;
      const ease = 1 - Math.exp(-elapsed * 2.2);
      shownFraction += (target.fraction - shownFraction) * ease;
      fire += ((compact || target.active ? 1 : 0.35) - fire) * ease * 0.6;
      gemMaterial.uniforms.uProgress.value = shownFraction;
      gemMaterial.uniforms.uFire.value = fire;
    };

    const draw = (now: number) => {
      const elapsed = Math.min(
        0.05,
        Math.max(0.001, (now - lastFrameAt) / 1000),
      );
      lastFrameAt = now;
      applyTargets(elapsed);
      const seconds = now / 1000;
      if (!reducedMotion) {
        const speed = targetRef.current.active ? 0.275 : 0.06;
        spin += (speed - spin) * (1 - Math.exp(-elapsed * 1.5));
        gem.rotation.y += spin * elapsed;
        gem.rotation.x = -0.34 + Math.sin(seconds * 0.7) * 0.06;
        gem.position.y = Math.sin(seconds * 1.1) * 0.035;
        gemMaterial.uniforms.uDrift.value = seconds * 0.05;
      }
      gemMaterial.uniforms.uTime.value = seconds;
      renderer.render(scene, camera);
    };

    const settled = () => {
      const target = targetRef.current;
      return Math.abs(target.fraction - shownFraction) < 0.002;
    };

    const animate = (now: number) => {
      if (disposed || lost) return;
      draw(now);
      // Aba escondida não desenha; com movimento reduzido, o laço para assim
      // que o progresso novo termina de ser alcançado.
      const keepGoing =
        document.visibilityState === 'visible' &&
        (!reducedMotion || !settled());
      if (keepGoing) {
        animationFrame = window.requestAnimationFrame(animate);
      } else {
        running = false;
      }
    };

    const start = () => {
      if (running || disposed || lost) return;
      running = true;
      lastFrameAt = performance.now();
      animationFrame = window.requestAnimationFrame(animate);
    };
    requestFrameRef.current = start;

    const raycaster = new Raycaster();
    const pointerPosition = new Vector2();
    let pointer: { id: number; x: number; y: number } | null = null;
    let draggedPointer: number | null = null;

    const touchesGem = (x: number, y: number, bounds: DOMRect) => {
      pointerPosition.set(
        ((x - bounds.left) / bounds.width) * 2 - 1,
        -((y - bounds.top) / bounds.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointerPosition, camera);
      return raycaster.intersectObject(gem).length > 0;
    };
    const rememberPointer = (event: PointerEvent) => {
      pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!event.isPrimary || event.button !== 0 || lost) return;
      rememberPointer(event);
      if (
        !touchesGem(event.clientX, event.clientY, host.getBoundingClientRect())
      )
        return;
      draggedPointer = event.pointerId;
      host.setPointerCapture(event.pointerId);
      host.dataset.dragging = '';
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!event.isPrimary || lost) return;
      const previous = pointer;
      rememberPointer(event);
      if (!previous || previous.id !== event.pointerId) return;
      const bounds = host.getBoundingClientRect();
      const dragging = draggedPointer === event.pointerId;
      // O mouse dá impulso ao passar pela pedra; toque/caneta arrastam a
      // partir dela. Capturar o ponteiro mantém o gesto ao sair do canvas.
      if (
        !dragging &&
        (event.pointerType !== 'mouse' ||
          (!touchesGem(event.clientX, event.clientY, bounds) &&
            !touchesGem(previous.x, previous.y, bounds)))
      )
        return;
      const delta =
        (event.clientX - previous.x) /
        Math.max(1, Math.min(bounds.width, bounds.height));
      if (reducedMotion) {
        // Movimento reduzido permite manipulação direta, sem giro automático
        // nem inércia depois que a pessoa termina o gesto.
        gem.rotation.y += delta * TAU;
      } else {
        spin = Math.max(-2, Math.min(2, spin + delta * 5));
      }
      start();
    };
    const resetPointer = () => {
      const captured = draggedPointer;
      draggedPointer = null;
      pointer = null;
      delete host.dataset.dragging;
      if (captured !== null && host.hasPointerCapture(captured)) {
        host.releasePointerCapture(captured);
      }
    };
    const onPointerEnd = (event: PointerEvent) => {
      if (event.pointerId === pointer?.id || event.pointerId === draggedPointer)
        resetPointer();
    };
    const onPointerLeave = () => {
      if (draggedPointer === null) pointer = null;
    };
    const onMotionPreference = () => {
      reducedMotion = motionPreference.matches;
      spin = targetRef.current.active ? 0.275 : 0.06;
      resetPointer();
      start();
    };
    host.addEventListener('pointerdown', onPointerDown);
    host.addEventListener('pointermove', onPointerMove);
    host.addEventListener('pointerup', onPointerEnd);
    host.addEventListener('pointercancel', onPointerEnd);
    host.addEventListener('lostpointercapture', onPointerEnd);
    host.addEventListener('pointerleave', onPointerLeave);
    window.addEventListener('blur', resetPointer);
    motionPreference.addEventListener('change', onMotionPreference);

    const resize = () => {
      const bounds = host.getBoundingClientRect();
      const width = Math.max(1, Math.round(bounds.width));
      const height = Math.max(1, Math.round(bounds.height));
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      start();
    };
    const onContextLost = (event: Event) => {
      event.preventDefault();
      lost = true;
      running = false;
      window.cancelAnimationFrame(animationFrame);
      resetPointer();
      root.dataset.state = 'fallback';
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') start();
      else resetPointer();
    };
    document.addEventListener('visibilitychange', onVisibility);
    resize();
    root.dataset.state = 'live';

    return () => {
      disposed = true;
      requestFrameRef.current = null;
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      resetPointer();
      host.removeEventListener('pointerdown', onPointerDown);
      host.removeEventListener('pointermove', onPointerMove);
      host.removeEventListener('pointerup', onPointerEnd);
      host.removeEventListener('pointercancel', onPointerEnd);
      host.removeEventListener('lostpointercapture', onPointerEnd);
      host.removeEventListener('pointerleave', onPointerLeave);
      window.removeEventListener('blur', resetPointer);
      motionPreference.removeEventListener('change', onMotionPreference);
      renderer.domElement.removeEventListener(
        'webglcontextlost',
        onContextLost,
      );
      document.removeEventListener('visibilitychange', onVisibility);
      gemGeometry.dispose();
      gemMaterial.dispose();
      renderer.dispose();
      // dispose() libera caches e listeners, não o contexto. O painel é uma
      // aba que fica aberta o dia todo trocando de cliente: sem isto, cada
      // montagem deixa um contexto vivo até o navegador derrubar os antigos.
      renderer.forceContextLoss();
      renderer.domElement.remove();
      delete root.dataset.state;
    };
  }, [compact]);

  const title = progress.done
    ? 'Geração concluída'
    : `Etapa ${progress.position} de ${progress.stages.length} · ${progress.stage.label}`;
  const detail =
    progress.detail ?? (active ? STAGE_HINT[progress.stage.id] : 'aguardando');

  if (compact) {
    return (
      <div
        ref={rootRef}
        className="admin-preview-loader"
        data-compact=""
        title={`${title} · ${detail}`}
      >
        <div ref={hostRef} className="admin-preview-loader-stage" />
        <span className="sr-only">
          {title}: {detail}
        </span>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="admin-preview-loader">
      <div ref={hostRef} className="admin-preview-loader-stage" />
      <div className="admin-preview-loader-caption">
        <span className="admin-label">{title}</span>
        <strong>{detail}</strong>
        {message ? <p>{message}</p> : null}
      </div>
    </div>
  );
}
