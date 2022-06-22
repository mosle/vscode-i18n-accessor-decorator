interface DotObjectOptions {
  ignoreArrays?: boolean;
}

export const dotObject = (object: Record<string, unknown>, options: DotObjectOptions = {}) => {
  if (!object || typeof object !== "object") {
    throw Error("Not a object");
  }
  const { ignoreArrays } = options;
  const dottedObject: Record<string, unknown> = {};
  Object.keys(object).forEach((key) => {
    const value = object[key];

    if (!value || typeof value !== "object" || (ignoreArrays && Array.isArray(value))) {
      dottedObject[key] = value;
      return;
    }
    const subObject = dotObject(value as Record<string, unknown>);
    Object.keys(subObject).forEach((subKey) => {
      dottedObject[`${key}.${subKey}`] = subObject[subKey];
    });
  });
  return dottedObject;
};
