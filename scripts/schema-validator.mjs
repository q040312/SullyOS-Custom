export function validateSchema(value, schema, location = '$') {
  const errors = [];
  const fail = (message) => errors.push(`${location}: ${message}`);
  if (schema.allOf) {
    for (const child of schema.allOf) errors.push(...validateSchema(value, child, location));
  }
  if (schema.oneOf) {
    const matches = schema.oneOf.filter((child) => validateSchema(value, child, location).length === 0);
    if (matches.length !== 1) fail('must match exactly one allowed schema');
  }
  if (schema.not && validateSchema(value, schema.not, location).length === 0) fail('must not match a forbidden schema');
  if (schema.if) {
    const branch = validateSchema(value, schema.if, location).length === 0 ? schema.then : schema.else;
    if (branch) errors.push(...validateSchema(value, branch, location));
  }
  if ('const' in schema && value !== schema.const) fail(`must equal ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.includes(value)) fail('must be one of the allowed values');
  if (schema.type === 'object' || schema.required || schema.properties || schema.additionalProperties !== undefined) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      if (schema.type === 'object') return [`${location}: must be an object`];
      return errors;
    }
    for (const key of schema.required ?? []) if (!(key in value)) errors.push(`${location}.${key}: is required`);
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) if (!(key in (schema.properties ?? {}))) errors.push(`${location}.${key}: is not allowed`);
    }
    for (const [key, child] of Object.entries(schema.properties ?? {})) {
      if (key in value) errors.push(...validateSchema(value[key], child, `${location}.${key}`));
    }
  } else if (schema.type === 'array') {
    if (!Array.isArray(value)) return [`${location}: must be an array`];
    if (schema.minItems !== undefined && value.length < schema.minItems) fail(`must contain at least ${schema.minItems} item(s)`);
    value.forEach((item, index) => errors.push(...validateSchema(item, schema.items ?? {}, `${location}[${index}]`)));
  } else if (schema.type === 'string') {
    if (typeof value !== 'string') return [`${location}: must be a string`];
    if (schema.minLength !== undefined && value.length < schema.minLength) fail(`must have length >= ${schema.minLength}`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) fail('does not match required pattern');
  } else if (schema.type === 'boolean' && typeof value !== 'boolean') fail('must be a boolean');
  return errors;
}
