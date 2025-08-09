# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.6.0] - 2025-08-09

### 🎯 Major Features

#### Framework Architecture

- **Major framework restructure** with improved modularity and maintainability
- **Keyed configuration model** migration for agents, providers, and webhooks  
- **Unified response transforms** with canonical schema alignment
- Enhanced **dependency injection** interfaces for better architecture
- Comprehensive **transport architecture refactoring** for multi-transport support

#### Agent & Transport Management

- **Stdio agent pooling** with persistent transport and round-robin selection
- **Agent transport caching** with config-hash invalidation and automatic cleanup
- **Multi-transport agent communication layer** supporting HTTP, SSE, and stdio
- **Agent transport factory** for abstraction and extensibility
- **Enhanced dispatch model** with improved error handling and validation

#### MCP (Model Context Protocol) Enhancements

- **Auto-restart capabilities** with backoff, process guards, and resilience
- **Auto SSE→HTTP fallback** transport for URL-based servers
- **Process management improvements** with better error handling and cleanup
- **Enhanced MCP service** with improved reliability and performance

### ✨ New Features

#### Authentication & Security

- **Comprehensive JWT authentication** support with middleware
- **JWT helper utilities** with unified naming and configuration
- **Webhook JWT authentication** integration
- **Enhanced security middleware** for request validation

#### Server-Sent Events (SSE)

- **SSE agent transport** implementation with full service support
- **SSE endpoint unification** for improved consistency
- **Comprehensive SSE test coverage** with unit and integration tests

#### Configuration & Validation

- **Agent/server/tool restriction support** with comprehensive controls
- **Enhanced configuration validation** for new transport types
- **Improved type system** for multi-transport agent support
- **Rich message capabilities** with enhanced agent prompts

#### Utilities & Error Handling

- **Enhanced error handling utilities** with improved validation
- **Response transformation utilities** with type safety improvements  
- **Comprehensive health service** implementation
- **Enhanced type safety** across utility functions

### 🔧 Improvements

#### CI/CD & Publishing

- **Automated npm publishing** workflow with version validation
- **Consolidated release pipeline** with Docker Hub integration
- **Version matching validation** between package.json and git tags
- **Multi-platform Docker builds** (linux/amd64, linux/arm64)
- **Enhanced GitHub Actions** workflows with comprehensive testing

#### Testing & Quality

- **Comprehensive test coverage** for all core services and utilities
- **Migration to keyed config schema** across all test suites
- **Enhanced middleware and utilities** test coverage
- **Message type compatibility tests** for transport layers
- **JSON-RPC 2.0 protocol** compliance for stdio agent transport

#### Performance & Reliability

- **Reduced test overhead** through targeted imports and optimization
- **Enhanced error pathways** with fallback error responses
- **Process lifecycle management** for better resource utilization
- **Connection pooling** and queue management for stdio agents
- **Single in-flight dispatch** enforcement with timeout handling

#### Documentation

- **Comprehensive integration guides** refresh and updates
- **Enhanced repository guidelines** with coding standards
- **Updated example configurations** for all new schemas
- **Webhook integration documentation** with comprehensive guides
- **Framework documentation** overhaul with detailed explanations

### 🔄 Refactoring

#### Core Services

- **Services refactoring** for keyed configs and unified transforms
- **Dispatch service updates** for transport architecture integration
- **Core services enhancement** for improved architecture patterns
- **Server entry point improvements** with better module detection

#### Configuration Schema

- **Agents/providers/webhooks migration** to keyed object model
- **Transport configuration unification** with consistent structure
- **JWT configuration migration** from YAML to JSON format
- **Type alignment** and canonical response transform schema

#### Codebase Organization

- **Import optimization** to reduce aggregator side effects
- **Type-only imports** for better performance and clarity
- **Unified naming conventions** across JWT utilities and middleware
- **Enhanced modularity** with better separation of concerns

### 🐛 Bug Fixes

- **JWT middleware test** import path corrections
- **Stdio agent transport** JSON-RPC 2.0 protocol compliance
- **Test configuration** fixes for new schema compatibility
- **Type safety improvements** in response transformer tests

### 📦 Dependencies

#### Added

- `pino` ^9.8.0 - Enhanced logging capabilities
- `@cubicler/cubicagent-openai` ^2.6.4 - Updated agent integration

#### Updated

- Various dev dependencies for better tooling and development experience
- Docker configurations with updated base images and tags
- Build configurations targeting Node 20

### 🔄 Configuration Changes

#### Build & Development

- **Vitest configuration** with single-thread option and path aliases
- **Tsup configuration** targeting Node 20 with optimized externals
- **Docker configurations** updated with 2.6.0 image tags
- **ESLint configuration** updates for improved code quality

### ⚠️ Breaking Changes

- **Configuration schema migration** to keyed object model (migration required)
- **Transport interface updates** for enhanced multi-transport capabilities  
- **Service method signatures** changes for improved type safety
- **JWT configuration format** change from YAML to JSON

### 📚 Migration Guide

For users upgrading from v2.3.0 or earlier:

1. **Update configuration files** to use the new keyed object model (see examples)
2. **Review transport configurations** for new pooling and caching options
3. **Update custom integrations** to match new interface signatures
4. **Migrate JWT configurations** from YAML to JSON format
5. **Test webhook JWT authentication** if using webhook features
6. **Review agent restrictions** and update configurations as needed

---

**Full Changelog**: <https://github.com/Cubicler/Cubicler/compare/v2.3.0...v2.6.0>

## [2.3.0] - Previous Release

Previous release baseline for comparison.

---

*For older versions, please refer to the git history or GitHub releases page.*
