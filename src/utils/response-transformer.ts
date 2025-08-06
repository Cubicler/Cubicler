import type { ResponseTransform } from '../model/providers.js';

/**
 * Transform response data based on response_transform configuration
 */
export function transformResponse(
  data: any, // eslint-disable-line @typescript-eslint/no-explicit-any -- Handles arbitrary JSON structures
  transforms: ResponseTransform[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Returns transformed JSON structures
): any {
  if (!transforms || transforms.length === 0) {
    return data;
  }

  let transformedData = JSON.parse(JSON.stringify(data)); // Deep clone

  for (const transform of transforms) {
    transformedData = applyTransform(transformedData, transform);
  }

  return transformedData;
}

/**
 * Apply a single transformation to the data
 */
function applyTransform(
  data: any, // eslint-disable-line @typescript-eslint/no-explicit-any -- Handles arbitrary JSON structures
  transform: ResponseTransform
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Returns transformed JSON structures
): any {
  const pathSegments = parsePath(transform.path);

  if (transform.transform === 'remove') {
    return removeAtPath(data, pathSegments);
  }

  return transformAtPath(data, pathSegments, transform);
}

/**
 * Parse path string into segments with array indicators
 */
function parsePath(path: string): PathSegment[] {
  const segments: PathSegment[] = [];

  // Handle _root[] case
  if (path.startsWith('_root[]')) {
    segments.push({ type: 'array', key: '_root' });
    const remaining = path.slice(7); // Remove '_root[]'
    if (remaining.startsWith('.')) {
      segments.push(...parsePath(remaining.slice(1)));
    }
    return segments;
  }

  const parts = path.split('.');

  for (const part of parts) {
    if (part.endsWith('[]')) {
      // Array property: "property[]"
      const key = part.slice(0, -2);
      segments.push({ type: 'object', key });
      segments.push({ type: 'array', key }); // Use same key for array access
    } else {
      // Regular property
      segments.push({ type: 'object', key: part });
    }
  }

  return segments;
}

/**
 * Transform value at specified path
 */
function transformAtPath(
  data: any, // eslint-disable-line @typescript-eslint/no-explicit-any -- Handles arbitrary JSON structures
  pathSegments: PathSegment[],
  transform: ResponseTransform
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Returns transformed JSON structures
): any {
  if (pathSegments.length === 0) {
    return applyValueTransform(data, transform);
  }

  const [currentSegment, ...remainingSegments] = pathSegments;

  if (!currentSegment) {
    return data;
  }

  if (currentSegment.type === 'array') {
    if (currentSegment.key === '_root') {
      // Transform root array
      if (Array.isArray(data)) {
        return data.map((item) => transformAtPath(item, remainingSegments, transform));
      }
      return data;
    } else {
      // Transform each item in current array (data should already be the array)
      if (Array.isArray(data)) {
        return data.map(
          (
            item: any // eslint-disable-line @typescript-eslint/no-explicit-any -- Array items can be any type
          ) => transformAtPath(item, remainingSegments, transform)
        );
      }
      return data;
    }
  } else {
    // Object property
    if (data && typeof data === 'object' && currentSegment.key in data) {
      return {
        ...data,
        [currentSegment.key]: transformAtPath(
          data[currentSegment.key],
          remainingSegments,
          transform
        ),
      };
    }
    return data;
  }
}

/**
 * Remove property at specified path
 */
function removeAtPath(
  data: any, // eslint-disable-line @typescript-eslint/no-explicit-any -- Handles arbitrary JSON structures
  pathSegments: PathSegment[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Returns modified JSON structures
): any {
  if (pathSegments.length === 0) {
    return undefined;
  }

  const [currentSegment, ...remainingSegments] = pathSegments;

  if (!currentSegment) {
    return data;
  }

  if (currentSegment.type === 'array') {
    if (currentSegment.key === '_root') {
      // Remove from root array
      if (Array.isArray(data)) {
        return data
          .map((item) => removeAtPath(item, remainingSegments))
          .filter((item) => item !== undefined);
      }
      return data;
    } else {
      // Remove from each item in current array (data should already be the array)
      if (Array.isArray(data)) {
        return data
          .map((item: any) => removeAtPath(item, remainingSegments)) // eslint-disable-line @typescript-eslint/no-explicit-any -- Array items can be any type
          .filter((item: any) => item !== undefined); // eslint-disable-line @typescript-eslint/no-explicit-any -- Filtered items can be any type
      }
      return data;
    }
  } else {
    // Object property
    if (remainingSegments.length === 0) {
      // Remove this property
      if (data && typeof data === 'object' && currentSegment.key in data) {
        const { [currentSegment.key]: _removed, ...rest } = data;
        return rest;
      }
      return data;
    } else {
      // Continue down the path
      if (data && typeof data === 'object' && currentSegment.key in data) {
        const transformed = removeAtPath(data[currentSegment.key], remainingSegments);
        if (transformed === undefined) {
          const { [currentSegment.key]: _removed, ...rest } = data;
          return rest;
        }
        return {
          ...data,
          [currentSegment.key]: transformed,
        };
      }
      return data;
    }
  }
}

/**
 * Apply value transformation based on transform type
 */
function applyValueTransform(
  value: any, // eslint-disable-line @typescript-eslint/no-explicit-any -- Values can be any type
  transform: ResponseTransform
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Returns transformed values
): any {
  switch (transform.transform) {
    case 'map':
      if (transform.map && String(value) in transform.map) {
        return transform.map[String(value)];
      }
      return value;

    case 'date_format':
      if (transform.format) {
        try {
          const date = new Date(value);
          if (!isNaN(date.getTime())) {
            return formatDate(date, transform.format);
          }
        } catch {
          // Invalid date, return original value
        }
      }
      return value;

    case 'template':
      if (transform.template) {
        return transform.template.replace(/{value}/g, String(value));
      }
      return value;

    case 'regex_replace':
      if (transform.pattern && transform.replacement !== undefined) {
        try {
          const regex = new RegExp(transform.pattern, 'g');
          return String(value).replace(regex, transform.replacement);
        } catch {
          // Invalid regex, return original value
        }
      }
      return value;

    default:
      return value;
  }
}

/**
 * Format date according to format string
 * Supports basic YYYY-MM-DD HH:mm:ss format
 */
function formatDate(date: Date, format: string): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');

  return format
    .replace('YYYY', String(year))
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
}

/**
 * Path segment type
 */
interface PathSegment {
  type: 'object' | 'array';
  key: string;
}
