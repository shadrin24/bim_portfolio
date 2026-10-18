import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildDemoScene } from './demoScene';
import style from './ModelViewer.module.css';

export type ViewerLayerSource = {
  id: string;
  modelUrl?: string;
  demoScene?: boolean;
};

type ModelViewerProps = {
  /** Несколько слоёв (КР / ТХ). Если пусто — modelUrl / demoScene */
  layers?: ViewerLayerSource[] | null;
  modelUrl?: string;
  demoScene?: boolean;
  selectedId?: string | null;
  /** Несколько выделенных UniqueId (группа из Спеки) */
  selectedIds?: string[] | null;
  highlightIds?: string[] | null;
  /** UniqueId → phaseIndex; больше = позже → выше renderOrder */
  phaseIndexById?: Record<string, number> | null;
  /**
   * Стадии по слою: null — все стадии всех слоёв;
   * для слоя null — все стадии слоя; [] — ничего; иначе выбранные индексы.
   */
  visiblePhasesByLayer?: Record<string, number[] | null> | null;
  /** null — все слои; [] — ничего; иначе выбранные layer.id */
  visibleLayerIds?: string[] | null;
  /** Отметка земли из properties.json (Levels) — приоритет над groundElementIds */
  groundElevationM?: number | null;
  /** UniqueId элементов «земли» — запасной вариант, если elevation не задана */
  groundElementIds?: string[] | null;
  /** Всегда скрывать эти UniqueId (например стадия «Новая конструкция») */
  hiddenIds?: string[] | null;
  onSelect?: (elementId: string | null) => void;
};

const hasWebGL = () => {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
};

const collectMeshes = (root: THREE.Object3D) => {
  const meshes: THREE.Mesh[] = [];
  root.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) meshes.push(obj as THREE.Mesh);
  });
  return meshes;
};

/** Revit UniqueId: 8-4-4-4-12 hex + '-' + 8 hex (часто) */
const UNIQUE_ID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[0-9a-f]{8}/i;

const extractElementId = (...candidates: Array<string | undefined | null>) => {
  for (const raw of candidates) {
    if (!raw) continue;
    const match = raw.match(UNIQUE_ID_RE);
    if (match) return match[0];
  }
  for (const raw of candidates) {
    if (!raw) continue;
    if (raw !== 'Scene' && raw !== 'RootNode' && raw !== 'node' && raw.length > 8) {
      return raw;
    }
  }
  return null;
};

const assignIdsFromName = (root: THREE.Object3D, layerId?: string) => {
  root.traverse((obj) => {
    if (!(obj as THREE.Mesh).isMesh) return;
    if (layerId) obj.userData.layerId = layerId;
    if (obj.userData.elementId) return;
    const fromExtras =
      typeof obj.userData.revitUniqueId === 'string'
        ? obj.userData.revitUniqueId
        : typeof obj.userData.UniqueId === 'string'
          ? obj.userData.UniqueId
          : null;
    const id = extractElementId(fromExtras, obj.name, obj.parent?.name, obj.parent?.parent?.name);
    if (id) obj.userData.elementId = id;
  });
};

const meshVisibleForPhase = (
  mesh: THREE.Mesh,
  /** null — все стадии всех слоёв; иначе стадии по layerId (null = все стадии слоя) */
  allowedByLayer: Record<string, number[] | null> | null | undefined,
  byId: Record<string, number> | null,
) => {
  if (allowedByLayer == null) return true;
  const layerId = (mesh.userData.layerId as string | undefined) ?? 'default';
  const allowed =
    layerId in allowedByLayer
      ? allowedByLayer[layerId]
      : (allowedByLayer.default ?? null);
  if (allowed == null) return true;
  if (allowed.length === 0) return false;
  const allowedSet = new Set(allowed);
  const id = mesh.userData.elementId as string | undefined;
  const idx = id && byId ? byId[id] : undefined;
  if (typeof idx !== 'number') return true;
  return allowedSet.has(idx);
};

const meshVisibleForLayer = (mesh: THREE.Mesh, allowed: string[] | null | undefined) => {
  if (allowed == null) return true;
  if (allowed.length === 0) return false;
  const layerId = mesh.userData.layerId as string | undefined;
  if (!layerId) return true;
  return allowed.includes(layerId);
};

const applyMeshVisibility = (
  mesh: THREE.Mesh,
  layersAllowed: string[] | null | undefined,
  phasesByLayer: Record<string, number[] | null> | null | undefined,
  byId: Record<string, number> | null,
  hiddenIds?: Set<string> | null,
) => {
  const id = mesh.userData.elementId as string | undefined;
  if (id && hiddenIds?.has(id)) {
    mesh.visible = false;
    return;
  }
  mesh.visible =
    meshVisibleForLayer(mesh, layersAllowed) &&
    meshVisibleForPhase(mesh, phasesByLayer, byId);
};

/** Скрытые и полупрозрачные (ghost) не должны перехватывать клик */
const meshBlocksPointer = (mesh: THREE.Mesh) => {
  if (!mesh.visible) return false;
  if (mesh.userData.selectable === false) return false;
  return true;
};

const isMostlyOpaque = (mesh: THREE.Mesh) => {
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  return mats.some((m) => !m.transparent || (m.opacity ?? 1) >= 0.95);
};

const ModelViewer = ({
  layers = null,
  modelUrl,
  demoScene = false,
  selectedId = null,
  selectedIds = null,
  highlightIds = null,
  phaseIndexById = null,
  visiblePhasesByLayer = null,
  visibleLayerIds = null,
  groundElevationM = null,
  groundElementIds = null,
  hiddenIds = null,
  onSelect,
}: ModelViewerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const onSelectRef = useRef(onSelect);
  const groundElevRef = useRef(groundElevationM);
  const groundIdsRef = useRef(groundElementIds);
  const phaseIndexRef = useRef(phaseIndexById);
  const [webglOk] = useState(hasWebGL);

  const layersKey = (layers ?? [])
    .map((l) => `${l.id}:${l.modelUrl ?? ''}:${l.demoScene ? 1 : 0}`)
    .join('|');

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    groundElevRef.current = groundElevationM;
  }, [groundElevationM]);

  useEffect(() => {
    groundIdsRef.current = groundElementIds;
  }, [groundElementIds]);

  useEffect(() => {
    phaseIndexRef.current = phaseIndexById;
  }, [phaseIndexById]);

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorText, setErrorText] = useState('');
  const apiRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    meshes: THREE.Mesh[];
    defaultMaterials: Map<THREE.Mesh, THREE.Material | THREE.Material[]>;
  } | null>(null);

  useEffect(() => {
    if (!webglOk || !containerRef.current) return;

    const container = containerRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a1628);

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);
    camera.position.set(12, 10, 14);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 1.5, 0);

    const hemi = new THREE.HemisphereLight(0xb8e8ff, 0x1a2a3a, 1.1);
    scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 1.2);
    dir.position.set(8, 14, 6);
    dir.castShadow = true;
    scene.add(dir);
    scene.add(new THREE.AmbientLight(0xffffff, 0.25));

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let disposed = false;
    let modelRoot: THREE.Object3D | null = null;
    let grid: THREE.GridHelper | null = null;
    const layerSources: ViewerLayerSource[] =
      layers && layers.length > 0
        ? layers
        : [{ id: 'default', modelUrl, demoScene }];

    /** Revit/glTF: центр в плане; Y=0 — «Уровень земли» из properties.ground */
    const centerModelOnOrigin = (root: THREE.Object3D) => {
      assignIdsFromName(root);
      root.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(root);
      if (box.isEmpty()) return new THREE.Vector3(10, 10, 10);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());

      let groundY = box.min.y;
      const elev = groundElevRef.current;
      if (typeof elev === 'number' && Number.isFinite(elev)) {
        groundY = elev;
      } else {
        const groundIds = new Set(groundIdsRef.current ?? []);
        if (groundIds.size > 0) {
          const groundBox = new THREE.Box3();
          let found = false;
          root.traverse((obj) => {
            if (!(obj as THREE.Mesh).isMesh) return;
            const id =
              (obj.userData.elementId as string | undefined) ||
              extractElementId(obj.name, obj.parent?.name, obj.parent?.parent?.name);
            if (!id || !groundIds.has(id)) return;
            groundBox.expandByObject(obj);
            found = true;
          });
          if (found && !groundBox.isEmpty()) {
            groundY = groundBox.max.y;
          }
        }
      }

      root.position.x += -center.x;
      root.position.z += -center.z;
      root.position.y += -groundY;
      root.updateMatrixWorld(true);
      return size;
    };

    const placeGrid = (size: THREE.Vector3) => {
      if (grid) {
        scene.remove(grid);
        grid.geometry.dispose();
        const mats = grid.material;
        if (Array.isArray(mats)) mats.forEach((m) => m.dispose());
        else mats.dispose();
        grid = null;
      }
      const extent = Math.max(size.x, size.z, 4) * 1.6;
      grid = new THREE.GridHelper(extent, 20, 0x1a3344, 0x121c28);
      const gridMats = Array.isArray(grid.material) ? grid.material : [grid.material];
      gridMats.forEach((mat, i) => {
        mat.transparent = true;
        mat.opacity = i === 0 ? 0.2 : 0.09;
        mat.depthWrite = false;
      });
      grid.position.y = 0;
      scene.add(grid);
    };

    const fitCamera = (object: THREE.Object3D) => {
      const box = new THREE.Box3().setFromObject(object);
      if (box.isEmpty()) return;
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const distance = maxDim * 1.8;
      camera.position.set(center.x + distance, center.y + distance * 0.7, center.z + distance);
      controls.target.copy(center);
      controls.update();
    };

    const applyPhaseRenderOrder = (meshes: THREE.Mesh[]) => {
      const byId = phaseIndexRef.current;
      meshes.forEach((mesh) => {
        const id = mesh.userData.elementId as string | undefined;
        const idx = id && byId ? byId[id] : undefined;
        // Последняя стадия рисуется поверх (выше renderOrder)
        mesh.renderOrder = typeof idx === 'number' ? idx + 1 : 0;
      });
    };

    const registerMeshes = (root: THREE.Object3D) => {
      const size = centerModelOnOrigin(root);
      placeGrid(size);
      const meshes = collectMeshes(root);
      const defaultMaterials = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
      meshes.forEach((mesh) => {
        defaultMaterials.set(mesh, mesh.material);
      });
      applyPhaseRenderOrder(meshes);
      apiRef.current = { scene, camera, controls, meshes, defaultMaterials };
      fitCamera(root);
      setStatus('ready');
    };

    const loadLayerRoot = async (layer: ViewerLayerSource): Promise<THREE.Object3D | null> => {
      if (layer.modelUrl) {
        try {
          const loader = new GLTFLoader();
          const gltf = await loader.loadAsync(layer.modelUrl);
          assignIdsFromName(gltf.scene, layer.id);
          return gltf.scene;
        } catch {
          // Файл ещё не выгружен (часто ТХ) — слой пропускаем, не валим всю сцену
          if (layer.demoScene) {
            const demo = buildDemoScene();
            assignIdsFromName(demo, layer.id);
            return demo;
          }
          return null;
        }
      }
      if (layer.demoScene) {
        const demo = buildDemoScene();
        assignIdsFromName(demo, layer.id);
        return demo;
      }
      return null;
    };

    const loadModel = async () => {
      setStatus('loading');
      try {
        const sources = layerSources;
        const group = new THREE.Group();
        group.name = 'layers';
        let loaded = 0;
        for (const layer of sources) {
          const root = await loadLayerRoot(layer);
          if (!root) continue;
          group.add(root);
          loaded += 1;
        }

        if (loaded === 0) {
          if (demoScene || !modelUrl) {
            const demo = buildDemoScene();
            assignIdsFromName(demo, sources[0]?.id ?? 'default');
            group.add(demo);
          } else {
            // Все выбранные слои пока без геометрии — пустая сцена с сеткой
            modelRoot = group;
            scene.add(group);
            placeGrid(new THREE.Vector3(10, 1, 10));
            apiRef.current = {
              scene,
              camera,
              controls,
              meshes: [],
              defaultMaterials: new Map(),
            };
            setStatus('ready');
            return;
          }
        }

        modelRoot = group;
        scene.add(group);
        registerMeshes(group);
      } catch (err) {
        setStatus('error');
        setErrorText(err instanceof Error ? err.message : 'Не удалось загрузить модель');
      }
    };

    const resize = () => {
      const width = container.clientWidth || 1;
      const height = container.clientHeight || 1;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };

    // Выбор только по клику без драга — иначе орбита OrbitControls сбрасывает выделение.
    const CLICK_MAX_MOVE_PX = 5;
    let pointerDown: { x: number; y: number; button: number } | null = null;

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      pointerDown = { x: event.clientX, y: event.clientY, button: event.button };
    };

    const onPointerUp = (event: PointerEvent) => {
      if (!pointerDown || event.button !== pointerDown.button) return;
      const dx = event.clientX - pointerDown.x;
      const dy = event.clientY - pointerDown.y;
      const dragged = dx * dx + dy * dy > CLICK_MAX_MOVE_PX * CLICK_MAX_MOVE_PX;
      pointerDown = null;
      if (dragged) return;
      if (!apiRef.current || !onSelectRef.current) return;

      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const candidates = apiRef.current.meshes.filter(meshBlocksPointer);
      const hits = raycaster.intersectObjects(candidates, false);
      if (!hits.length) {
        onSelectRef.current(null);
        return;
      }
      // Сквозь ghost — сначала непрозрачный акцент, иначе ТХ внутри КР, иначе ближайший
      const opaqueHit = hits.find((h) => isMostlyOpaque(h.object as THREE.Mesh));
      const txHit = hits.find((h) => (h.object.userData.layerId as string | undefined) === 'tx');
      const chosen = opaqueHit ?? txHit ?? hits[0];
      const id = (chosen.object.userData.elementId as string | undefined) ?? null;
      onSelectRef.current(id);
    };

    const onPointerCancel = () => {
      pointerDown = null;
    };

    const animate = () => {
      if (disposed) return;
      controls.update();
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };

    resize();
    void loadModel();
    animate();

    const ro = new ResizeObserver(resize);
    ro.observe(container);
    const canvas = renderer.domElement;
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerCancel);

    return () => {
      disposed = true;
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerCancel);
      controls.dispose();
      renderer.dispose();
      if (grid) {
        scene.remove(grid);
        grid.geometry.dispose();
        const mats = grid.material;
        if (Array.isArray(mats)) mats.forEach((m) => m.dispose());
        else mats.dispose();
      }
      if (modelRoot) {
        scene.remove(modelRoot);
      }
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
      apiRef.current = null;
    };
    // layersKey отражает состав слоёв; сами layers читаются из замыкания на момент монтирования
    // eslint-disable-next-line react-hooks/exhaustive-deps -- layersKey
  }, [webglOk, modelUrl, demoScene, layersKey]);

  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;
    api.meshes.forEach((mesh) => {
      const id = mesh.userData.elementId as string | undefined;
      const idx = id && phaseIndexById ? phaseIndexById[id] : undefined;
      mesh.renderOrder = typeof idx === 'number' ? idx + 1 : 0;
    });
  }, [phaseIndexById, status]);

  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;
    const hidden = hiddenIds?.length ? new Set(hiddenIds) : null;
    api.meshes.forEach((mesh) => {
      applyMeshVisibility(
        mesh,
        visibleLayerIds,
        visiblePhasesByLayer,
        phaseIndexById,
        hidden,
      );
    });
  }, [visibleLayerIds, visiblePhasesByLayer, phaseIndexById, hiddenIds, status]);

  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;

    const highlightSet = new Set(highlightIds ?? []);
    const selectedSet = new Set(
      selectedIds?.length ? selectedIds : selectedId ? [selectedId] : [],
    );
    const created: THREE.Material[] = [];

    const styleMaterial = (source: THREE.Material, mode: 'ghost' | 'accent') => {
      const mat = source.clone() as THREE.MeshStandardMaterial;
      if (!('color' in mat) || !mat.color) {
        const fallback = new THREE.MeshStandardMaterial({ color: 0x7a8fa8 });
        created.push(fallback);
        return styleMaterial(fallback, mode);
      }

      if (mode === 'ghost') {
        // Постоянная полупрозрачность (и без выбора)
        mat.transparent = true;
        mat.opacity = 0.28;
        mat.depthWrite = false;
        mat.metalness = Math.min(mat.metalness ?? 0.2, 0.25);
        mat.roughness = Math.max(mat.roughness ?? 0.55, 0.45);
      } else {
        mat.color = new THREE.Color(0x00e5ff);
        mat.emissive = new THREE.Color(0x003844);
        mat.transparent = false;
        mat.opacity = 1;
        mat.depthWrite = true;
        mat.metalness = 0.2;
        mat.roughness = 0.4;
      }
      mat.needsUpdate = true;
      created.push(mat);
      return mat;
    };

    const styleSlot = (
      original: THREE.Material | THREE.Material[],
      mode: 'ghost' | 'accent',
    ) => {
      if (Array.isArray(original)) {
        return original.map((m) => styleMaterial(m, mode));
      }
      return styleMaterial(original, mode);
    };

    api.meshes.forEach((mesh) => {
      const id = mesh.userData.elementId as string | undefined;
      const original = api.defaultMaterials.get(mesh);
      if (!original) return;

      if (!mesh.visible) {
        mesh.material = original;
        mesh.userData.selectable = false;
        return;
      }

      const isSelected = Boolean(id && selectedSet.has(id));
      const isHighlighted = Boolean(id && highlightSet.has(id));

      if (isSelected || isHighlighted) {
        mesh.material = styleSlot(original, 'accent');
        mesh.userData.selectable = true;
        return;
      }
      // Постоянный ghost — кликабельно (через стакан предпочтение у ТХ в raycast)
      mesh.material = styleSlot(original, 'ghost');
      mesh.userData.selectable = true;
    });

    return () => {
      api.meshes.forEach((mesh) => {
        const original = api.defaultMaterials.get(mesh);
        if (original) mesh.material = original;
      });
      created.forEach((m) => m.dispose());
    };
  }, [selectedId, selectedIds, highlightIds, status, visiblePhasesByLayer, visibleLayerIds]);

  const fitView = () => {
    const api = apiRef.current;
    if (!api || !api.meshes.length) return;
    const box = new THREE.Box3();
    api.meshes.forEach((m) => {
      if (m.visible) box.expandByObject(m);
    });
    if (box.isEmpty()) return;
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const distance = maxDim * 1.8;
    api.camera.position.set(center.x + distance, center.y + distance * 0.7, center.z + distance);
    api.controls.target.copy(center);
    api.controls.update();
  };

  if (!webglOk) {
    return (
      <div className={style.fallback} role="status">
        <p className={style.fallbackTitle}>3D недоступен</p>
        <p className={style.fallbackText}>
          Браузер не поддерживает WebGL. Откройте страницу в современном браузере или обновите драйверы видеокарты.
        </p>
      </div>
    );
  }

  return (
    <div className={style.wrapper}>
      <div ref={containerRef} className={style.canvas} aria-label="3D-модель проекта" />
      <div className={style.toolbar}>
        <button type="button" className={style.toolBtn} onClick={fitView}>
          Показать всё
        </button>
        <button type="button" className={style.toolBtn} onClick={() => onSelect?.(null)}>
          Сбросить выбор
        </button>
      </div>
      {status === 'loading' && <div className={style.overlay}>Загрузка модели…</div>}
      {status === 'error' && (
        <div className={style.overlay}>
          Ошибка загрузки: {errorText}
          {demoScene ? null : '. Включите demoScene или положите glTF в public/models/.'}
        </div>
      )}
    </div>
  );
};

export default ModelViewer;
