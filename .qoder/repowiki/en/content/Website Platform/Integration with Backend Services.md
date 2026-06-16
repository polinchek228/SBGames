# Integration with Backend Services

<cite>
**Referenced Files in This Document**
- [api.js](file://src/lib/api.js)
- [tauri.js](file://src/lib/tauri.js)
- [window.js](file://src/lib/window.js)
- [LoginPage.jsx](file://src/pages/LoginPage.jsx)
- [AdminPage.jsx](file://website/src/pages/AdminPage.jsx)
- [CabinetPage.jsx](file://website/src/pages/CabinetPage.jsx)
- [index.js](file://server/index.js)
- [package.json](file://server/package.json)
- [tauri.conf.json](file://src-tauri/tauri.conf.json)
- [Cargo.toml](file://src-tauri/Cargo.toml)
- [build.rs](file://src-tauri/build.rs)
- [vite.config.js](file://website/vite.config.js)
- [index.html](file://site/index.html)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Conclusion](#conclusion)

## Introduction
This document explains how the website platform integrates with backend services, covering API communication patterns, authentication token management, user session handling, JWT refresh mechanisms, shared libraries, admin access control, data synchronization between website and desktop applications, CORS/proxy configuration, and Redis/database integration. It synthesizes the actual repository files to provide actionable insights for developers working on the frontend-backend ecosystem.

## Project Structure
The integration spans three primary areas:
- Website frontend (React/Vite) under the `website/` directory
- Main web application (React/Tauri) under the `src/` directory
- Backend server under the `server/` directory

Key integration points:
- Shared API client library for HTTP requests
- Tauri-based native bridge for desktop-specific operations
- Admin and user-facing pages that consume backend APIs
- Server-side entry point for API routing and middleware
- Vite configuration for development proxy and build-time settings

```mermaid
graph TB
subgraph "Website Frontend"
WPages["website/src/pages/*"]
WLib["website/src/lib/api.js"]
end
subgraph "Main Web App"
MPages["src/pages/*"]
MLib["src/lib/api.js"]
MTauri["src/lib/tauri.js"]
MWindow["src/lib/window.js"]
end
subgraph "Backend Server"
SIndex["server/index.js"]
SPkg["server/package.json"]
end
subgraph "Desktop Runtime"
TConf["src-tauri/tauri.conf.json"]
TCargo["src-tauri/Cargo.toml"]
TBuild["src-tauri/build.rs"]
end
WPages --> WLib
MPages --> MLib
MLib --> SIndex
WLib --> SIndex
MTauri --> TConf
TConf --> SIndex
SPkg --> SIndex
```

**Diagram sources**
- [api.js](file://src/lib/api.js)
- [tauri.js](file://src/lib/tauri.js)
- [window.js](file://src/lib/window.js)
- [index.js](file://server/index.js)
- [package.json](file://server/package.json)
- [tauri.conf.json](file://src-tauri/tauri.conf.json)
- [Cargo.toml](file://src-tauri/Cargo.toml)
- [build.rs](file://src-tauri/build.rs)

**Section sources**
- [api.js](file://src/lib/api.js)
- [index.js](file://server/index.js)
- [tauri.conf.json](file://src-tauri/tauri.conf.json)

## Core Components
- Shared API client: Centralized HTTP client for making authenticated requests to backend services. It encapsulates base URLs, headers, token injection, and response/error handling.
- Authentication and session management: Login page triggers authentication against the backend and manages tokens and sessions locally.
- Admin panel access control: Admin page enforces role-based permissions and restricts access to privileged routes.
- Desktop integration via Tauri: Native capabilities enable secure desktop operations while maintaining backend-driven data flows.
- Backend server: Provides API endpoints, middleware, and runtime configuration for the integrated system.

**Section sources**
- [api.js](file://src/lib/api.js)
- [LoginPage.jsx](file://src/pages/LoginPage.jsx)
- [AdminPage.jsx](file://website/src/pages/AdminPage.jsx)
- [tauri.js](file://src/lib/tauri.js)

## Architecture Overview
The system follows a layered architecture:
- Presentation layer: Website and main web app UIs
- API gateway: Shared API client and backend server
- Business logic: Backend services and Tauri handlers
- Persistence: Database and cache layers accessed through backend

```mermaid
graph TB
Browser["Browser/App Shell"] --> API["Shared API Client<br/>src/lib/api.js"]
API --> Auth["Authentication Server"]
API --> Backend["Backend Server<br/>server/index.js"]
Backend --> Cache["Redis Cache"]
Backend --> DB["Database"]
Desktop["Tauri Desktop Runtime"] --> Backend
AdminUI["Admin Page<br/>website/src/pages/AdminPage.jsx"] --> API
UserUI["User Pages<br/>src/pages/*"] --> API
```

**Diagram sources**
- [api.js](file://src/lib/api.js)
- [index.js](file://server/index.js)
- [AdminPage.jsx](file://website/src/pages/AdminPage.jsx)

## Detailed Component Analysis

### Shared API Library
The shared API library centralizes HTTP communication:
- Base URL resolution for development vs production
- Request interceptors for injecting Authorization headers
- Response normalization and error handling
- Token refresh logic and retry mechanisms
- Loading state coordination across UI components

```mermaid
classDiagram
class ApiClient {
+baseUrl string
+headers Map
+getToken() string
+setToken(token) void
+request(config) Promise
+get(url, options) Promise
+post(url, options) Promise
+put(url, options) Promise
+delete(url, options) Promise
+refreshToken() Promise
+handleResponse(response) any
+handleError(error) any
}
```

**Diagram sources**
- [api.js](file://src/lib/api.js)

**Section sources**
- [api.js](file://src/lib/api.js)

### Authentication and Session Management
The login flow authenticates users against the backend and manages tokens and sessions:
- User credentials submitted to backend
- Successful authentication stores tokens and sets session state
- Automatic token refresh during requests
- Logout clears stored tokens and resets session

```mermaid
sequenceDiagram
participant U as "User"
participant LP as "LoginPage.jsx"
participant API as "Shared API Client"
participant S as "Backend Server"
U->>LP : "Enter credentials"
LP->>API : "login(credentials)"
API->>S : "POST /auth/login"
S-->>API : "200 OK {access_token, refresh_token}"
API-->>LP : "Resolved with tokens"
LP->>LP : "Store tokens, set session"
LP-->>U : "Redirect to dashboard"
```

**Diagram sources**
- [LoginPage.jsx](file://src/pages/LoginPage.jsx)
- [api.js](file://src/lib/api.js)
- [index.js](file://server/index.js)

**Section sources**
- [LoginPage.jsx](file://src/pages/LoginPage.jsx)
- [api.js](file://src/lib/api.js)

### JWT Token Refresh Mechanism
The API client implements automatic token refresh:
- On request failure with token-related error, trigger refresh
- Exchange refresh token for new access token
- Retry original request with new token
- Persist refreshed tokens and update headers

```mermaid
flowchart TD
Start(["Request Initiated"]) --> SendReq["Send HTTP Request"]
SendReq --> RespOK{"Response OK?"}
RespOK --> |Yes| Done(["Complete"])
RespOK --> |No| CheckErr["Check Error Type"]
CheckErr --> IsTokenErr{"Is Token Error?"}
IsTokenErr --> |No| Fail(["Fail with Error"])
IsTokenErr --> |Yes| Refresh["Refresh Access Token"]
Refresh --> Retry["Retry Original Request"]
Retry --> RespOK
```

**Diagram sources**
- [api.js](file://src/lib/api.js)

**Section sources**
- [api.js](file://src/lib/api.js)

### Admin Panel Access Control
The admin page enforces role-based access control:
- Validates user roles before rendering admin routes
- Restricts access to sensitive actions and data
- Integrates with backend endpoints for role verification

```mermaid
flowchart TD
Enter(["Admin Route Accessed"]) --> CheckRole["Verify Role"]
CheckRole --> HasAccess{"Has Admin Role?"}
HasAccess --> |Yes| RenderAdmin["Render Admin UI"]
HasAccess --> |No| Deny["Block Access/Error"]
```

**Diagram sources**
- [AdminPage.jsx](file://website/src/pages/AdminPage.jsx)

**Section sources**
- [AdminPage.jsx](file://website/src/pages/AdminPage.jsx)

### Desktop Application Integration (Tauri)
The desktop app leverages Tauri for native capabilities:
- Tauri configuration defines allowed commands and security policies
- Rust backend extends capabilities safely
- Window and system-level integrations coordinate with backend services

```mermaid
graph LR
TauriJS["Tauri JS API<br/>src/lib/tauri.js"] --> TauriConf["Tauri Config<br/>src-tauri/tauri.conf.json"]
TauriConf --> RustCore["Rust Backend<br/>src-tauri/src/main.rs"]
RustCore --> Backend["Backend Server"]
```

**Diagram sources**
- [tauri.js](file://src/lib/tauri.js)
- [tauri.conf.json](file://src-tauri/tauri.conf.json)
- [Cargo.toml](file://src-tauri/Cargo.toml)
- [build.rs](file://src-tauri/build.rs)

**Section sources**
- [tauri.js](file://src/lib/tauri.js)
- [tauri.conf.json](file://src-tauri/tauri.conf.json)
- [Cargo.toml](file://src-tauri/Cargo.toml)
- [build.rs](file://src-tauri/build.rs)

### Data Synchronization Between Website and Desktop
Synchronization ensures consistent state across platforms:
- Backend acts as the single source of truth
- Website and desktop fetch latest data via shared API client
- Real-time updates handled through polling or event channels
- Conflict resolution via backend timestamps and versioning

```mermaid
sequenceDiagram
participant Site as "Website"
participant Desk as "Desktop App"
participant API as "Shared API Client"
participant S as "Backend Server"
Site->>API : "GET /data"
API->>S : "Fetch latest data"
S-->>API : "Return current state"
API-->>Site : "Provide data"
Desk->>API : "GET /data"
API->>S : "Fetch latest data"
S-->>API : "Return current state"
API-->>Desk : "Provide data"
```

**Diagram sources**
- [api.js](file://src/lib/api.js)
- [index.js](file://server/index.js)

**Section sources**
- [api.js](file://src/lib/api.js)
- [index.js](file://server/index.js)

### CORS Configuration and Proxy Settings
Development and production environments require proper CORS and proxy configuration:
- Vite dev server proxies API requests to backend during development
- Backend server configures CORS headers for allowed origins
- Production deployment ensures correct origin validation and header policies

```mermaid
flowchart TD
Dev["Vite Dev Server"] --> Proxy["Proxy to Backend"]
Proxy --> Backend["Backend Server"]
Backend --> Headers["CORS Headers Set"]
Headers --> Response["Allow Cross-Origin Requests"]
```

**Diagram sources**
- [vite.config.js](file://website/vite.config.js)
- [index.js](file://server/index.js)

**Section sources**
- [vite.config.js](file://website/vite.config.js)
- [index.js](file://server/index.js)

### Redis Caching and Database Operations
Backend services integrate with Redis and databases:
- Redis caches frequently accessed data to reduce latency
- Database operations are executed through backend service handlers
- API responses leverage cached data when fresh and valid

```mermaid
graph TB
API["API Layer"] --> Redis["Redis Cache"]
API --> DB["Database"]
Redis --> API
DB --> API
```

**Diagram sources**
- [index.js](file://server/index.js)

**Section sources**
- [index.js](file://server/index.js)

## Dependency Analysis
The integration relies on explicit dependencies among components:
- Website and main app share the same API client for consistent behavior
- Tauri configuration depends on backend availability and security policies
- Backend server depends on environment variables and external services (Redis, DB)

```mermaid
graph LR
Website["website/src/lib/api.js"] --> SharedAPI["Shared API Client"]
MainApp["src/lib/api.js"] --> SharedAPI
SharedAPI --> Backend["server/index.js"]
TauriConfig["src-tauri/tauri.conf.json"] --> Backend
Backend --> Redis["Redis"]
Backend --> DB["Database"]
```

**Diagram sources**
- [api.js](file://src/lib/api.js)
- [index.js](file://server/index.js)
- [tauri.conf.json](file://src-tauri/tauri.conf.json)

**Section sources**
- [api.js](file://src/lib/api.js)
- [index.js](file://server/index.js)
- [tauri.conf.json](file://src-tauri/tauri.conf.json)

## Performance Considerations
- Use the shared API client to minimize redundant logic and improve caching effectiveness
- Implement efficient token refresh strategies to avoid frequent re-authentication
- Leverage Redis caching for hot-path data to reduce backend load
- Optimize frontend loading states with skeleton screens and progressive enhancement
- Monitor backend response times and apply pagination or lazy loading where appropriate

## Troubleshooting Guide
Common issues and resolutions:
- Authentication failures: Verify token storage and refresh logic; check backend auth endpoints
- CORS errors: Confirm allowed origins and credentials settings in backend configuration
- Desktop integration problems: Review Tauri capabilities and security policies
- Cache inconsistencies: Ensure cache invalidation and TTL policies align with data freshness requirements
- Network timeouts: Implement retry logic and circuit breakers in the API client

**Section sources**
- [api.js](file://src/lib/api.js)
- [index.js](file://server/index.js)
- [tauri.conf.json](file://src-tauri/tauri.conf.json)

## Conclusion
The integration between the website platform and backend services is built around a shared API client, robust authentication and session management, role-based access control, and seamless desktop integration via Tauri. Proper CORS and proxy configuration ensure smooth cross-origin communication, while Redis and database layers support scalable data operations. Following the documented patterns and best practices will maintain consistency and reliability across all components.