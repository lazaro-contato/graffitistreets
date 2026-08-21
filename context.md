# Graffiti Center — Especificação Técnica Completa

> Cidade virtual 3D no navegador onde pessoas andam por uma rua e grafitam os muros.
> **Stack:** Three.js `0.185.x` + Vite + TypeScript. MVP 100% client-side, arquitetura preparada para "cidades" multiplayer.

Este documento é o guia de implementação. Contém setup, constantes, especificação módulo a módulo com código de referência para as partes difíceis, e critérios de aceite por fase.

---

## Índice

1. [Visão e escopo](#1-visão-e-escopo)
2. [Setup do projeto](#2-setup-do-projeto)
3. [Constantes do mundo](#3-constantes-do-mundo)
4. [Estrutura de arquivos](#4-estrutura-de-arquivos)
5. [Sistema de coordenadas](#5-sistema-de-coordenadas)
6. [Core — engine e loop](#6-core--engine-e-loop)
7. [World — rua e painéis de muro](#7-world--rua-e-painéis-de-muro)
8. [Player — movimento e colisão](#8-player--movimento-e-colisão)
9. [Paint — o coração do projeto](#9-paint--o-coração-do-projeto)
10. [State — journal de strokes](#10-state--journal-de-strokes)
11. [Net — a camada que garante o futuro](#11-net--a-camada-que-garante-o-futuro)
12. [UI e HUD](#12-ui-e-hud)
13. [Bootstrap — main.ts](#13-bootstrap--maints)
14. [Roadmap com critérios de aceite](#14-roadmap-com-critérios-de-aceite)
15. [Armadilhas conhecidas](#15-armadilhas-conhecidas)
16. [Performance](#16-performance)
17. [Deploy](#17-deploy)
18. [Backlog futuro](#18-backlog-futuro)

---



## 1. Visão e escopo

Uma rua reta com muro dos dois lados. Câmera em primeira pessoa. Você anda com WASD, escolhe uma cor na paleta, mira e segura o botão esquerdo para pintar. A tinta acumula gradualmente — perto pinta forte e concentrado, longe faz névoa.

**No MVP:** mundo estático, um jogador, pintura persistida só no navegador.

**Fora do MVP mas previsto na arquitetura:** backend, salas ("cidades") com limite de pessoas, avatares, sync em tempo real.

O objetivo do documento é que a Fase 5 (multiplayer) não exija reescrever nada da Fase 2. Isso se consegue com duas decisões tomadas agora: **guardar traços em vez de pixels** e **fazer toda pintura passar por uma camada de transporte**.

---



## 2. Setup do projeto

```bash
npm create vite@latest graffiti-center -- --template vanilla-ts
cd graffiti-center
npm install
npm install three
npm install -D @types/three
npm run dev
```



### package.json

```json
{
  "name": "graffiti-center",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "three": "^0.185.1"
  },
  "devDependencies": {
    "@types/three": "^0.185.4",
    "typescript": "^5.6.0",
    "vite": "^7.0.0"
  }
}
```



### tsconfig.json

O template do Vite já serve. Garanta:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUnusedLocals": true,
    "skipLibCheck": true,
    "types": ["vite/client"]
  },
  "include": ["src"]
}
```



### Dependências opcionais


| Pacote        | Quando adicionar                                             |
| ------------- | ------------------------------------------------------------ |
| `lil-gui`     | Fase 1-2, para tunar parâmetros do spray ao vivo. Vale muito |
| `idb-keyval`  | Fase 3, persistência local sem boilerplate de IndexedDB      |
| `stats.js`    | Fase 2, monitor de FPS                                       |
| `colyseus.js` | Fase 5, cliente multiplayer                                  |


**Não instale** `cannon-es` ou `@dimforge/rapier3d` — a colisão aqui é um corredor retangular, resolvida em ~20 linhas. Engine de física é peso morto até você querer objetos dinâmicos.

### index.html

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0, user-scalable=no"
    />
    <title>Graffiti Center</title>
    <link rel="stylesheet" href="/src/ui/styles.css" />
  </head>
  <body>
    <canvas id="app"></canvas>

    <div id="overlay">
      <div class="panel">
        <h1>Graffiti Center</h1>
        <p>
          WASD para andar · Mouse para olhar · Segure o botão esquerdo para
          pintar
        </p>
        <button id="start">Entrar na cidade</button>
      </div>
    </div>

    <div id="hud" hidden>
      <div id="crosshair"></div>
      <div id="palette"></div>
    </div>

    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

---



## 3. Constantes do mundo

Tudo em um arquivo só. Você vai mexer muito nesses números.

`src/config.ts`

```ts
export const WORLD = {
  STREET_LENGTH: 60, // metros, ao longo de Z
  STREET_WIDTH: 12, // metros, ao longo de X (de muro a muro)
  WALL_HEIGHT: 4,
  PANEL_WIDTH: 6, // largura de cada painel pintável
  SIDEWALK_WIDTH: 1.6,
  SIDEWALK_HEIGHT: 0.15,
} as const;

// 60 / 6 = 10 painéis por lado, 20 no total
export const PANELS_PER_SIDE = WORLD.STREET_LENGTH / WORLD.PANEL_WIDTH;
export const WALL_X = WORLD.STREET_WIDTH / 2; // muros em x = -6 e x = +6
export const HALF_LENGTH = WORLD.STREET_LENGTH / 2;

export const TEXTURE = {
  SIZE: 1024, // px por painel → 1024/6 ≈ 170 px por metro
  BASE_COLOR: "#8d8b86", // concreto
  NOISE_AMOUNT: 0.06,
} as const;

export const PLAYER = {
  EYE_HEIGHT: 1.7,
  RADIUS: 0.4,
  WALK_SPEED: 4.2, // m/s
  RUN_SPEED: 7.0,
  ACCELERATION: 40,
  DAMPING: 12,
} as const;

export const SPRAY = {
  MAX_DISTANCE: 9, // metros — além disso não pinta
  MIN_DISTANCE: 0.4,
  BASE_RADIUS_PX: 26, // ~15 cm na parede
  RADIUS_PER_METER: 0.35, // espalhamento por distância
  BASE_ALPHA: 0.1, // opacidade de cada dab
  ALPHA_FALLOFF: 0.5, // perda de opacidade por distância
  DAB_SPACING: 0.25, // fração do raio entre dabs interpolados
  SPECKLES: 22, // partículas de granulação por dab
  SPECKLE_SPREAD: 1.15, // quanto extrapolam o raio
} as const;

export const PALETTE = [
  "#ffffff",
  "#111111",
  "#e02020",
  "#ff7a00",
  "#ffd400",
  "#2ecc40",
  "#00b8d4",
  "#1e5fe0",
  "#8b2fd4",
  "#ff4fa3",
] as const;
```

**Sobre** `TEXTURE.SIZE`**:** 1024 é o ponto de equilíbrio. 20 painéis × 1024² × RGBA ≈ 80 MB de VRAM — confortável em qualquer máquina moderna. Se for para 2048, viram 320 MB e você começa a ter problema em laptops integrados.

---



## 4. Estrutura de arquivos

```
src/
  config.ts                 # todas as constantes
  main.ts                   # bootstrap

  core/
    Engine.ts               # renderer, scene, camera, resize
    Loop.ts                 # requestAnimationFrame + delta clamp
    Input.ts                # teclado, mouse, pointer lock

  world/
    Street.ts               # monta rua, calçadas, céu, luzes
    WallPanel.ts            # mesh + canvas + CanvasTexture de um painel
    WallSystem.ts           # coleção de painéis, lookup por id, flush de dirty
    Colliders.ts            # limites do corredor

  player/
    Player.ts               # estado + integração da câmera
    Movement.ts             # aceleração, damping, clamp de colisão

  paint/
    SprayCan.ts             # cor, tamanho, fluxo atuais
    Brush.ts                # desenha um dab no canvas 2D (função pura)
    PaintSystem.ts          # raycast → constrói Stroke → emite pelo Transport
    StrokeRenderer.ts       # aplica um Stroke no canvas do painel

  state/
    types.ts                # Stroke, PaintMessage, PlayerState
    StrokeStore.ts          # journal por painel, undo, replay

  net/
    Transport.ts            # interface
    LocalTransport.ts       # eco imediato + persistência local
    (SocketTransport.ts)    # fase 5

  ui/
    styles.css
    Hud.ts                  # crosshair, paleta, overlay de entrada
```

**Regra de dependência:** as setas apontam sempre para baixo. `paint/` não conhece `net/` além da interface `Transport`. `world/` não conhece `paint/`. Nada em `world/` ou `player/` importa de `ui/`.

---



## 5. Sistema de coordenadas

Fixe isto antes de escrever qualquer código de geometria — quase todo bug de posicionamento vem de confusão aqui.

```
        Y (cima)
        │
        │
        └────── X (largura da rua)
       ╱
      Z (comprimento da rua)
```

- A rua corre ao longo de **Z**, de `-30` a `+30`
- A largura corre ao longo de **X**, de `-6` a `+6`
- Muro esquerdo em `x = -6`, com a face pintável olhando para `+X`
- Muro direito em `x = +6`, com a face pintável olhando para `-X`
- Chão em `y = 0`, topo dos muros em `y = 4`
- Olhos do jogador em `y = 1.7`

**Rotação dos painéis:** `PlaneGeometry` nasce no plano XY com a normal apontando para `+Z`. Girar `π/2` em Y leva a normal para `+X` (muro esquerdo). Girar `-π/2` leva para `-X` (muro direito).

**UV do plano:** `(0,0)` no canto inferior-esquerdo visto de frente, `(1,1)` no superior-direito. Para converter em pixel do canvas, o Y inverte:

```ts
const px = uv.x * TEXTURE.SIZE;
const py = (1 - uv.y) * TEXTURE.SIZE;
```

---



## 6. Core — engine e loop



### `core/Engine.ts`

Responsável por renderer, cena, câmera e resize. Nada de gameplay aqui.

```ts
import * as THREE from "three";

export class Engine {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#9db4c8");
    this.scene.fog = new THREE.Fog("#9db4c8", 30, 90);

    this.camera = new THREE.PerspectiveCamera(
      72,
      window.innerWidth / window.innerHeight,
      0.1,
      200,
    );

    window.addEventListener("resize", this.onResize);
    this.onResize();
  }

  private onResize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
```

> `setPixelRatio` **limitado a 2** é importante. Em telas 3x, renderizar na resolução nativa custa 2,25× mais pixels sem ganho visual perceptível.



### `core/Loop.ts`

```ts
type UpdateFn = (dt: number, elapsed: number) => void;

export class Loop {
  private clock = { last: performance.now(), elapsed: 0 };
  private callbacks: UpdateFn[] = [];
  private running = false;

  add(fn: UpdateFn) {
    this.callbacks.push(fn);
  }

  start() {
    this.running = true;
    this.clock.last = performance.now();
    requestAnimationFrame(this.tick);
  }

  stop() {
    this.running = false;
  }

  private tick = (now: number) => {
    if (!this.running) return;
    // clamp evita salto gigante ao voltar de uma aba em background
    const dt = Math.min((now - this.clock.last) / 1000, 0.05);
    this.clock.last = now;
    this.clock.elapsed += dt;
    for (const fn of this.callbacks) fn(dt, this.clock.elapsed);
    requestAnimationFrame(this.tick);
  };
}
```

> O **clamp de 50 ms** não é detalhe cosmético: sem ele, trocar de aba por 30 segundos gera um `dt` de 30 e o jogador atravessa o mundo inteiro no primeiro frame de volta.



### `core/Input.ts`

```ts
export class Input {
  private keys = new Set<string>();
  isPainting = false;

  constructor(domElement: HTMLElement) {
    window.addEventListener("keydown", (e) => this.keys.add(e.code));
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
    window.addEventListener("blur", () => {
      this.keys.clear();
      this.isPainting = false;
    });

    domElement.addEventListener("mousedown", (e) => {
      if (e.button === 0) this.isPainting = true;
    });
    window.addEventListener("mouseup", (e) => {
      if (e.button === 0) this.isPainting = false;
    });
  }

  isDown(code: string) {
    return this.keys.has(code);
  }

  /** Vetor de input local: x = strafe, z = frente */
  getMoveVector(): { x: number; z: number } {
    let x = 0,
      z = 0;
    if (this.isDown("KeyW") || this.isDown("ArrowUp")) z += 1;
    if (this.isDown("KeyS") || this.isDown("ArrowDown")) z -= 1;
    if (this.isDown("KeyD") || this.isDown("ArrowRight")) x += 1;
    if (this.isDown("KeyA") || this.isDown("ArrowLeft")) x -= 1;
    const len = Math.hypot(x, z);
    return len > 0 ? { x: x / len, z: z / len } : { x: 0, z: 0 };
  }

  get isRunning() {
    return this.isDown("ShiftLeft") || this.isDown("ShiftRight");
  }
}
```

> O listener de `blur` resolve um bug irritante: alt-tab com W pressionado faz o jogador andar para sempre, porque o `keyup` acontece fora da janela.

---



## 7. World — rua e painéis de muro



### `world/WallPanel.ts`

Cada painel é a unidade atômica de pintura: uma mesh, um canvas e uma textura.

```ts
import * as THREE from "three";
import { WORLD, TEXTURE } from "../config";

export type Side = "left" | "right";

export class WallPanel {
  readonly id: number;
  readonly side: Side;
  readonly index: number;
  readonly mesh: THREE.Mesh;
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly texture: THREE.CanvasTexture;

  /** marcado quando o canvas muda; o WallSystem faz o flush uma vez por frame */
  dirty = false;

  constructor(id: number, side: Side, index: number) {
    this.id = id;
    this.side = side;
    this.index = index;

    this.canvas = document.createElement("canvas");
    this.canvas.width = TEXTURE.SIZE;
    this.canvas.height = TEXTURE.SIZE;
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: false })!;
    this.paintBase();

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;

    const geometry = new THREE.PlaneGeometry(
      WORLD.PANEL_WIDTH,
      WORLD.WALL_HEIGHT,
    );
    const material = new THREE.MeshStandardMaterial({
      map: this.texture,
      roughness: 0.95,
      metalness: 0.0,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.receiveShadow = true;
    this.mesh.userData.panelId = id;

    const x =
      side === "left" ? -WORLD.STREET_WIDTH / 2 : WORLD.STREET_WIDTH / 2;
    const z = -WORLD.STREET_LENGTH / 2 + WORLD.PANEL_WIDTH * (index + 0.5);
    this.mesh.position.set(x, WORLD.WALL_HEIGHT / 2, z);
    this.mesh.rotation.y = side === "left" ? Math.PI / 2 : -Math.PI / 2;
  }

  /** Concreto de base + ruído. Também usado no reset/replay. */
  paintBase() {
    const { ctx } = this;
    const s = TEXTURE.SIZE;

    ctx.fillStyle = TEXTURE.BASE_COLOR;
    ctx.fillRect(0, 0, s, s);

    // granulação do concreto
    const img = ctx.getImageData(0, 0, s, s);
    const data = img.data;
    for (let i = 0; i < data.length; i += 4) {
      const n = (Math.random() - 0.5) * 255 * TEXTURE.NOISE_AMOUNT;
      data[i] += n;
      data[i + 1] += n;
      data[i + 2] += n;
    }
    ctx.putImageData(img, 0, 0);

    // manchas de umidade para quebrar a uniformidade
    ctx.globalAlpha = 0.05;
    for (let i = 0; i < 12; i++) {
      const x = Math.random() * s,
        y = Math.random() * s;
      const r = 60 + Math.random() * 180;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, "#3a3a38");
      g.addColorStop(1, "rgba(58,58,56,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;

    this.dirty = true;
  }

  toDataURL() {
    return this.canvas.toDataURL("image/webp", 0.85);
  }
}
```



### `world/WallSystem.ts`

```ts
import * as THREE from "three";
import { WallPanel } from "./WallPanel";
import { PANELS_PER_SIDE } from "../config";

export class WallSystem {
  readonly panels: WallPanel[] = [];
  readonly group = new THREE.Group();

  constructor() {
    let id = 0;
    for (const side of ["left", "right"] as const) {
      for (let i = 0; i < PANELS_PER_SIDE; i++) {
        const panel = new WallPanel(id++, side, i);
        this.panels.push(panel);
        this.group.add(panel.mesh);
      }
    }
  }

  get(id: number) {
    return this.panels[id];
  }

  get meshes() {
    return this.panels.map((p) => p.mesh);
  }

  /** Chamado uma vez por frame, depois de toda a lógica de pintura. */
  flush() {
    for (const panel of this.panels) {
      if (panel.dirty) {
        panel.texture.needsUpdate = true;
        panel.dirty = false;
      }
    }
  }
}
```

> **Por que o flush existe:** `texture.needsUpdate = true` agenda um upload de 4 MB para a GPU. Se você marcar isso dentro do loop de dabs, um único traço dispara dezenas de uploads do mesmo painel no mesmo frame. O flag `dirty` colapsa tudo em um upload por painel por frame.



### `world/Street.ts`

```ts
import * as THREE from "three";
import { WORLD } from "../config";

export function buildStreet(scene: THREE.Scene) {
  // asfalto
  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.STREET_WIDTH, WORLD.STREET_LENGTH),
    new THREE.MeshStandardMaterial({ color: "#3a3a3c", roughness: 1 }),
  );
  road.rotation.x = -Math.PI / 2;
  road.receiveShadow = true;
  scene.add(road);

  // calçadas
  const swGeo = new THREE.BoxGeometry(
    WORLD.SIDEWALK_WIDTH,
    WORLD.SIDEWALK_HEIGHT,
    WORLD.STREET_LENGTH,
  );
  const swMat = new THREE.MeshStandardMaterial({
    color: "#6f6f6d",
    roughness: 0.9,
  });
  for (const sign of [-1, 1]) {
    const sw = new THREE.Mesh(swGeo, swMat);
    sw.position.set(
      sign * (WORLD.STREET_WIDTH / 2 - WORLD.SIDEWALK_WIDTH / 2),
      WORLD.SIDEWALK_HEIGHT / 2,
      0,
    );
    sw.receiveShadow = true;
    scene.add(sw);
  }

  // luzes
  const hemi = new THREE.HemisphereLight("#cfe0f0", "#4a4a44", 1.6);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight("#fff4e0", 2.2);
  sun.position.set(18, 26, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const d = 40;
  sun.shadow.camera.left = -d;
  sun.shadow.camera.right = d;
  sun.shadow.camera.top = d;
  sun.shadow.camera.bottom = -d;
  sun.shadow.camera.far = 90;
  sun.shadow.bias = -0.0005;
  scene.add(sun);
}
```

> `shadow.camera` **com bounds explícitos** é obrigatório. O default cobre uma área pequena e suas sombras somem no fim da rua. E `shadow.bias` negativo elimina o *shadow acne* — aquele padrão listrado nas superfícies iluminadas.

---



## 8. Player — movimento e colisão



### `player/Movement.ts`

```ts
import * as THREE from "three";
import { PLAYER, WALL_X, HALF_LENGTH } from "../config";

const forward = new THREE.Vector3();
const right = new THREE.Vector3();
const wish = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

export class Movement {
  velocity = new THREE.Vector3();

  update(
    camera: THREE.Camera,
    input: { x: number; z: number },
    running: boolean,
    dt: number,
  ) {
    // direção da câmera projetada no plano do chão
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    right.crossVectors(forward, UP).normalize();

    wish
      .set(0, 0, 0)
      .addScaledVector(forward, input.z)
      .addScaledVector(right, input.x);

    const speed = running ? PLAYER.RUN_SPEED : PLAYER.WALK_SPEED;

    // aceleração + damping exponencial
    this.velocity.addScaledVector(wish, PLAYER.ACCELERATION * dt);
    const damp = Math.exp(-PLAYER.DAMPING * dt);
    this.velocity.multiplyScalar(damp);

    if (this.velocity.length() > speed) {
      this.velocity.setLength(speed);
    }

    camera.position.addScaledVector(this.velocity, dt);
    this.collide(camera.position);
    camera.position.y = PLAYER.EYE_HEIGHT;
  }

  /** O mundo é um corredor: basta clampar. */
  private collide(pos: THREE.Vector3) {
    const limitX = WALL_X - PLAYER.RADIUS;
    const limitZ = HALF_LENGTH - PLAYER.RADIUS;

    if (pos.x < -limitX) {
      pos.x = -limitX;
      this.velocity.x = 0;
    }
    if (pos.x > limitX) {
      pos.x = limitX;
      this.velocity.x = 0;
    }
    if (pos.z < -limitZ) {
      pos.z = -limitZ;
      this.velocity.z = 0;
    }
    if (pos.z > limitZ) {
      pos.z = limitZ;
      this.velocity.z = 0;
    }
  }
}
```

> **Damping exponencial (**`Math.exp(-k·dt)`**) em vez de multiplicação fixa** é o detalhe que faz o movimento se comportar igual em 60 Hz e em 144 Hz. Multiplicar a velocidade por `0.9` a cada frame dá desaceleração diferente conforme o framerate.

Zerar a componente da velocidade ao bater no muro evita o jogador "colar" e deslizar de forma estranha ao andar rente à parede.

### `player/Player.ts`

```ts
import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { Movement } from "./Movement";
import { Input } from "../core/Input";
import { PLAYER } from "../config";

export class Player {
  readonly controls: PointerLockControls;
  private movement = new Movement();

  constructor(
    private camera: THREE.PerspectiveCamera,
    private input: Input,
    domElement: HTMLElement,
  ) {
    this.controls = new PointerLockControls(camera, domElement);
    camera.position.set(0, PLAYER.EYE_HEIGHT, 12);
  }

  update(dt: number) {
    if (!this.controls.isLocked) return;
    this.movement.update(
      this.camera,
      this.input.getMoveVector(),
      this.input.isRunning,
      dt,
    );
  }
}
```

> ⚠️ **API atual:** no Three.js `0.185`, `PointerLockControls` estende `Controls` e expõe a câmera em `controls.object`. O antigo `controls.getObject()` foi removido — tutoriais antigos ainda usam e vão quebrar.

---



## 9. Paint — o coração do projeto



### 9.1 Por que canvas 2D e não decals


| Abordagem                       | Como funciona                                                       | Veredito                                                      |
| ------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------- |
| `DecalGeometry`                 | Cada spray gera geometria nova colada na superfície                 | ❌ Cresce sem limite. Algumas centenas de sprays e o app trava |
| **Canvas 2D +** `CanvasTexture` | Raycast dá a UV, você desenha no canvas e marca a textura como suja | ✅ **Escolha do MVP**                                          |
| `WebGLRenderTarget` + shader    | Pinta quads de brush direto na GPU                                  | 🔜 Plano B se a performance apertar                           |


O canvas 2D vence porque é trivial de serializar (é só um PNG), trivial de debugar (dá para anexar o canvas no DOM e olhar) e rápido o bastante — o custo real é o upload da textura, que o sistema de `dirty` já resolve.

### 9.2 `paint/SprayCan.ts`

```ts
import { PALETTE, SPRAY } from "../config";

export class SprayCan {
  color: string = PALETTE[2];
  sizeMultiplier = 1; // roda do mouse ajusta
  flowMultiplier = 1;

  setColor(hex: string) {
    this.color = hex;
  }

  adjustSize(delta: number) {
    this.sizeMultiplier = Math.min(
      2.5,
      Math.max(0.4, this.sizeMultiplier + delta),
    );
  }

  radiusAt(distance: number) {
    return (
      SPRAY.BASE_RADIUS_PX *
      this.sizeMultiplier *
      (1 + distance * SPRAY.RADIUS_PER_METER)
    );
  }

  alphaAt(distance: number) {
    return (
      (SPRAY.BASE_ALPHA * this.flowMultiplier) /
      (1 + distance * SPRAY.ALPHA_FALLOFF)
    );
  }
}
```

> **Estas duas fórmulas são o gamefeel inteiro.** Chegar perto do muro pinta forte e concentrado; afastar faz névoa larga e fraca. É o que separa "funciona" de "dá vontade de continuar pintando". Exponha `RADIUS_PER_METER` e `ALPHA_FALLOFF` no `lil-gui` e gaste 15 minutos ajustando — vale mais que uma semana de features.



### 9.3 `paint/Brush.ts`

Função pura: recebe contexto e parâmetros, desenha um dab. Não conhece Three.js, não conhece estado.

```ts
import { SPRAY } from "../config";

function rgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function stampDab(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  alpha: number,
) {
  // núcleo suave
  const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
  grad.addColorStop(0, rgba(color, alpha));
  grad.addColorStop(0.55, rgba(color, alpha * 0.45));
  grad.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  // granulação: partículas com distribuição uniforme no disco
  const n = Math.round(SPRAY.SPECKLES * (radius / SPRAY.BASE_RADIUS_PX));
  for (let i = 0; i < n; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * radius * SPRAY.SPECKLE_SPREAD;
    const sx = x + Math.cos(angle) * r;
    const sy = y + Math.sin(angle) * r;
    ctx.fillStyle = rgba(color, alpha * (0.25 + Math.random() * 0.75));
    ctx.fillRect(sx, sy, 1.4, 1.4);
  }
}
```

> `Math.sqrt(Math.random())` é o detalhe matemático que importa. Usar `Math.random()` direto concentra as partículas no centro do disco, porque a área cresce com o quadrado do raio. A raiz quadrada corrige a distribuição e dá o padrão uniforme de spray real.



### 9.4 `paint/StrokeRenderer.ts`

Aplica um `Stroke` inteiro no canvas de um painel. Usado tanto ao pintar ao vivo quanto no replay do journal — é isso que garante que o replay produza exatamente o mesmo resultado.

```ts
import { stampDab } from "./Brush";
import { TEXTURE, SPRAY } from "../config";
import type { Stroke } from "../state/types";
import type { WallPanel } from "../world/WallPanel";

export function renderStroke(panel: WallPanel, stroke: Stroke) {
  const { ctx } = panel;
  const S = TEXTURE.SIZE;

  for (let i = 0; i < stroke.points.length; i++) {
    const p = stroke.points[i];
    const x = p.u * S;
    const y = (1 - p.v) * S;

    if (i === 0) {
      stampDab(ctx, x, y, p.r, stroke.color, p.a);
      continue;
    }

    // interpola do ponto anterior até o atual
    const prev = stroke.points[i - 1];
    const px = prev.u * S;
    const py = (1 - prev.v) * S;
    const dist = Math.hypot(x - px, y - py);
    const step = Math.max(1, p.r * SPRAY.DAB_SPACING);
    const steps = Math.ceil(dist / step);

    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      stampDab(
        ctx,
        px + (x - px) * t,
        py + (y - py) * t,
        prev.r + (p.r - prev.r) * t,
        stroke.color,
        prev.a + (p.a - prev.a) * t,
      );
    }
  }

  panel.dirty = true;
}
```

> **A interpolação não é opcional.** Sem ela, mover o mouse rápido produz bolinhas espaçadas em vez de um traço contínuo — o bug número um de qualquer sistema de pintura. O `DAB_SPACING` de 0.25 do raio é denso o suficiente para parecer sólido sem custar caro.



### 9.5 `paint/PaintSystem.ts`

O único lugar que faz raycast e constrói strokes. Note que ele **não desenha nada** — emite pelo `Transport`.

```ts
import * as THREE from "three";
import { SPRAY } from "../config";
import { SprayCan } from "./SprayCan";
import type { WallSystem } from "../world/WallSystem";
import type { Transport } from "../net/Transport";
import type { Stroke, StrokePoint } from "../state/types";

const CENTER = new THREE.Vector2(0, 0);

export class PaintSystem {
  private raycaster = new THREE.Raycaster();
  private activeStroke: Stroke | null = null;
  private activePanelId: number | null = null;
  private accum = 0;

  constructor(
    private camera: THREE.Camera,
    private walls: WallSystem,
    private can: SprayCan,
    private transport: Transport,
    private authorId: string,
  ) {
    this.raycaster.far = SPRAY.MAX_DISTANCE;
  }

  update(isPainting: boolean, dt: number) {
    if (!isPainting) {
      this.endStroke();
      return;
    }

    // amostragem fixa a 60 Hz, independente do framerate
    this.accum += dt;
    if (this.accum < 1 / 60) return;
    this.accum = 0;

    this.raycaster.setFromCamera(CENTER, this.camera);
    const hits = this.raycaster.intersectObjects(this.walls.meshes, false);
    if (hits.length === 0) {
      this.endStroke();
      return;
    }

    const hit = hits[0];
    if (!hit.uv || hit.distance < SPRAY.MIN_DISTANCE) return;

    const panelId = hit.object.userData.panelId as number;

    // mudou de painel? fecha o traço e abre outro
    if (this.activePanelId !== null && this.activePanelId !== panelId) {
      this.endStroke();
    }

    const point: StrokePoint = {
      u: hit.uv.x,
      v: hit.uv.y,
      r: this.can.radiusAt(hit.distance),
      a: this.can.alphaAt(hit.distance),
    };

    if (!this.activeStroke) {
      this.activeStroke = {
        id: crypto.randomUUID(),
        panelId,
        color: this.can.color,
        points: [point],
        authorId: this.authorId,
        t: Date.now(),
      };
      this.activePanelId = panelId;
    } else {
      this.activeStroke.points.push(point);
    }

    // emite o incremento — o Transport devolve e alguém desenha
    this.transport.send({
      kind: "stroke:append",
      strokeId: this.activeStroke.id,
      panelId,
      color: this.activeStroke.color,
      point,
      authorId: this.authorId,
    });
  }

  private endStroke() {
    if (this.activeStroke) {
      this.transport.send({
        kind: "stroke:end",
        strokeId: this.activeStroke.id,
      });
    }
    this.activeStroke = null;
    this.activePanelId = null;
  }
}
```

**Três decisões escondidas aqui que valem explicar:**

- **Amostragem a 60 Hz fixo, não por frame.** Num monitor de 165 Hz você geraria 165 pontos por segundo; num de 30 Hz, 30. O traço ficaria mais escuro em telas rápidas. Amostrar em cadência fixa faz a tinta acumular igual em qualquer máquina — e reduz o tráfego de rede na fase 5.
- **Emitir ponto a ponto, não o traço fechado.** Assim o multiplayer mostra o traço aparecendo ao vivo, não surgindo pronto quando a pessoa solta o botão.
- `raycaster.far` limitado evita pintar de longe *e* corta o custo do raycast.

---



## 10. State — journal de strokes



### `state/types.ts`

```ts
export type StrokePoint = {
  u: number; // 0..1 na largura do painel
  v: number; // 0..1 na altura
  r: number; // raio em px de textura
  a: number; // alpha do dab
};

export type Stroke = {
  id: string;
  panelId: number;
  color: string;
  points: StrokePoint[];
  authorId: string;
  t: number;
};

export type PaintMessage =
  | {
      kind: "stroke:append";
      strokeId: string;
      panelId: number;
      color: string;
      point: StrokePoint;
      authorId: string;
    }
  | { kind: "stroke:end"; strokeId: string }
  | { kind: "stroke:undo"; strokeId: string }
  | { kind: "panel:clear"; panelId: number };
```



### Por que traços e não pixels

Um `Stroke` típico ocupa ~200 bytes. Uma textura de painel em PNG ocupa ~500 KB. Para sincronizar em rede, a diferença é entre viável e inviável.

E o formato dá de graça:


| Recurso                | Como sai do journal                                  |
| ---------------------- | ---------------------------------------------------- |
| **Undo**               | Remove o stroke do array e re-renderiza o painel     |
| **Persistência local** | Serializa o array em JSON no IndexedDB               |
| **Multiplayer**        | O `PaintMessage` já *é* o pacote do WebSocket        |
| **Timelapse**          | Replay em ordem cronológica, com delay entre strokes |
| **Moderação**          | Remove os strokes de um `authorId` sem apagar o muro |




### `state/StrokeStore.ts`

```ts
import type { Stroke, StrokePoint } from "./types";
import type { WallSystem } from "../world/WallSystem";
import { renderStroke } from "../paint/StrokeRenderer";

export class StrokeStore {
  /** journal por painel, em ordem cronológica */
  private byPanel = new Map<number, Stroke[]>();
  private index = new Map<string, Stroke>();

  constructor(private walls: WallSystem) {}

  appendPoint(
    strokeId: string,
    panelId: number,
    color: string,
    point: StrokePoint,
    authorId: string,
  ) {
    let stroke = this.index.get(strokeId);

    if (!stroke) {
      stroke = {
        id: strokeId,
        panelId,
        color,
        points: [],
        authorId,
        t: Date.now(),
      };
      this.index.set(strokeId, stroke);
      const list = this.byPanel.get(panelId) ?? [];
      list.push(stroke);
      this.byPanel.set(panelId, list);
    }

    const prev = stroke.points[stroke.points.length - 1];
    stroke.points.push(point);

    // desenha só o segmento novo, não o traço inteiro
    const partial: Stroke = {
      ...stroke,
      points: prev ? [prev, point] : [point],
    };
    renderStroke(this.walls.get(panelId), partial);
  }

  undo(authorId: string) {
    // último stroke do autor, em qualquer painel
    let latest: Stroke | undefined;
    for (const list of this.byPanel.values()) {
      for (let i = list.length - 1; i >= 0; i--) {
        const s = list[i];
        if (s.authorId === authorId && (!latest || s.t > latest.t)) {
          latest = s;
          break;
        }
      }
    }
    if (!latest) return;

    const list = this.byPanel.get(latest.panelId)!;
    list.splice(list.indexOf(latest), 1);
    this.index.delete(latest.id);
    this.repaint(latest.panelId);
  }

  /** Reconstrói um painel do zero a partir do journal. */
  repaint(panelId: number) {
    const panel = this.walls.get(panelId);
    panel.paintBase();
    for (const stroke of this.byPanel.get(panelId) ?? []) {
      renderStroke(panel, stroke);
    }
  }

  serialize() {
    return JSON.stringify([...this.byPanel.entries()]);
  }

  load(json: string) {
    this.byPanel = new Map(JSON.parse(json));
    this.index.clear();
    for (const [panelId, list] of this.byPanel) {
      for (const s of list) this.index.set(s.id, s);
      this.repaint(panelId);
    }
  }
}
```

> **O truque do** `appendPoint`**:** ao receber um ponto novo, ele renderiza apenas o segmento entre o ponto anterior e o atual. Redesenhar o traço inteiro a cada ponto seria O(n²) e escureceria a tinta progressivamente, já que cada passada soma alpha por cima.

---



## 11. Net — a camada que garante o futuro

Esta é a decisão arquitetural que faz a Fase 5 custar dias em vez de semanas.

### `net/Transport.ts`

```ts
import type { PaintMessage } from "../state/types";

export interface Transport {
  send(message: PaintMessage): void;
  onMessage(handler: (message: PaintMessage) => void): void;
  connect(): Promise<void>;
  disconnect(): void;
}
```



### `net/LocalTransport.ts`

```ts
import type { Transport } from "./Transport";
import type { PaintMessage } from "../state/types";

export class LocalTransport implements Transport {
  private handlers: ((m: PaintMessage) => void)[] = [];

  async connect() {}
  disconnect() {}

  send(message: PaintMessage) {
    // modo local: eco imediato, sem round-trip
    for (const h of this.handlers) h(message);
  }

  onMessage(handler: (m: PaintMessage) => void) {
    this.handlers.push(handler);
  }
}
```



### O fluxo de dados

```
  input (botão pressionado)
        ↓
  PaintSystem  ── raycast → UV, distância → constrói StrokePoint
        ↓
  Transport.send(PaintMessage)
        ↓                          ← aqui entra a rede na fase 5
  Transport.onMessage
        ↓
  StrokeStore  ── guarda no journal
        ↓
  StrokeRenderer → canvas do painel → panel.dirty = true
        ↓
  WallSystem.flush() → texture.needsUpdate  (1× por frame)
```

**A regra de ouro: nenhum código de gameplay toca o canvas diretamente.** Toda pintura atravessa o `Transport`.

No modo local o `LocalTransport` devolve a mensagem no mesmo instante — nem dá para perceber que existe uma camada ali. Quando o `SocketTransport` entrar, a mensagem vai ao servidor e volta como broadcast. **Nenhum arquivo em** `paint/`**,** `world/` **ou** `state/` **muda.**

São umas duas horas de trabalho hoje. Sem isso, adicionar multiplayer significa reescrever o `PaintSystem` inteiro e caçar todos os pontos onde o canvas foi tocado direto.

Pelo mesmo motivo: modele `authorId` desde já, mesmo tendo só um jogador. Retrofitar identidade em código single-player é sempre doloroso — vira um `authorId` opcional espalhado por trinta lugares.

---



## 12. UI e HUD



### `ui/styles.css`

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
body {
  overflow: hidden;
  background: #000;
  font-family: system-ui, sans-serif;
}
canvas#app {
  display: block;
  width: 100vw;
  height: 100vh;
}

#overlay {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(10, 12, 16, 0.86);
  backdrop-filter: blur(6px);
  color: #f2f2f2;
  z-index: 10;
}
#overlay .panel {
  text-align: center;
  max-width: 30rem;
  padding: 2rem;
}
#overlay h1 {
  font-size: 2.5rem;
  margin-bottom: 0.75rem;
  letter-spacing: -0.02em;
}
#overlay p {
  opacity: 0.7;
  margin-bottom: 1.75rem;
  line-height: 1.6;
}
#overlay button {
  padding: 0.85rem 2rem;
  font-size: 1rem;
  border: 0;
  border-radius: 999px;
  background: #e02020;
  color: #fff;
  cursor: pointer;
  font-weight: 600;
}
#overlay button:hover {
  background: #ff3030;
}

#crosshair {
  position: fixed;
  left: 50%;
  top: 50%;
  width: 6px;
  height: 6px;
  margin: -3px 0 0 -3px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.85);
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.5);
  pointer-events: none;
}

#palette {
  position: fixed;
  bottom: 1.5rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 0.5rem;
  padding: 0.6rem 0.8rem;
  background: rgba(20, 22, 28, 0.75);
  border-radius: 999px;
  backdrop-filter: blur(8px);
}
#palette button {
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid rgba(255, 255, 255, 0.25);
}
#palette button[aria-pressed="true"] {
  border-color: #fff;
  transform: scale(1.15);
}
```



### `ui/Hud.ts`

```ts
import { PALETTE } from "../config";
import type { SprayCan } from "../paint/SprayCan";

export function buildHud(can: SprayCan) {
  const palette = document.getElementById("palette")!;

  PALETTE.forEach((hex) => {
    const btn = document.createElement("button");
    btn.style.background = hex;
    btn.setAttribute("aria-pressed", String(hex === can.color));
    btn.title = hex;

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      can.setColor(hex);
      palette
        .querySelectorAll("button")
        .forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
    });

    // teclas 1-9,0 selecionam cores
    palette.appendChild(btn);
  });

  window.addEventListener("keydown", (e) => {
    const n = parseInt(e.key, 10);
    if (!isNaN(n)) {
      const idx = n === 0 ? 9 : n - 1;
      const btn = palette.children[idx] as HTMLButtonElement | undefined;
      btn?.click();
    }
  });

  window.addEventListener(
    "wheel",
    (e) => {
      can.adjustSize(e.deltaY > 0 ? -0.1 : 0.1);
    },
    { passive: true },
  );
}
```

---



## 13. Bootstrap — main.ts

Onde tudo se conecta. Note como é curto: se ficar grande, alguma responsabilidade vazou para o lugar errado.

```ts
import { Engine } from "./core/Engine";
import { Loop } from "./core/Loop";
import { Input } from "./core/Input";
import { buildStreet } from "./world/Street";
import { WallSystem } from "./world/WallSystem";
import { Player } from "./player/Player";
import { SprayCan } from "./paint/SprayCan";
import { PaintSystem } from "./paint/PaintSystem";
import { StrokeStore } from "./state/StrokeStore";
import { LocalTransport } from "./net/LocalTransport";
import { buildHud } from "./ui/Hud";

const canvas = document.getElementById("app") as HTMLCanvasElement;
const overlay = document.getElementById("overlay")!;
const hud = document.getElementById("hud")!;

const engine = new Engine(canvas);
const loop = new Loop();
const input = new Input(canvas);

buildStreet(engine.scene);

const walls = new WallSystem();
engine.scene.add(walls.group);

const player = new Player(engine.camera, input, canvas);
const can = new SprayCan();
const store = new StrokeStore(walls);
const transport = new LocalTransport();
const authorId = crypto.randomUUID();

const paint = new PaintSystem(engine.camera, walls, can, transport, authorId);

// o loop de mensagens: tudo que é pintado passa por aqui
transport.onMessage((msg) => {
  switch (msg.kind) {
    case "stroke:append":
      store.appendPoint(
        msg.strokeId,
        msg.panelId,
        msg.color,
        msg.point,
        msg.authorId,
      );
      break;
    case "stroke:undo":
      store.undo(authorId);
      break;
    case "panel:clear":
      store.repaint(msg.panelId);
      break;
  }
});

buildHud(can);

document.getElementById("start")!.addEventListener("click", () => {
  player.controls.lock();
});

player.controls.addEventListener("lock", () => {
  overlay.hidden = true;
  hud.hidden = false;
});

player.controls.addEventListener("unlock", () => {
  overlay.hidden = false;
  hud.hidden = true;
});

window.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.code === "KeyZ") {
    transport.send({ kind: "stroke:undo", strokeId: "" });
  }
});

loop.add((dt) => {
  player.update(dt);
  paint.update(input.isPainting && player.controls.isLocked, dt);
  walls.flush();
  engine.render();
});

await transport.connect();
loop.start();
```

> **A ordem dentro do** `loop.add` **importa:** mover → pintar → flush → renderizar. Fazer o flush depois de toda a lógica de pintura é o que garante um upload de textura por painel por frame.

---



## 14. Roadmap com critérios de aceite



### Fase 0 — Fundação · ~1 dia

Vite + TS + Three funcionando, `Engine`, `Loop`, cena com um cubo e um chão, deploy automático.

**Aceite:** URL pública mostra um cubo girando; redimensionar a janela não distorce; `npm run typecheck` passa limpo.

---



### Fase 1 — Mundo e movimento · ~2-3 dias

`Street`, `WallPanel`, `WallSystem`, `Player`, `Movement`, `Input`, overlay de entrada com pointer lock.

**Aceite:**

- Dá para andar pela rua inteira com WASD e olhar com o mouse
- Não atravessa os muros nem as pontas
- Movimento se comporta igual com o FPS travado em 30 e em 144
- Sombras aparecem ao longo de toda a rua, sem listras de acne
- Alt-tab com W pressionado não deixa o jogador andando sozinho

---



### Fase 2 — Spray · ~3-4 dias ← **o MVP**

`SprayCan`, `Brush`, `StrokeRenderer`, `PaintSystem`, `StrokeStore`, `LocalTransport`, paleta, crosshair.

**Aceite:**

- Segurar o botão pinta um traço **contínuo**, sem pontilhado, mesmo movendo o mouse rápido
- Chegar perto pinta concentrado e forte; afastar faz névoa larga e fraca
- Passar várias vezes no mesmo lugar satura a cor gradualmente
- Trocar de cor com as teclas 1-0 funciona
- 3 minutos de pintura contínua sem queda de FPS perceptível
- Ctrl+Z remove o último traço

**Grave um GIF de 10 segundos aqui.** É o ativo mais valioso do projeto para portfólio.

---



### Fase 3 — Polimento · ~3-4 dias

- Som de spray em loop, com pitch variando conforme o movimento
- Persistência local: journal no IndexedDB, carregado ao entrar
- Botão "exportar meu painel como PNG"
- Modo foto (esconde o HUD, FOV ajustável)
- Preview do raio do spray projetado no muro (um ring decal ou um shader simples)
- Reservatório de tinta: a lata acaba e recarrega, para criar ritmo
- Mobile: joystick virtual + botão de spray

**Aceite:** recarregar a página mantém os grafites; um estranho consegue usar sem instruções.

---



### Fase 4 — Persistência no servidor · ~4-5 dias

Backend mínimo (Fastify + Postgres, ou Supabase). Salva journal + snapshot WebP por painel. Ao entrar, o cliente baixa os snapshots e aplica os strokes posteriores.

> **Padrão de event sourcing:** guarde o journal completo *e* um snapshot consolidado. Quem entra baixa o snapshot (rápido) e recebe só os traços posteriores a ele. Sem o snapshot, entrar num muro com 50 mil traços significaria replayar 50 mil traços.

**Aceite:** abrir de outro navegador mostra os grafites feitos no primeiro.

---



### Fase 5 — Cidades multiplayer · ~1-2 semanas

**Recomendação forte: Colyseus.** Ele resolve exatamente o seu modelo mental — salas com capacidade máxima, lobby listando salas ativas, estado autoritativo sincronizado. Escrever isso do zero com `ws` custa semanas e você vai reimplementar mal o que ele já faz bem.

- Lobby: lista de cidades, cada uma com capacidade (ex.: 16 pessoas)
- `SocketTransport implements Transport` — o resto do código não muda
- Avatares simples (cápsula + nome) com interpolação de posição a ~10 Hz
- Rate limiting anti-spam no servidor
- Reconexão com re-sync do estado

**Aceite:** duas abas conseguem se ver andando e pintar o mesmo muro ao vivo, com latência aceitável.

---



## 15. Armadilhas conhecidas

`intersection.uv` **vem** `undefined`**.** O raycast só devolve UV se a geometria tiver o atributo `uv`. `PlaneGeometry` tem — mas se você trocar por geometria custom ou por um modelo GLTF sem UV mapeado, quebra silenciosamente. Sempre cheque `if (!hit.uv) return;`.

**Textura de cabeça para baixo.** O V do UV cresce para cima; o Y do canvas cresce para baixo. A conversão é `(1 - uv.y) * SIZE`. Esquecer isso faz você pintar no lugar espelhado verticalmente.

**Cores lavadas ou escuras demais.** Toda textura que representa cor precisa de `texture.colorSpace = THREE.SRGBColorSpace`. Sem isso, com `outputColorSpace` em sRGB, a conversão é aplicada duas vezes.

**Traço pontilhado.** Já dito, mas é o bug mais comum: sem interpolação entre o ponto anterior e o atual, mouse rápido vira bolinhas espaçadas.

**Costura entre painéis.** Pintar na borda de um painel deveria pintar também na borda do vizinho — senão aparece uma linha cortada abrupta. Solução: quando `uv.x < margem` ou `uv.x > 1 - margem`, aplique o mesmo dab no painel adjacente com o offset correspondente. Deixe para a Fase 3, mas saiba que existe.

**Pointer lock recusado.** `controls.lock()` só funciona a partir de um gesto real do usuário (clique). Chamar no `load` lança erro no console. Daí o overlay com botão "Entrar na cidade".

`getObject()` **não existe mais.** No Three.js `0.185`, use `controls.object`. Tutoriais de 2022-2023 ainda ensinam `getObject()`.

**Fuga de memória ao recarregar cena.** Se em algum momento você recriar o mundo, chame `geometry.dispose()`, `material.dispose()` e `texture.dispose()` nos antigos. O GC do JS não libera recursos de GPU.

---



## 16. Performance

**Orçamento de memória.** 20 painéis × 1024² × 4 bytes = ~84 MB de VRAM. Confortável. A 2048² viram 336 MB — não faça isso sem carregar sob demanda.

**Custo real: o upload da textura.** `texture.needsUpdate = true` reenvia os 4 MB do canvas para a GPU. Um ou dois painéis por frame é tranquilo. O sistema de `dirty` + `flush` já garante isso — nunca marque `needsUpdate` dentro do loop de dabs.

**Se a performance apertar, na ordem:**

1. Reduzir `TEXTURE.SIZE` para 512 (4× menos upload)
2. Baixar `SPRAY.SPECKLES` — cada partícula é um `fillRect` separado
3. Usar `ctx.getImageData`/`putImageData` só na inicialização, nunca no loop
4. Migrar para `WebGLRenderTarget`: em vez de desenhar no canvas 2D, renderizar quads de brush numa cena ortográfica direto na textura. Elimina o upload CPU→GPU por completo. É a solução definitiva, mas só vale se o canvas 2D realmente não der conta

**Instrumentação:** adicione `stats.js` na Fase 2 e um contador de uploads por frame. Medir antes de otimizar.

---



## 17. Deploy

```bash
npm run build      # gera dist/
npx vercel --prod  # ou netlify deploy --prod --dir=dist
```

Site 100% estático até a Fase 4. GitHub Pages, Vercel e Netlify servem todos no plano gratuito.

**Vercel + GitHub:** conecte o repositório e cada push na `main` vira deploy automático. Configure isso na Fase 0 — ter a URL pública desde o primeiro dia muda como você trabalha, porque dá para mostrar progresso a qualquer momento.

---



## 18. Backlog futuro

**Mundo**

- Prédios simples nas laterais para dar profundidade
- Ciclo dia/noite com postes de luz
- Mais de uma rua, com esquinas
- Muros com relevo (normal map) que afeta como a tinta assenta

**Ferramentas**

- Stencils/carimbos (letras, símbolos)
- Rolo de tinta para preencher áreas grandes
- Escorrido de tinta quando você satura demais um ponto
- Camadas: pintar por cima sem apagar o histórico do que estava embaixo

**Social**

- Timelapse do muro (você já tem o journal — é só replay com delay)
- Galeria dos melhores painéis
- Assinatura/tag pessoal salva no perfil
- Foto do seu grafite exportada com marca d'água e link

**Técnico**

- Migração para `WebGLRenderTarget`
- Carregamento de painéis por proximidade
- Compressão dos strokes (delta encoding nos pontos)

---



## Apêndice — o que fazer primeiro

Se você tem duas horas hoje, faça nesta ordem:

1. `npm create vite`, instalar three, subir o `Engine` com um cubo
2. Conectar na Vercel e ter a URL pública funcionando
3. Criar `config.ts` com as constantes

Isso destrava tudo o mais. E ter a URL pública desde o dia zero é o que transforma o projeto em portfólio em vez de pasta no HD.