import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { ArrowLeft } from "lucide-react";

interface Splash3DLoaderProps {
  onComplete: () => void;
  durationMs?: number;
}

const _mat4 = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _euler = new THREE.Euler();

function createFloorGlowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const grad = ctx.createRadialGradient(128, 128, 8, 128, 128, 126);
    grad.addColorStop(0, "rgba(20, 184, 166, 0.36)");
    grad.addColorStop(0.45, "rgba(15, 118, 110, 0.14)");
    grad.addColorStop(1, "rgba(6, 11, 19, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export const Splash3DLoader: React.FC<Splash3DLoaderProps> = ({
  onComplete,
  durationMs = 3400,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const [progress, setProgress] = useState(0);
  const [fadingOut, setFadingOut] = useState(false);
  const [webglUnavailable, setWebglUnavailable] = useState(false);

  const finish = () => {
    setFadingOut(true);
    window.setTimeout(() => {
      onCompleteRef.current();
    }, 320);
  };

  useEffect(() => {
    const start = performance.now();
    let completed = false;

    const progressTimer = window.setInterval(() => {
      const elapsed = performance.now() - start;
      const ratio = Math.min(1, elapsed / durationMs);
      // Smooth ease-out curve
      const eased = 1 - Math.pow(1 - ratio, 2.2);
      const pct = Math.min(100, Math.round(eased * 100));
      setProgress(pct);

      if (ratio >= 1 && !completed) {
        completed = true;
        window.clearInterval(progressTimer);
        setFadingOut(true);
        window.setTimeout(() => {
          onCompleteRef.current();
        }, 340);
      }
    }, 35);

    return () => window.clearInterval(progressTimer);
  }, [durationMs]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const isSoftwareGl = (() => {
      try {
        const probeCanvas = document.createElement("canvas");
        const gl = probeCanvas.getContext("webgl2");
        if (!gl) return true;
        const ext = gl.getExtension("WEBGL_debug_renderer_info");
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension("WEBGL_lose_context")?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: "high-performance",
        alpha: false,
      });
    } catch {
      setWebglUnavailable(true);
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";

    container.appendChild(renderer.domElement);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setWebglUnavailable(true);
    };
    const onContextRestored = () => {
      setWebglUnavailable(false);
    };
    renderer.domElement.addEventListener("webglcontextlost", onContextLost);
    renderer.domElement.addEventListener("webglcontextrestored", onContextRestored);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060b13);
    scene.fog = new THREE.FogExp2(0x060b13, 0.055);

    const camera = new THREE.PerspectiveCamera(
      44,
      container.clientWidth / Math.max(1, container.clientHeight),
      0.1,
      100
    );
    camera.position.set(0, 0.35, 7.6);
    camera.lookAt(0, 0, 0);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    pmremGenerator.dispose();

    // 3-Point Studio Lighting
    const hemiLight = new THREE.HemisphereLight(0x5eead4, 0x0b1320, 0.85);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff1dc, 2.3);
    keyLight.position.set(4.5, 6.0, 5.0);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    scene.add(keyLight);

    const rimLight = new THREE.PointLight(0x14b8a6, 8, 20, 1.4);
    rimLight.position.set(-4.2, -1.5, -3.5);
    scene.add(rimLight);

    const warmAccent = new THREE.PointLight(0xf59e0b, 3.2, 14, 1.8);
    warmAccent.position.set(3.4, -2.2, 2.8);
    scene.add(warmAccent);

    // Composite 7-Part 3D Hero Assembly
    const heroGroup = new THREE.Group();
    scene.add(heroGroup);

    const disposables: Array<{ dispose: () => void }> = [envTarget];
    const track = <T extends { dispose: () => void }>(item: T): T => {
      disposables.push(item);
      return item;
    };

    // 1. Inner Faceted Crystal Core
    const coreGeo = track(new THREE.OctahedronGeometry(0.78, 0));
    const coreMat = track(
      new THREE.MeshPhysicalMaterial({
        color: 0x2dd4bf,
        emissive: 0x0f766e,
        emissiveIntensity: 0.55,
        roughness: 0.08,
        metalness: 0.12,
        clearcoat: 1.0,
        clearcoatRoughness: 0.06,
        transmission: isSoftwareGl ? 0 : 0.72,
        transparent: true,
        opacity: isSoftwareGl ? 0.85 : 1,
        ior: 1.85,
        thickness: 1.2,
        attenuationColor: new THREE.Color(0x0d9488),
        attenuationDistance: 1.5,
      })
    );
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    heroGroup.add(coreMesh);

    // 2. Inner Brushed Titanium Lattice Cage
    const cageGeo = track(new THREE.IcosahedronGeometry(1.16, 0));
    const cageMat = track(
      new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        metalness: 0.92,
        roughness: 0.18,
        wireframe: true,
      })
    );
    const cageMesh = new THREE.Mesh(cageGeo, cageMat);
    heroGroup.add(cageMesh);

    // 3. Primary Equatorial Precision Ring + 4 Bridge Lugs
    const ring1Group = new THREE.Group();
    const ring1Geo = track(new THREE.TorusGeometry(1.56, 0.052, 20, 96));
    const ring1Mat = track(
      new THREE.MeshStandardMaterial({
        color: 0xcbd5e1,
        metalness: 0.94,
        roughness: 0.15,
      })
    );
    const ring1Mesh = new THREE.Mesh(ring1Geo, ring1Mat);
    ring1Group.add(ring1Mesh);

    const lugGeo = track(new THREE.BoxGeometry(0.16, 0.12, 0.18));
    const lugMat = track(
      new THREE.MeshStandardMaterial({
        color: 0x14b8a6,
        emissive: 0x0f766e,
        emissiveIntensity: 0.4,
        metalness: 0.65,
        roughness: 0.35,
      })
    );
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      const lug = new THREE.Mesh(lugGeo, lugMat);
      lug.position.set(Math.cos(angle) * 1.56, Math.sin(angle) * 1.56, 0);
      lug.rotation.z = angle;
      ring1Group.add(lug);
    }
    heroGroup.add(ring1Group);

    // 4. Secondary Tilted Gyroscope Ring
    const ring2Geo = track(new THREE.TorusGeometry(1.9, 0.036, 18, 96));
    const ring2Mat = track(
      new THREE.MeshStandardMaterial({
        color: 0x14b8a6,
        emissive: 0x0f766e,
        emissiveIntensity: 0.3,
        metalness: 0.85,
        roughness: 0.25,
      })
    );
    const ring2Mesh = new THREE.Mesh(ring2Geo, ring2Mat);
    ring2Mesh.rotation.set(Math.PI / 3, Math.PI / 5, 0);
    heroGroup.add(ring2Mesh);

    // 5. Outer Calibrated Meridian Ring + 12 Instanced Markers
    const ring3Group = new THREE.Group();
    const ring3Geo = track(new THREE.TorusGeometry(2.24, 0.022, 16, 110));
    const ring3Mat = track(
      new THREE.MeshStandardMaterial({
        color: 0x475569,
        metalness: 0.9,
        roughness: 0.32,
      })
    );
    ring3Group.add(new THREE.Mesh(ring3Geo, ring3Mat));

    const markerGeo = track(new THREE.OctahedronGeometry(0.058, 0));
    const markerMat = track(
      new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        emissive: 0x2dd4bf,
        emissiveIntensity: 0.5,
        metalness: 0.8,
        roughness: 0.2,
      })
    );
    const markersInstanced = new THREE.InstancedMesh(markerGeo, markerMat, 12);
    for (let i = 0; i < 12; i++) {
      const theta = (i / 12) * Math.PI * 2;
      _pos.set(Math.cos(theta) * 2.24, Math.sin(theta) * 2.24, 0);
      _euler.set(0, 0, theta);
      _quat.setFromEuler(_euler);
      _scale.set(1, 1, 1);
      _mat4.compose(_pos, _quat, _scale);
      markersInstanced.setMatrixAt(i, _mat4);
    }
    markersInstanced.instanceMatrix.needsUpdate = true;
    markersInstanced.computeBoundingSphere();
    ring3Group.add(markersInstanced);
    ring3Group.rotation.set(-Math.PI / 4, Math.PI / 6, 0);
    heroGroup.add(ring3Group);

    // 6. 84 Instanced Neural Orbit Particles
    const particleCount = 84;
    const particleGeo = track(new THREE.SphereGeometry(0.032, 8, 8));
    const particleMat = track(
      new THREE.MeshBasicMaterial({
        color: 0x5eead4,
        transparent: true,
        opacity: 0.85,
      })
    );
    const particlesMesh = new THREE.InstancedMesh(particleGeo, particleMat, particleCount);
    particlesMesh.frustumCulled = false;

    const particleParams = Array.from({ length: particleCount }, (_, idx) => {
      const r = 2.6 + (idx % 7) * 0.35;
      const speed = (0.35 + (idx % 5) * 0.14) * (idx % 2 === 0 ? 1 : -1);
      const phase = (idx / particleCount) * Math.PI * 2;
      const tiltX = ((idx * 17) % 100) * 0.015 - 0.75;
      const tiltZ = ((idx * 29) % 100) * 0.015 - 0.75;
      const s = 0.55 + (idx % 4) * 0.25;
      return { r, speed, phase, tiltX, tiltZ, s };
    });
    scene.add(particlesMesh);

    // 7. Grounding Studio Floor Glow Disc
    const floorTex = track(createFloorGlowTexture());
    const floorGeo = track(new THREE.CircleGeometry(3.2, 48));
    const floorMat = track(
      new THREE.MeshBasicMaterial({
        map: floorTex,
        transparent: true,
        depthWrite: false,
      })
    );
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = -2.45;
    scene.add(floorMesh);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Pointer Parallax State
    let targetTiltX = 0;
    let targetTiltY = 0;
    const onPointerMove = (e: PointerEvent) => {
      const nx = (e.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
      const ny = (e.clientY / Math.max(1, window.innerHeight)) * 2 - 1;
      targetTiltY = nx * 0.35;
      targetTiltX = ny * 0.25;
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = Math.max(1, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    const tick = () => {
      if (disposed) return;
      const delta = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();

      if (!prefersReducedMotion) {
        // Core breathing & rotation
        coreMesh.rotation.y += delta * 0.95;
        coreMesh.rotation.x = Math.sin(elapsed * 1.1) * 0.28;
        const breath = 1 + Math.sin(elapsed * 2.4) * 0.045;
        coreMesh.scale.setScalar(breath);

        cageMesh.rotation.y -= delta * 0.45;
        cageMesh.rotation.z += delta * 0.25;

        ring1Group.rotation.x += delta * 0.65;
        ring1Group.rotation.y += delta * 0.35;

        ring2Mesh.rotation.y -= delta * 0.85;
        ring2Mesh.rotation.z += delta * 0.4;

        ring3Group.rotation.z -= delta * 0.32;
        ring3Group.rotation.x += delta * 0.18;

        // Smooth pointer tilt damping
        heroGroup.rotation.x = THREE.MathUtils.damp(heroGroup.rotation.x, targetTiltX, 4.5, delta);
        heroGroup.rotation.y = THREE.MathUtils.damp(heroGroup.rotation.y, targetTiltY, 4.5, delta);
        heroGroup.position.y = Math.sin(elapsed * 1.6) * 0.09;

        // Orbit particles
        for (let i = 0; i < particleCount; i++) {
          const p = particleParams[i];
          const a = p.phase + elapsed * p.speed;
          const x = Math.cos(a) * p.r;
          const z = Math.sin(a) * p.r;
          const y = Math.sin(a + p.tiltX) * p.r * 0.38 + Math.cos(a + p.tiltZ) * 0.25;
          _pos.set(x, y, z);
          _quat.identity();
          _scale.setScalar(p.s);
          _mat4.compose(_pos, _quat, _scale);
          particlesMesh.setMatrixAt(i, _mat4);
        }
        particlesMesh.instanceMatrix.needsUpdate = true;
      }

      renderer.render(scene, camera);

      if (prefersReducedMotion) return;
      if (isSoftwareGl) afterDraw(tick);
      else frameId = requestAnimationFrame(tick);
    };

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("resize", onResize);
      renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
      renderer.domElement.removeEventListener("webglcontextrestored", onContextRestored);

      for (const d of disposables) {
        d.dispose();
      }
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  const stageText =
    progress < 35
      ? "در حال آماده‌سازی هسته هوشمند..."
      : progress < 75
        ? "راه‌اندازی موتور جستجو و امنیت حساب..."
        : "ورود به فضای کار یارا...";

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col justify-between overflow-hidden bg-[#060B13] text-white transition-opacity duration-300 ${
        fadingOut ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      {/* Dedicated Isolated WebGL Container */}
      <div ref={mountRef} className="absolute inset-0" />

      {webglUnavailable && (
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(20,184,166,0.22)_0%,rgba(6,11,19,1)_68%)]" />
      )}

      {/* Top Minimal Brand Header */}
      <header className="relative z-10 flex items-center justify-between px-6 pt-6 sm:px-10">
        <span className="text-lg font-bold tracking-tight text-white">یارا</span>
        <span className="text-xs text-slate-400 tabular-nums">دستیار هوشمند واقعی</span>
      </header>

      {/* Center Spacer keeping 3D subject 100% unobstructed */}
      <div className="pointer-events-none relative z-10 flex-1" />

      {/* Bottom Clean HUD Dock */}
      <footer className="relative z-10 mx-auto w-full max-w-md px-6 pb-8 sm:pb-10">
        <div className="rounded-2xl border border-white/10 bg-[#0B1220]/90 p-5">
          <div className="flex items-center justify-between gap-4 text-xs">
            <span className="font-medium text-slate-200">{stageText}</span>
            <span className="font-mono text-teal-400 tabular-nums">{progress}%</span>
          </div>

          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-teal-500 transition-[width] duration-100 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="text-[11px] text-slate-400">
              جستجوی زنده · تحلیل تصویر و صدا · ذخیره ابری
            </span>
            <button
              type="button"
              onClick={finish}
              className="flex min-h-[40px] items-center gap-1.5 rounded-xl bg-teal-600 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-teal-500 whitespace-nowrap shrink-0"
            >
              <span>ورود</span>
              <ArrowLeft className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
