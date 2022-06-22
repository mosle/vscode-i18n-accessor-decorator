import * as vscode from "vscode";

import Ajv from "ajv";

import { schema, TargetFuncNames } from "./targetFuncNamesSchema";

const ajv = new Ajv();
const funcNamesValidate = ajv.compile(schema);

const sectionKey = "sgI18n";

const booleanKeys = ["showDecorator"] as const;
const stringKeys = ["forceTargetFuncName", "jsonDictionaries", "baseJsonFile"] as const;
const dynamicKeys: { parsedTargetFuncNames: DynamicKey<"forceTargetFuncName"> } = {
  parsedTargetFuncNames: {
    bind: "forceTargetFuncName",
    parser: (bindedValue): { success?: TargetFuncNames; error?: string } => {
      const returnObject: { success?: TargetFuncNames; error?: string } = {};
      try {
        const json = bindedValue;
        const parsed = JSON.parse(json);
        if (funcNamesValidate(parsed)) {
          returnObject.success = parsed;
        } else {
          returnObject.error = funcNamesValidate.errors?.[0].message;
        }
      } catch (e: any) {
        returnObject.error = e.toString();
      }
      return returnObject;
    },
  },
};
const defaultValues: ConfigRecord = {
  showDecorator: false,
  forceTargetFuncName: "{t:0}",
  jsonDictionaries: "locales/*.json",
  baseJsonFile: "ja.json",
  parsedTargetFuncNames: { t: 0 },
};

type DynamicKey<T extends typeof booleanKeys[number] | typeof stringKeys[number]> = { bind: T; parser: (value: ConfigValue<T>) => { success?: unknown; error?: string } };

type ConfigKey = typeof booleanKeys[number] | typeof stringKeys[number] | keyof typeof dynamicKeys;
type ConfigValue<T> = T extends typeof booleanKeys[number] ? boolean : T extends typeof stringKeys[number] ? string : T extends keyof typeof dynamicKeys ? ReturnType<typeof dynamicKeys[T]["parser"]>["success"] : never;

type ConfigRecord = { [T in ConfigKey]: ConfigValue<T> };

let configValues: ConfigRecord = { ...defaultValues };

function loadConfigs(): ConfigRecord {
  const r: { [key: string]: any } = Object.fromEntries([...booleanKeys, ...stringKeys].map((key) => [key, loadConfigWithDefault(key, defaultValues[key])]));

  Object.keys(dynamicKeys).forEach((key) => {
    const chunk = dynamicKeys[key as keyof typeof dynamicKeys];
    const bindedValue = r[chunk.bind];
    const result = chunk.parser(bindedValue as string);
    if (!result.error && result.success) r[key] = result.success;
    else if (result.error) throw result.error;
  });

  return r as ConfigRecord; //not safe
}
export function reloadConfig() {
  try {
    configValues = loadConfigs();
  } catch (e) {
    throw e;
  }
}

export function getConfig<T extends ConfigKey>(key: T): ConfigValue<T> {
  return configValues[key];
}

export function loadConfigWithDefault<T extends ConfigKey, S extends ConfigValue<T>>(key: T, defaultValue: S) {
  return vscode.workspace.getConfiguration(sectionKey).get<S>(key, defaultValue);
}
export function loadConfig<T extends ConfigKey, S extends ConfigValue<T>>(key: T) {
  return vscode.workspace.getConfiguration(sectionKey).get<S>(key);
}

export async function updateConfig<T extends ConfigKey, S extends ConfigValue<T>>(key: T, value: S, target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Workspace) {
  configValues = { ...configValues, ...{ [key]: value } };
  return vscode.workspace.getConfiguration(sectionKey).update(key, value, target);
}

export function configPath(key: ConfigKey) {
  return `${sectionKey}.${key}`;
}

// export function allKeys() {
//   return [...booleanKeys, ...stringKeys];
// }
