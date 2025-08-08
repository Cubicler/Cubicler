## Unified Response/Payload Transform Schema

REST provider `response_transform` and webhook `payload_transform` now share a single canonical schema and are fully interchangeable.

### Canonical Shape

Each transform entry must contain a `path` and a `transform` field.

Supported transform types:

- map (requires `map` object)
- date_format (requires `format` string)
- template (requires `template` string, use `{value}` placeholder)
- regex_replace (requires `pattern` and `replacement`)
- remove (no extras)

Example:

```json
[
  { "path": "user.status", "transform": "map", "map": { "0": "Inactive", "1": "Active" } },
  { "path": "user.last_login", "transform": "date_format", "format": "YYYY-MM-DD HH:mm:ss" },
  { "path": "profile.bio", "transform": "template", "template": "Bio: {value}" },
  { "path": "profile.description", "transform": "regex_replace", "pattern": "\\s+", "replacement": " " },
  { "path": "debug_info", "transform": "remove" }
]
```

### Array Syntax

Use `field[].subfield` to apply a transform to each item of an array. Use `_root[]` to address a root-level array.

### Validation

Configuration loading fails fast if:

- `transform` is missing or not one of the supported types.
- Required type-specific fields (`map`, `format`, `template`, `pattern`/`replacement`) are missing.
- `map` object is empty.

### Use in Providers vs Webhooks

Field name differs only by context:

- REST endpoints: `response_transform`
- Webhooks: `payload_transform`

The array entries themselves are identical.

---

If you find a transform use case not covered here, open an issue or PR to extend the schema.
