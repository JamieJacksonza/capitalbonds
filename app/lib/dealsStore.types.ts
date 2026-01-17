export type MoveMeta = { by?: string; note?: string };
export type MoveLogEntry = {
  id: string;
  dealId: string;
  fromStage: any;
  toStage: any;
  movedAt: string;
  movedBy: string;
  note?: string;
};
