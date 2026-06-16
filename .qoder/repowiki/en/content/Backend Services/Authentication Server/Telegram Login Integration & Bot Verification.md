# Telegram Login Integration & Bot Verification

<cite>
**Referenced Files in This Document**
- [server_index.js](file://server_index.js)
- [index.js](file://server/index.js)
- [LoginPage.jsx](file://website/src/pages/LoginPage.jsx)
- [LoginPage.jsx](file://src/pages/LoginPage.jsx)
- [SBGBootstrap.java](file://src-java/com/sbgames/bootstrap/SBGBootstrap.java)
- [remote_server_index.js](file://scratch/remote_server_index.js)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Security Implementation](#security-implementation)
9. [Troubleshooting Guide](#troubleshooting-guide)
10. [Conclusion](#conclusion)

## Introduction
This document provides comprehensive technical documentation for the Telegram login integration and bot verification system. It covers the Telegram widget authentication flow, bot verification mechanisms, desktop authentication flow, and integration with the Java bootstrap loader. The system implements secure authentication using Telegram's official authentication protocol, including hash verification via HMAC-SHA256, timestamp validation, and user data extraction.

The authentication system supports two primary flows:
- Web-based authentication through Telegram widgets
- Desktop authentication via QR code generation and bot verification

## Project Structure
The Telegram authentication system spans multiple components across the frontend, backend, and desktop application layers.

```mermaid
graph TB
subgraph "Frontend Applications"
WEB[Website Frontend<br/>React SPA]
TAURI[Tauri Desktop App<br/>React SPA]
end
subgraph "Server Layer"
AUTH_API[Authentication API<br/>/auth/* endpoints]
BOT_API[Bot Management<br/>Telegram Bot API]
REDIS[Redis Storage<br/>User Accounts]
end
subgraph "Desktop Integration"
BOOTSTRAP[Java Bootstrap Loader<br/>SBGBootstrap.java]
DESKTOP_CLIENT[Desktop Client<br/>Authentication Flow]
end
WEB --> AUTH_API
TAURI --> AUTH_API
AUTH_API --> REDIS
AUTH_API --> BOT_API
DESKTOP_CLIENT --> AUTH_API
DESKTOP_CLIENT --> BOT_API
BOOTSTRAP --> DESKTOP_CLIENT
```

**Diagram sources**
- [server_index.js](file://server_index.js)
- [index.js](file://server/index.js)
- [LoginPage.jsx](file://website/src/pages/LoginPage.jsx)
- [LoginPage.jsx](file://src/pages/LoginPage.jsx)
- [SBGBootstrap.java](file://src-java/com/sbgames/bootstrap/SBGBootstrap.java)

**Section sources**
- [server_index.js](file://server_index.js)
- [index.js](file://server/index.js)

## Core Components

### Telegram Authentication Flow
The system implements Telegram's official authentication protocol with robust security measures:

#### Hash Verification (HMAC-SHA256)
The authentication process validates Telegram's signature using HMAC-SHA256 with the bot's token as the key. The verification ensures data integrity and prevents tampering.

#### Timestamp Validation
All authentication requests include a timestamp that is validated against the current server time to prevent replay attacks. The system enforces strict time window limits.

#### User Data Extraction
The system extracts essential user information including ID, username, first name, last name, and authentication date from Telegram's payload.

### Authentication Endpoints
The system exposes several key endpoints for different authentication scenarios:

- `/auth/widget-login`: Web-based authentication via Telegram widgets
- `/auth/tg-login`: Complete authentication flow including nickname registration
- `/auth/create-code`: Desktop authentication code generation
- `/auth/check-code`: Desktop authentication code verification

### Bot Integration
The system integrates with a dedicated Telegram bot for desktop authentication flows, enabling users to authorize their desktop clients through bot commands.

**Section sources**
- [server_index.js](file://server_index.js)
- [remote_server_index.js](file://scratch/remote_server_index.js)

## Architecture Overview

```mermaid
sequenceDiagram
participant User as User Browser/Desktop
participant Website as Website Frontend
participant Server as Authentication Server
participant Bot as Telegram Bot
participant Redis as Redis Storage
Note over User,Bot : Web Authentication Flow
User->>Website : Click Telegram Login
Website->>Telegram : Load Widget Script
Telegram-->>Website : User Data + Signature
Website->>Server : POST /auth/widget-login
Server->>Server : Verify Telegram Hash (HMAC-SHA256)
Server->>Server : Validate Timestamp
Server->>Redis : Check Existing Account
Redis-->>Server : Account Status
Server-->>Website : {needNick} or {user, token}
Note over User,Bot : Desktop Authentication Flow
User->>Website : Generate Login Code
Website->>Server : POST /auth/create-code
Server->>Bot : Send Authorization Request
Bot-->>User : Telegram Message with Auth Link
User->>Bot : Click /start with Auth Code
Bot->>Server : Confirm Authorization
Server-->>Bot : Confirmation Response
Bot-->>User : Success Message
Website->>Server : GET /auth/check-code
Server-->>Website : {confirmed, tgUser}
Website->>Server : POST /auth/tg-login
Server->>Redis : Create/Update Account
Server-->>Website : {user, token}
```

**Diagram sources**
- [server_index.js](file://server_index.js)
- [index.js](file://server/index.js)
- [LoginPage.jsx](file://website/src/pages/LoginPage.jsx)
- [LoginPage.jsx](file://src/pages/LoginPage.jsx)

## Detailed Component Analysis

### Telegram Widget Authentication Flow

The web-based authentication flow utilizes Telegram's official widget system for seamless user experience.

#### Frontend Implementation
The frontend component dynamically loads the Telegram widget script and handles the authentication callback:

```mermaid
flowchart TD
Start([User Clicks Login]) --> LoadWidget["Load Telegram Widget Script"]
LoadWidget --> InitCallback["Initialize onTelegramAuth Callback"]
InitCallback --> WaitAuth["Wait for User Authorization"]
WaitAuth --> ReceiveData["Receive Telegram Auth Data"]
ReceiveData --> ValidateData["Validate Required Fields"]
ValidateData --> HasNick{"Need Nickname?"}
HasNick --> |Yes| ShowNickForm["Display Nickname Form"]
HasNick --> |No| CompleteLogin["Complete Login Process"]
ShowNickForm --> SubmitNick["Submit Username"]
SubmitNick --> CompleteLogin
CompleteLogin --> StoreToken["Store JWT Token"]
StoreToken --> RedirectHome["Redirect to Home"]
```

**Diagram sources**
- [LoginPage.jsx](file://website/src/pages/LoginPage.jsx)

#### Backend Authentication Processing
The server-side authentication validates the Telegram payload and manages user accounts:

```mermaid
sequenceDiagram
participant Client as Web Client
participant AuthAPI as /auth/widget-login
participant Crypto as HMAC-SHA256
participant Validator as Timestamp Validator
participant Storage as Redis Storage
Client->>AuthAPI : POST with Telegram Data
AuthAPI->>Crypto : Verify Hash Signature
Crypto-->>AuthAPI : Verification Result
AuthAPI->>Validator : Validate Timestamp
Validator-->>AuthAPI : Timestamp Validity
AuthAPI->>Storage : Check Existing Account
Storage-->>AuthAPI : Account Information
AuthAPI-->>Client : Response (needNick/user/token)
```

**Diagram sources**
- [server_index.js](file://server_index.js)
- [remote_server_index.js](file://scratch/remote_server_index.js)

**Section sources**
- [LoginPage.jsx](file://website/src/pages/LoginPage.jsx)
- [server_index.js](file://server_index.js)
- [remote_server_index.js](file://scratch/remote_server_index.js)

### Desktop Authentication Flow

The desktop authentication system provides a QR code-based approach for users who prefer desktop client authentication.

#### Code Generation Endpoint
The `/auth/create-code` endpoint generates unique authentication codes with expiration handling:

```mermaid
flowchart TD
GenerateRequest[POST /auth/create-code] --> ValidateRateLimit["Check Rate Limit"]
ValidateRateLimit --> RateLimitOK{"Within Limits?"}
RateLimitOK --> |No| Return429["Return 429 Too Many Requests"]
RateLimitOK --> |Yes| GenerateCode["Generate Unique Code"]
GenerateCode --> StoreEntry["Store in authCodes Map"]
StoreEntry --> SetExpiry["Set 5-Minute Expiration"]
SetExpiry --> ReturnCode["Return {code}"]
```

**Diagram sources**
- [index.js](file://server/index.js)

#### Polling Mechanism
The desktop client polls the `/auth/check-code` endpoint to monitor authentication status:

```mermaid
sequenceDiagram
participant Desktop as Desktop Client
participant AuthAPI as /auth/check-code
participant Bot as Telegram Bot
participant Server as Authentication Server
Desktop->>AuthAPI : GET /auth/check-code?code=XXXXXX
AuthAPI-->>Desktop : {pending} (429 if too soon)
Desktop->>AuthAPI : Retry After Delay
AuthAPI->>Server : Check authCodes[code]
Server-->>AuthAPI : {confirmed : false}
AuthAPI-->>Desktop : {pending}
Note over Bot,Server : User Authorizes via Bot
Bot->>Server : Confirm Authorization
Server->>Server : Mark as Confirmed
Server-->>Bot : Success Response
Desktop->>AuthAPI : GET /auth/check-code?code=XXXXXX
AuthAPI->>Server : Check authCodes[code]
Server-->>AuthAPI : {confirmed : true, tgUser}
AuthAPI-->>Desktop : {confirmed, tgUser}
```

**Diagram sources**
- [index.js](file://server/index.js)
- [server_index.js](file://server_index.js)

**Section sources**
- [index.js](file://server/index.js)
- [LoginPage.jsx](file://src/pages/LoginPage.jsx)

### Java Bootstrap Loader Integration

The desktop authentication seamlessly integrates with the Java bootstrap loader for native application startup:

```mermaid
classDiagram
class SBGBootstrap {
+String authToken
+String userId
+Date expiryTime
+initialize() void
+validateToken() boolean
+launchGame() void
-fetchAuthToken() String
-storeCredentials() void
}
class TelegramAuthFlow {
+generateAuthCode() String
+pollAuthStatus(code) AuthResult
+completeAuthentication() User
}
class RedisStorage {
+getUser(userId) User
+saveUser(user) void
+updateUserRole(userId, role) void
}
SBGBootstrap --> TelegramAuthFlow : "uses"
TelegramAuthFlow --> RedisStorage : "stores/retrieves"
```

**Diagram sources**
- [SBGBootstrap.java](file://src-java/com/sbgames/bootstrap/SBGBootstrap.java)
- [server_index.js](file://server_index.js)

**Section sources**
- [SBGBootstrap.java](file://src-java/com/sbgames/bootstrap/SBGBootstrap.java)
- [server_index.js](file://server_index.js)

## Dependency Analysis

The authentication system has well-defined dependencies between components:

```mermaid
graph TB
subgraph "External Dependencies"
TELEGRAM[Telegram Widget API]
BOT_API[Telegram Bot API]
REDIS[Redis Database]
end
subgraph "Internal Components"
WIDGET_AUTH[Widget Authentication]
DESKTOP_AUTH[Desktop Authentication]
ACCOUNT_MGMT[Account Management]
HASH_VERIFY[Hash Verification]
TIMESTAMP_VAL[Timestamp Validation]
end
TELEGRAM --> WIDGET_AUTH
BOT_API --> DESKTOP_AUTH
REDIS --> ACCOUNT_MGMT
WIDGET_AUTH --> HASH_VERIFY
WIDGET_AUTH --> TIMESTAMP_VAL
DESKTOP_AUTH --> HASH_VERIFY
DESKTOP_AUTH --> TIMESTAMP_VAL
HASH_VERIFY --> ACCOUNT_MGMT
TIMESTAMP_VAL --> ACCOUNT_MGMT
```

**Diagram sources**
- [server_index.js](file://server_index.js)
- [index.js](file://server/index.js)

**Section sources**
- [server_index.js](file://server_index.js)
- [index.js](file://server/index.js)

## Performance Considerations

### Rate Limiting Implementation
The system implements comprehensive rate limiting to prevent abuse:

- `/auth/tg-login`: 5 requests per 15 minutes per IP address
- `/auth/create-code`: 3 requests per minute per user
- `/auth/check-code`: 429 status for rapid polling attempts

### Caching Strategy
Redis caching optimizes user lookup performance and reduces database load during authentication flows.

### Memory Management
Authentication codes are stored in memory with automatic cleanup after expiration to prevent memory leaks.

## Security Implementation

### Input Validation and Sanitization
The system implements strict input validation for all authentication endpoints:

- Telegram user data validation using HMAC-SHA256 signatures
- Username sanitization (3-16 characters, alphanumeric and underscore only)
- IP address tracking for suspicious activity detection
- Automatic failure recording for invalid requests

### Replay Attack Protection
Multiple layers protect against replay attacks:

- Timestamp validation with strict time window limits
- One-time use authentication codes
- Bot command verification with expiration handling
- Session token generation with expiration

### CSRF Protection
While Telegram's authentication flow inherently provides strong anti-CSRF protection through their widget system, the server also implements:

- Origin validation for authentication requests
- Token-based session management
- Rate limiting to prevent automated attacks

### Error Handling and Logging
Comprehensive error handling ensures security without leaking sensitive information:

- Generic error messages for failed authentications
- Detailed logging for suspicious activities
- Automatic IP blocking for repeated failures
- Graceful degradation for service interruptions

**Section sources**
- [server_index.js](file://server_index.js)
- [index.js](file://server/index.js)

## Troubleshooting Guide

### Common Authentication Issues

#### Telegram Widget Not Loading
- Verify Telegram widget script loads successfully
- Check browser console for widget initialization errors
- Ensure proper CSP headers allow Telegram widget loading

#### Authentication Signature Failures
- Verify bot token configuration is correct
- Check timestamp synchronization between client and server
- Validate HMAC-SHA256 implementation matches Telegram's specification

#### Desktop Authentication Problems
- Confirm bot is properly configured and online
- Verify authentication code expiration (5-minute limit)
- Check network connectivity for bot communication

#### Rate Limit Exceeded
- Implement exponential backoff for retry attempts
- Display user-friendly error messages
- Provide guidance for rate limit reset timing

### Debugging Authentication Flows

#### Web Authentication Debugging
1. Enable browser developer tools to monitor `/auth/widget-login` requests
2. Verify Telegram data payload structure and signature
3. Check server logs for authentication validation results

#### Desktop Authentication Debugging
1. Monitor `/auth/create-code` endpoint responses
2. Verify bot message delivery and user interaction
3. Track authentication code lifecycle and expiration

**Section sources**
- [server_index.js](file://server_index.js)
- [index.js](file://server/index.js)

## Conclusion

The Telegram login integration and bot verification system provides a comprehensive, secure, and user-friendly authentication solution. The implementation leverages Telegram's official authentication protocol with robust security measures including HMAC-SHA256 hash verification, timestamp validation, and comprehensive input sanitization.

Key strengths of the implementation include:

- **Multi-platform support**: Seamless authentication across web and desktop platforms
- **Security-first design**: Multiple layers of protection against common attack vectors
- **User experience focus**: Streamlined authentication flows with clear error messaging
- **Scalable architecture**: Redis-backed storage and efficient rate limiting
- **Integration flexibility**: Support for both widget-based and bot-based authentication flows

The system successfully balances security requirements with user accessibility, providing a reliable foundation for user authentication across the SBGames ecosystem. The integration with the Java bootstrap loader ensures seamless desktop client authentication while maintaining the same security standards applied to web authentication.