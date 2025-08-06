# 🔧 Provider Integration Overview

> *Your complete guide to connecting services and APIs to Cubicler*

This guide shows you how to make your services available to AI agents through Cubicler. Whether you have existing REST APIs or want to build new MCP-compatible services, this document will help you understand the options and get started quickly.

---

## 🎯 What is a Cubicler Provider?

A **Cubicler Provider** is any external service that AI agents can use through Cubicler to accomplish tasks. Think of providers as the "tools" that make AI agents truly useful.

### Types of Providers

**MCP Servers** (Recommended):

- ✅ **Native MCP protocol** - standardized AI tool integration
- ✅ **Auto-discovery** - tools automatically available to agents  
- ✅ **Rich metadata** - detailed schemas and descriptions
- ✅ **Future-proof** - built for AI integration

**REST APIs** (Legacy Support):

- ✅ **Use existing APIs** - no need to rewrite your services
- ✅ **Simple configuration** - define endpoints in JSON
- ✅ **Quick integration** - get started immediately
- ✅ **Wide compatibility** - works with any HTTP API

### What Providers Enable

- 🌤️ **Weather services** - current conditions, forecasts
- 👤 **User management** - authentication, profiles, permissions  
- 📧 **Communication** - email, SMS, notifications
- 💾 **Data access** - databases, files, external systems
- 🔧 **Business logic** - calculations, validations, workflows
- 💰 **Payments** - transactions, billing, subscriptions

---

## 🏗️ How Provider Integration Works

```text
┌─────────────────┐   1. Register in        ┌──────────────────┐
│   AI Agent      │   providers.json        │ Your Provider    │
│                 │                         │ (MCP or REST)    │
└─────────────────┘                         └──────────────────┘
        ▲                                            │
        │ 5. Tool Results                            │ 3. Route Requests
        │                                            ▼
        │                                  ┌──────────────────┐
        │                                  │   Cubicler       │
        │ 4. Tool Calls                    │ (Orchestrator)   │
        │                                  └──────────────────┘
        │                                            │
        │                                            │ 2. Discover Tools
        │                                            ▼
        │                                  ┌──────────────────┐
        └─────────────────────────────────  │ Your Services    │
                                           │ (APIs/Databases) │
                                           └──────────────────┘
```

### Integration Flow

1. **Register your provider** in `providers.json` configuration
2. **Cubicler discovers** your tools and services automatically (MCP) or via config (REST)
3. **AI agents call tools** by name through Cubicler's routing system
4. **Cubicler routes requests** to your provider using the appropriate transport
5. **Your provider processes** the request and returns results to the agent

---

## 🚀 Choose Your Provider Type

### MCP Servers (Recommended Path)

**Perfect for:** New services, AI-first integrations, rich tool metadata

**Transports Available:**

- **HTTP MCP** - Web-based MCP servers (most common)
- **SSE MCP** - Streaming MCP for real-time operations  
- **Stdio MCP** - Command-line MCP tools and scripts

### REST APIs (Existing Services)

**Perfect for:** Existing APIs, quick integration, legacy systems

**How it works:** Define your REST endpoints in `providers.json` and Cubicler automatically converts them to AI-callable tools.

---

## 📋 Configuration Overview

### MCP Servers

Register your MCP server in `providers.json` with identifier, transport type (http/sse/stdio), and URL.

### REST APIs

Define your existing REST endpoints with paths, methods, and parameters in `providers.json`.

---

## 🔧 Key Concepts

### MCP vs REST

- **MCP**: AI-native protocol with auto-discovery and rich schemas
- **REST**: Traditional HTTP APIs with manual configuration

### Function Naming

AI agents call your tools using hash-prefixed names (e.g., `a1b2c3_get_weather`)

### Transport Options

- **HTTP**: Web-based (most common)
- **SSE**: Streaming for real-time data  
- **Stdio**: Command-line/local tools

---

## 🎯 Getting Started

1. **Choose your approach**: MCP for new services, REST for existing APIs
2. **Configure in providers.json**: Add your service details
3. **Test integration**: AI agents can immediately discover and use your tools

---

## 📚 Next Steps

**👉 Ready to implement?** Choose your integration path:

### MCP Providers (Recommended)

**For detailed implementation examples:**

- Check the configuration examples above for quick setup
- See the MCP specification for full protocol details
- Use the configuration templates provided in this guide

### REST API Integration

**For REST API integration:**

- Use the configuration examples shown above
- Follow the parameter handling guide in this document
- Reference the authentication patterns provided

**🤖 Building agents too?** Check out [Agent Integration Overview](AGENT_INTEGRATION.md)

---

Made with ❤️ for service providers building with Cubicler.
