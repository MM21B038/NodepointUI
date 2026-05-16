import { readMigratedLocalStorage } from "@/lib/migrateStorageKey";

export type GraphLabelMode = "always" | "onSelect" | "onHover";

export interface GraphSimulationConfig {
  linkDistance: number;
  linkStrength: number;
  chargeStrength: number;
  centerStrength: number;
  xStrength: number;
  yStrength: number;
  collisionRadius: number;
  velocityDecay: number;
  nodeRadius: number;
  showLabels: boolean;
  showEdges: boolean;
  labelMode: GraphLabelMode;
}

export const DEFAULT_GRAPH_SIMULATION_CONFIG: GraphSimulationConfig = {
  linkDistance: 180,
  linkStrength: 1,
  chargeStrength: -300,
  centerStrength: 1,
  xStrength: 0.05,
  yStrength: 0.05,
  collisionRadius: 14,
  velocityDecay: 0.4,
  nodeRadius: 10,
  showLabels: true,
  showEdges: true,
  labelMode: "always",
};

const STORAGE_KEY = "nodepoint_graph_sim_config";
const LEGACY_STORAGE_KEY = "prajna_graph_sim_config";

export function getStoredGraphConfig(): GraphSimulationConfig {
  try {
    const raw = readMigratedLocalStorage(STORAGE_KEY, LEGACY_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_GRAPH_SIMULATION_CONFIG };
    const parsed = JSON.parse(raw) as Partial<GraphSimulationConfig>;
    return { ...DEFAULT_GRAPH_SIMULATION_CONFIG, ...parsed };
  } catch {
    return { ...DEFAULT_GRAPH_SIMULATION_CONFIG };
  }
}

export function setStoredGraphConfig(config: GraphSimulationConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    /* ignore */
  }
}

export function clampConfig(config: GraphSimulationConfig): GraphSimulationConfig {
  return {
    ...config,
    linkDistance: clamp(config.linkDistance, 50, 400),
    linkStrength: clamp(config.linkStrength, 0, 1),
    chargeStrength: clamp(config.chargeStrength, -800, 0),
    centerStrength: clamp(config.centerStrength, 0, 1),
    xStrength: clamp(config.xStrength, 0, 0.5),
    yStrength: clamp(config.yStrength, 0, 0.5),
    collisionRadius: clamp(config.collisionRadius, 0, 40),
    velocityDecay: clamp(config.velocityDecay, 0.1, 0.9),
    nodeRadius: clamp(config.nodeRadius, 4, 20),
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function mergeConfigPatch(
  current: GraphSimulationConfig,
  patch: Partial<GraphSimulationConfig>
): GraphSimulationConfig {
  return clampConfig({ ...current, ...patch });
}
