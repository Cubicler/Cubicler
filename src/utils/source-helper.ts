/**
 * Check if a string is a remote URL using robust regex pattern
 * @param value - The value to check
 * @returns true if the value is a remote URL (http/https)
 */
export function isRemoteUrl(value: string): boolean {
  if (!value || typeof value !== 'string') {
    return false;
  }

  return validateUrlPattern(value.trim());
}

/**
 * Check if a string is a file path using robust regex pattern
 * @param value - The value to check
 * @returns true if the value looks like a file path
 */
export function isFilePath(value: string): boolean {
  if (!value || typeof value !== 'string') {
    return false;
  }

  const trimmedValue = value.trim();

  // Don't treat URLs as file paths
  if (isRemoteUrl(trimmedValue)) {
    return false;
  }

  return matchesFilePathPattern(trimmedValue);
}

/**
 * Check if a string is inline content (not a remote URL or file path)
 * @param value - The value to check
 * @returns true if the value is inline content
 */
export function isInline(value: string): boolean {
  if (!value || typeof value !== 'string') {
    return false;
  }

  // Empty or whitespace-only strings are not valid inline content
  if (value.trim() === '') {
    return false;
  }

  return !isRemoteUrl(value) && !isFilePath(value);
}

/**
 * Detect the source type of a given value
 * @param value - The value to analyze
 * @returns The detected source type: 'remote-url', 'file-path', or 'inline'
 */
export function detectSourceType(value: string): 'remote-url' | 'file-path' | 'inline' {
  if (!value || typeof value !== 'string') {
    return 'inline'; // Treat invalid inputs as inline content
  }

  if (isRemoteUrl(value)) {
    return 'remote-url';
  }

  if (isFilePath(value)) {
    return 'file-path';
  }

  return 'inline';
}

/**
 * Validate URL pattern using regex
 * @param trimmedValue - Trimmed value to validate
 * @returns true if value matches URL pattern
 */
function validateUrlPattern(trimmedValue: string): boolean {
  // Robust regex for HTTP/HTTPS URLs
  // Matches:
  // - http:// or https:// protocol
  // - Domain with at least one dot or localhost
  // - Optional port number
  // - Optional path, query parameters, and fragments
  const urlRegex =
    /^https?:\/\/(?:(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}|localhost)(?::\d+)?(?:\/[^\s]*)?$/i;

  return urlRegex.test(trimmedValue);
}

/**
 * Check if value matches file path patterns
 * @param trimmedValue - Trimmed value to check
 * @returns true if value matches file path patterns
 */
function matchesFilePathPattern(trimmedValue: string): boolean {
  // Robust file path detection patterns
  const filePathPatterns = [
    // Absolute paths (Unix-like: /path/to/file, Windows: C:\path\to\file, D:/path/to/file)
    /^(?:[a-zA-Z]:)?[/\\](?:[^/\\:*?"<>|]+[/\\])*[^/\\:*?"<>|]*$/,

    // Relative paths starting with ./ or ../
    /^\.{1,2}[/\\](?:[^/\\:*?"<>|]+[/\\])*[^/\\:*?"<>|]*$/,

    // Home directory paths starting with ~/
    /^~[/\\](?:[^/\\:*?"<>|]+[/\\])*[^/\\:*?"<>|]*$/,

    // Files with common text extensions anywhere in the path
    /^(?:[^/\\:*?"<>|]+[/\\])*[^/\\:*?"<>|]+\.(txt|md|markdown|text|json|yaml|yml|toml|ini|conf|config|log|readme)$/i,

    // Paths containing directory separators (at least one slash or backslash, with characters on both sides)
    /^[^/\\:*?"<>|]+[/\\]+[^/\\:*?"<>|]+.*$/,
  ];

  return filePathPatterns.some((pattern) => pattern.test(trimmedValue));
}
