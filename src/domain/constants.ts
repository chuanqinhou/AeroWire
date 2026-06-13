import type { PinBatchDirection, PinKind, Project, Voltage, WireArrowDirection, WireEndStyle, WireLineStyle } from "./types";

export const STORAGE_KEY = "aerowire.project.v1";
export const PROJECT_BUNDLE_TYPE = "aerowire-project-bundle";

export const powerKinds: PinKind[] = ["VCC", "VBAT"];
export const signalKinds: PinKind[] = ["UART_TX", "UART_RX", "PWM", "I2C_SCL", "I2C_SDA", "SIGNAL"];

export const initialProject: Project = {
  boards: [],
  pins: [],
  wires: [],
  networkTypes: [],
};

export const pinKinds: PinKind[] = ["VCC", "GND", "UART_TX", "UART_RX", "PWM", "I2C_SCL", "I2C_SDA", "VBAT", "SIGNAL"];
export const voltages: Voltage[] = ["N/A", "3.3V", "5V", "9V", "12V", "VBAT"];
export const wireLineStyles: WireLineStyle[] = ["solid", "dashed", "dotted"];
export const wireEndStyles: WireEndStyle[] = ["none", "dot", "arrow"];
export const wireArrowDirections: WireArrowDirection[] = ["forward", "reverse"];

export const wireColorByKind: Record<PinKind, string> = {
  VCC: "#e33d2e",
  VBAT: "#d1221f",
  GND: "#1f2933",
  UART_TX: "#f4b000",
  UART_RX: "#2e9f62",
  PWM: "#2477d4",
  I2C_SCL: "#7857d8",
  I2C_SDA: "#14a6a0",
  SIGNAL: "#6a7280",
};

export const pinColorByKind: Record<PinKind, string> = {
  VCC: "#e33d2e",
  VBAT: "#d1221f",
  GND: "#1f2933",
  UART_TX: "#f4b000",
  UART_RX: "#2e9f62",
  PWM: "#2477d4",
  I2C_SCL: "#7857d8",
  I2C_SDA: "#14a6a0",
  SIGNAL: "#6a7280",
};

export const BOARD_GRID_COLUMNS = 2;
export const BOARD_GRID_GAP_X = 520;
export const BOARD_GRID_GAP_Y = 360;
export const BOARD_GRID_START_X = 72;
export const BOARD_GRID_START_Y = 72;
export const DEFAULT_CANVAS_GRID_SIZE = 48;
export const WIRE_HIT_TOLERANCE = 12;
export const DEFAULT_PIN_SIZE = 7;
export const DEFAULT_PIN_LABEL_FONT_SIZE = 12;
export const DEFAULT_PIN_LABEL_FONT_FAMILY = `"Aptos", "Noto Sans SC", "Microsoft YaHei", sans-serif`;
export const EXPORT_PADDING = 96;
export const EXPORT_MAX_IMAGE_SIDE = 10000;
export const EXPORT_TARGET_PIXEL_RATIO = 2;
export const HISTORY_LIMIT = 80;

export const PIN_BATCH_DIRECTIONS: Array<{ value: PinBatchDirection; label: string }> = [
  { value: "right", label: "向右" },
  { value: "down", label: "向下" },
  { value: "left", label: "向左" },
  { value: "up", label: "向上" },
];

export const PIN_LABEL_FONTS = [
  { value: DEFAULT_PIN_LABEL_FONT_FAMILY, label: "默认无衬线" },
  { value: `"Microsoft YaHei", "Noto Sans SC", sans-serif`, label: "微软雅黑" },
  { value: `"SimSun", "Songti SC", serif`, label: "宋体" },
  { value: `"KaiTi", "Kaiti SC", serif`, label: "楷体" },
  { value: `"Consolas", "SFMono-Regular", monospace`, label: "等宽" },
];
