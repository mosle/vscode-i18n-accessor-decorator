import { JSONSchemaType } from "ajv";
export type TargetFuncNames = { [key: string]: number };

export const schema: JSONSchemaType<TargetFuncNames> = {
  type: "object",
  patternProperties: {
    "^.+$": { type: "number", minimum: 0 },
  },
  required: [],
};
