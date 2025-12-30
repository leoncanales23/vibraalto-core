const PRESET_JSON_URL = './assets/presets.json';

class PresetCatalog {
  constructor(jsonUrl = PRESET_JSON_URL) {
    this.jsonUrl = jsonUrl;
    this.cache = null;
  }

  async load() {
    if (this.cache) return this.cache;
    const response = await fetch(this.jsonUrl, { cache: 'no-cache' });
    if (!response.ok) {
      throw new Error(`No se pudo cargar el catálogo de presets (${response.status})`);
    }
    const data = await response.json();
    this.cache = Array.isArray(data.presets) ? data.presets : [];
    return this.cache;
  }

  async list() {
    const presets = await this.load();
    return [...presets];
  }

  async describe(id) {
    const presets = await this.load();
    const preset = presets.find((item) => item.id === id);
    if (!preset) {
      throw new Error(`Preset no encontrado: ${id}`);
    }
    return preset;
  }

  async asMap() {
    const presets = await this.load();
    return presets.reduce((map, preset) => {
      map[preset.id] = preset;
      return map;
    }, {});
  }
}

class KeyframeRecorder {
  constructor(storageKey = 'vibraalto:keyframes') {
    this.storageKey = storageKey;
    this.keyframes = this.loadFromStorage();
  }

  loadFromStorage() {
    if (typeof localStorage === 'undefined') return [];
    const stored = localStorage.getItem(this.storageKey);
    if (!stored) return [];
    try {
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.warn('No se pudieron leer keyframes almacenados', err);
      return [];
    }
  }

  persist() {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(this.storageKey, JSON.stringify(this.keyframes));
  }

  generateId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `kf-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  generateSeed() {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const buffer = new Uint32Array(1);
      crypto.getRandomValues(buffer);
      return buffer[0].toString(36);
    }
    return Math.floor(Math.random() * 1e9).toString(36);
  }

  capture({ presetId, seed, params = {}, presetSnapshot = null, label = null }) {
    const keyframe = {
      id: this.generateId(),
      presetId,
      seed: seed ?? this.generateSeed(),
      params,
      presetSnapshot,
      label,
      createdAt: new Date().toISOString(),
    };
    this.keyframes.push(keyframe);
    this.persist();
    return keyframe;
  }

  list() {
    return [...this.keyframes];
  }

  clear() {
    this.keyframes = [];
    this.persist();
  }

  export() {
    return JSON.stringify(this.keyframes, null, 2);
  }
}

const presetCatalog = new PresetCatalog(PRESET_JSON_URL);
const keyframeRecorder = new KeyframeRecorder();

async function capturePresetKeyframe({ presetId, seed, params = {}, label }) {
  const preset = await presetCatalog.describe(presetId);
  const presetSnapshot = {
    sdf: preset.sdf,
    forces: preset.forces,
    palette: preset.palette,
  };
  return keyframeRecorder.capture({ presetId, seed, params, presetSnapshot, label });
}

window.vibraGenerative = {
  catalog: presetCatalog,
  keyframes: keyframeRecorder,
  capturePresetKeyframe,
};

export {
  PresetCatalog,
  KeyframeRecorder,
  presetCatalog,
  keyframeRecorder,
  capturePresetKeyframe,
};
