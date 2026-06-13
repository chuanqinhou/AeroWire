export type PinKind =
  | "VCC"
  | "GND"
  | "UART_TX"
  | "UART_RX"
  | "PWM"
  | "I2C_SCL"
  | "I2C_SDA"
  | "VBAT"
  | "SIGNAL";

export type Voltage = "3.3V" | "5V" | "9V" | "12V" | "VBAT" | "N/A";
export type ToolMode = "select" | "pin" | "wire";
export type Severity = "error" | "warning" | "ok";
export type IssueTarget = { kind: "wire" | "pin" | "board"; id: string };
export type BoardCrop = { left: number; right: number; top: number; bottom: number };
export type WireLineStyle = "solid" | "dashed" | "dotted";
export type WireEndStyle = "none" | "dot" | "arrow";
export type WireArrowDirection = "forward" | "reverse";
export type PinBatchDirection = "right" | "down" | "left" | "up";

export type WireBend = {
  id: string;
  x: number;
  y: number;
};

export type NetworkType = {
  id: string;
  name: string;
  baseKind: PinKind;
  defaultVoltage: string;
};

export type Pin = {
  id: string;
  boardId: string;
  x: number;
  y: number;
  groupId: string | null;
  size: number;
  label: string;
  labelColor: string;
  labelFontSize: number;
  labelFontFamily: string;
  typeLabel: string;
  networkTypeId: string | null;
  labelOffsetX: number;
  labelOffsetY: number;
  kind: PinKind;
  voltage: string;
  maxCurrentMa: number;
};

export type Board = {
  id: string;
  name: string;
  imageSrc: string;
  x: number;
  y: number;
  originalWidth: number;
  originalHeight: number;
  scale: number;
  rotation: number;
  crop: BoardCrop;
  locked: boolean;
};

export type Wire = {
  id: string;
  fromPinId: string;
  toPinId: string;
  color: string;
  width: number;
  label: string;
  labelFontSize: number;
  labelOffsetX: number;
  labelOffsetY: number;
  bends: WireBend[];
  routeX: number | null;
  routeY: number | null;
  lineStyle: WireLineStyle;
  endStyle: WireEndStyle;
  arrowDirection: WireArrowDirection;
  status: Severity;
  message: string;
};

export type Project = {
  boards: Board[];
  pins: Pin[];
  wires: Wire[];
  networkTypes: NetworkType[];
};

export type ProjectFile = Project & {
  schemaVersion?: number;
  assetMode?: "local";
};

export type ProjectBundle = {
  schemaVersion: number;
  bundleType: "aerowire-project-bundle";
  project: ProjectFile;
  assets: Record<string, string>;
};

export type ProjectIssue = {
  id: string;
  severity: Exclude<Severity, "ok">;
  text: string;
  target: IssueTarget;
};
