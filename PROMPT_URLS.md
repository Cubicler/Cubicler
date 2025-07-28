# 📋 Prompt URL Support

Cubicler 2.0 supports loading prompts from both URLs and local files, with graceful fallback to treating the content as inline text if loading fails.

## ✅ Supported Prompt Sources

### Remote URLs
```json
{
  "basePrompt": "https://raw.githubusercontent.com/your-org/prompts/main/base-prompt.md",
  "agents": [{
    "prompt": "https://example.com/prompts/agent-specialist.md"
  }]
}
```

### Local Files
```json
{
  "defaultPrompt": "./prompts/default-agent.md",
  "agents": [{
    "prompt": "../shared-prompts/claude-specialist.txt"
  }]
}
```

### Inline Content (Fallback)
```json
{
  "agents": [{
    "prompt": "You are a helpful AI assistant. Please visit https://example.com for more info."
  }]
}
```

## 🔄 Auto-Detection & Fallback

The system automatically detects whether a prompt value is:
1. **URL** - starts with `http://` or `https://`
2. **File Path** - contains `/`, `\`, starts with `./`, `../`, `~/`, or ends with `.md`, `.txt`, `.markdown`, `.text`
3. **Inline Content** - everything else

### Graceful Fallback
If loading from a URL or file fails, the system gracefully falls back to treating the value as inline content:

```json
{
  "agents": [{
    "prompt": "./non-existent-file.md but this is actually a long prompt with instructions"
  }]
}
```

In this case, if `./non-existent-file.md` doesn't exist, the entire string becomes the prompt content.

## 📝 Prompt Composition

Prompts are composed in this order:
1. **Base Prompt** (if configured) - shared across all agents
2. **Agent-Specific Prompt** (if configured) OR **Default Prompt** (fallback)

Example composition:
```
[Base Prompt from URL]

[Agent-Specific Prompt from local file]
```

## 🛠️ Implementation Details

- **Caching**: Loaded prompts are cached to avoid repeated network/file requests
- **Error Handling**: Network errors, file not found, and invalid URLs are handled gracefully
- **Content Types**: Supports plain text, markdown, and other text formats
- **Timeouts**: Configurable timeout for remote URL fetching (via `CUBICLER_CONFIG_LOAD_TIMEOUT`)

## 📄 File Extensions

The following file extensions are automatically detected as file paths:
- `.md` - Markdown files
- `.txt` - Plain text files  
- `.markdown` - Markdown files
- `.text` - Text files

## 🔧 Configuration Example

```json
{
  "basePrompt": "https://raw.githubusercontent.com/company/ai-prompts/main/base.md",
  "defaultPrompt": "./prompts/default.md",
  "agents": [
    {
      "identifier": "gpt-4o",
      "name": "GPT-4o Assistant", 
      "url": "http://localhost:3000/agent"
      // Uses basePrompt + defaultPrompt (no agent-specific prompt)
    },
    {
      "identifier": "claude-specialist",
      "name": "Claude Specialist",
      "url": "http://localhost:3001/agent",
      "prompt": "https://company.com/prompts/claude-specialist.md"
      // Uses basePrompt + agent-specific prompt
    },
    {
      "identifier": "inline-agent",
      "name": "Inline Agent", 
      "url": "http://localhost:3002/agent",
      "prompt": "You are a domain expert. For help, visit https://docs.company.com"
      // Uses basePrompt + inline prompt (contains URL but treated as content)
    }
  ]
}
```
