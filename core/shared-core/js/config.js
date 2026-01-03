const defaultConfig = {
  version: '1.0.0',
  environment: (typeof window !== 'undefined' && window.location && window.location.hostname) || 'local',
  analytics: {
    enabled: true,
    provider: 'native',
  },
};

export function getConfig() {
  return { ...defaultConfig };
}

export function mergeConfig(overrides = {}) {
  return { ...defaultConfig, ...overrides, analytics: { ...defaultConfig.analytics, ...(overrides.analytics || {}) } };
}
