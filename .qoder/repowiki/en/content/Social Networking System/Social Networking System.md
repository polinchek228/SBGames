# Social Networking System

<cite>
**Referenced Files in This Document**
- [App.jsx](file://src/App.jsx)
- [main.jsx](file://src/main.jsx)
- [CommunityPage.jsx](file://src/pages/CommunityPage.jsx)
- [LeaderboardPage.jsx](file://src/pages/LeaderboardPage.jsx)
- [ProfilePage.jsx](file://src/pages/ProfilePage.jsx)
- [AchievementSystem.jsx](file://src/components/AchievementSystem.jsx)
- [AchievementShowcase.jsx](file://src/components/AchievementShowcase.jsx)
- [RecentActivityCard.jsx](file://src/components/RecentActivityCard.jsx)
- [NotificationSystem.jsx](file://src/components/NotificationSystem.jsx)
- [ProfileComments.jsx](file://src/components/ProfileComments.jsx)
- [api.js](file://src/lib/api.js)
- [tauri.js](file://src/lib/tauri.js)
- [window.js](file://src/lib/window.js)
- [index.js](file://server/index.js)
- [package.json](file://server/package.json)
- [tauri.conf.json](file://src-tauri/tauri.conf.json)
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
This document describes the social networking system built with React and Tauri. It covers friend management, messaging, group functionality, activity tracking, user profiles with avatars and privacy controls, achievement systems, leaderboards, and integration with authentication and data validation. The system supports both web and desktop deployment via Tauri, with modular frontend components and backend services.

## Project Structure
The application follows a React-based frontend with Tauri for native capabilities and a Node.js server for backend services. Key areas:
- Frontend: React components under src/components and pages under src/pages
- Libraries: API client and Tauri integration under src/lib
- Backend: Node.js server under server/
- Desktop shell: Tauri configuration under src-tauri/

```mermaid
graph TB
subgraph "Frontend (React)"
App["App.jsx"]
Pages["Pages<br/>CommunityPage.jsx<br/>LeaderboardPage.jsx<br/>ProfilePage.jsx"]
Components["Components<br/>AchievementSystem.jsx<br/>AchievementShowcase.jsx<br/>RecentActivityCard.jsx<br/>NotificationSystem.jsx<br/>ProfileComments.jsx"]
Lib["Libraries<br/>api.js<br/>tauri.js<br/>window.js"]
end
subgraph "Backend (Node.js)"
ServerIndex["server/index.js"]
end
subgraph "Desktop Shell (Tauri)"
TauriConf["src-tauri/tauri.conf.json"]
end
App --> Pages
App --> Components
App --> Lib
Lib --> ServerIndex
Lib --> TauriConf
```

**Diagram sources**
- [App.jsx](file://src/App.jsx)
- [CommunityPage.jsx](file://src/pages/CommunityPage.jsx)
- [LeaderboardPage.jsx](file://src/pages/LeaderboardPage.jsx)
- [ProfilePage.jsx](file://src/pages/ProfilePage.jsx)
- [AchievementSystem.jsx](file://src/components/AchievementSystem.jsx)
- [AchievementShowcase.jsx](file://src/components/AchievementShowcase.jsx)
- [RecentActivityCard.jsx](file://src/components/RecentActivityCard.jsx)
- [NotificationSystem.jsx](file://src/components/NotificationSystem.jsx)
- [ProfileComments.jsx](file://src/components/ProfileComments.jsx)
- [api.js](file://src/lib/api.js)
- [tauri.js](file://src/lib/tauri.js)
- [window.js](file://src/lib/window.js)
- [index.js](file://server/index.js)
- [tauri.conf.json](file://src-tauri/tauri.conf.json)

**Section sources**
- [App.jsx](file://src/App.jsx)
- [main.jsx](file://src/main.jsx)
- [api.js](file://src/lib/api.js)
- [tauri.js](file://src/lib/tauri.js)
- [index.js](file://server/index.js)
- [tauri.conf.json](file://src-tauri/tauri.conf.json)

## Core Components
- Authentication and session management are integrated via Tauri APIs and the frontend routing. The login page and main layout coordinate user state and protected routes.
- Community and leaderboard pages provide social discovery and ranking features.
- Profile page centralizes user information, avatar management, comments, and privacy controls.
- Achievement system tracks milestones and showcases progress.
- Activity feed displays recent actions and social interactions.
- Notification system handles real-time updates and alerts.

**Section sources**
- [CommunityPage.jsx](file://src/pages/CommunityPage.jsx)
- [LeaderboardPage.jsx](file://src/pages/LeaderboardPage.jsx)
- [ProfilePage.jsx](file://src/pages/ProfilePage.jsx)
- [AchievementSystem.jsx](file://src/components/AchievementSystem.jsx)
- [AchievementShowcase.jsx](file://src/components/AchievementShowcase.jsx)
- [RecentActivityCard.jsx](file://src/components/RecentActivityCard.jsx)
- [NotificationSystem.jsx](file://src/components/NotificationSystem.jsx)
- [ProfileComments.jsx](file://src/components/ProfileComments.jsx)

## Architecture Overview
The system uses a layered architecture:
- Presentation layer: React components and pages
- Service layer: API client wrappers and Tauri integrations
- Domain layer: Social features (friends, groups, messaging, activities)
- Persistence layer: Backend server and local storage via Tauri

```mermaid
graph TB
UI["React UI<br/>Pages & Components"] --> API["API Client<br/>api.js"]
API --> Auth["Authentication<br/>Tauri + Session"]
UI --> Notif["Notifications<br/>NotificationSystem.jsx"]
UI --> Achieve["Achievements<br/>AchievementSystem.jsx"]
UI --> Activity["Activity Feed<br/>RecentActivityCard.jsx"]
UI --> Profile["Profile<br/>ProfilePage.jsx"]
API --> Server["Server<br/>server/index.js"]
Server --> DB["Data Store<br/>Local + Remote"]
UI --> Tauri["Tauri Shell<br/>tauri.conf.json"]
```

**Diagram sources**
- [App.jsx](file://src/App.jsx)
- [api.js](file://src/lib/api.js)
- [tauri.js](file://src/lib/tauri.js)
- [NotificationSystem.jsx](file://src/components/NotificationSystem.jsx)
- [AchievementSystem.jsx](file://src/components/AchievementSystem.jsx)
- [RecentActivityCard.jsx](file://src/components/RecentActivityCard.jsx)
- [ProfilePage.jsx](file://src/pages/ProfilePage.jsx)
- [index.js](file://server/index.js)
- [tauri.conf.json](file://src-tauri/tauri.conf.json)

## Detailed Component Analysis

### Friend Management System
Friend management includes friend requests, accept/reject workflows, and relationship status. The system coordinates:
- Request creation and sending
- Notification delivery for incoming requests
- Relationship persistence and updates
- Privacy-aware visibility of friend lists

```mermaid
sequenceDiagram
participant U1 as "User A"
participant UI as "UI Layer"
participant API as "API Client"
participant S as "Server"
participant U2 as "User B"
U1->>UI : "Open Friend Requests"
UI->>API : "GET /friends/requests"
API->>S : "Fetch requests"
S-->>API : "Requests list"
API-->>UI : "Render requests"
U1->>UI : "Send Friend Request"
UI->>API : "POST /friends/request"
API->>S : "Create request"
S-->>API : "Success"
API-->>UI : "Refresh requests"
S->>U2 : "Notify new request"
U2->>UI : "Accept/Reject"
UI->>API : "POST /friends/respond"
API->>S : "Update relationship"
S-->>API : "Success"
API-->>UI : "Update friend list"
```

**Diagram sources**
- [api.js](file://src/lib/api.js)
- [index.js](file://server/index.js)

**Section sources**
- [api.js](file://src/lib/api.js)
- [index.js](file://server/index.js)

### Messaging System
Direct messaging and group chat support:
- Real-time notifications for new messages
- Message history retrieval
- Group chat rooms with member lists
- Typing indicators and read receipts

```mermaid
sequenceDiagram
participant Sender as "Sender"
participant UI as "Messaging UI"
participant API as "API Client"
participant S as "Server"
participant Receiver as "Receiver"
Sender->>UI : "Compose message"
UI->>API : "POST /messages/send"
API->>S : "Persist message"
S-->>API : "Stored"
API-->>UI : "Acknowledge"
S->>Receiver : "Push notification"
Receiver->>UI : "Open chat"
UI->>API : "GET /messages/history"
API->>S : "Fetch messages"
S-->>API : "Messages"
API-->>UI : "Render chat"
```

**Diagram sources**
- [api.js](file://src/lib/api.js)
- [index.js](file://server/index.js)
- [NotificationSystem.jsx](file://src/components/NotificationSystem.jsx)

**Section sources**
- [api.js](file://src/lib/api.js)
- [index.js](file://server/index.js)
- [NotificationSystem.jsx](file://src/components/NotificationSystem.jsx)

### Group Functionality
Group creation, membership management, and chat rooms:
- Create/join groups with permissions
- Member roles and moderation controls
- Group-specific chat with real-time updates

```mermaid
flowchart TD
Start(["Open Groups"]) --> Create["Create Group"]
Create --> Invite["Invite Members"]
Invite --> Chat["Group Chat"]
Chat --> Notify["Real-time Notifications"]
Chat --> Moderation["Moderation Tools"]
Moderation --> Manage["Manage Roles"]
Manage --> End(["Done"])
Notify --> End
```

**Diagram sources**
- [api.js](file://src/lib/api.js)
- [index.js](file://server/index.js)
- [NotificationSystem.jsx](file://src/components/NotificationSystem.jsx)

**Section sources**
- [api.js](file://src/lib/api.js)
- [index.js](file://server/index.js)
- [NotificationSystem.jsx](file://src/components/NotificationSystem.jsx)

### Activity Tracking
Recent activity feed aggregates user actions:
- Action types: posts, likes, comments, achievements
- Timeline rendering with pagination
- Privacy filtering per user settings

```mermaid
flowchart TD
Actions["User Actions"] --> Queue["Activity Queue"]
Queue --> Normalize["Normalize Events"]
Normalize --> Filter["Apply Privacy Filters"]
Filter --> Store["Store in Activity Feed"]
Store --> Render["Render RecentActivityCard.jsx"]
```

**Diagram sources**
- [RecentActivityCard.jsx](file://src/components/RecentActivityCard.jsx)
- [index.js](file://server/index.js)

**Section sources**
- [RecentActivityCard.jsx](file://src/components/RecentActivityCard.jsx)
- [index.js](file://server/index.js)

### User Profile System
Profile management includes avatar handling, personal info, and privacy controls:
- Avatar upload and preview
- Editable profile fields
- Privacy settings for visibility
- Comments and activity timeline

```mermaid
classDiagram
class ProfilePage {
+loadProfile()
+updateAvatar()
+saveProfile()
+togglePrivacy()
}
class ProfileComments {
+addComment()
+deleteComment()
}
class NotificationSystem {
+subscribe()
+show()
}
ProfilePage --> ProfileComments : "uses"
ProfilePage --> NotificationSystem : "integrates"
```

**Diagram sources**
- [ProfilePage.jsx](file://src/pages/ProfilePage.jsx)
- [ProfileComments.jsx](file://src/components/ProfileComments.jsx)
- [NotificationSystem.jsx](file://src/components/NotificationSystem.jsx)

**Section sources**
- [ProfilePage.jsx](file://src/pages/ProfilePage.jsx)
- [ProfileComments.jsx](file://src/components/ProfileComments.jsx)
- [NotificationSystem.jsx](file://src/components/NotificationSystem.jsx)

### Achievement System
Achievement tracking and showcase:
- Trigger conditions for unlocks
- Progress visualization
- Public showcase on profile

```mermaid
sequenceDiagram
participant Player as "Player"
participant Game as "Game Logic"
participant API as "API Client"
participant S as "Server"
participant UI as "AchievementSystem.jsx"
Player->>Game : "Complete Challenge"
Game->>API : "POST /achievements/unlock"
API->>S : "Record unlock"
S-->>API : "OK"
API-->>UI : "Update achievements"
UI-->>Player : "Show achievement"
```

**Diagram sources**
- [AchievementSystem.jsx](file://src/components/AchievementSystem.jsx)
- [AchievementShowcase.jsx](file://src/components/AchievementShowcase.jsx)
- [api.js](file://src/lib/api.js)
- [index.js](file://server/index.js)

**Section sources**
- [AchievementSystem.jsx](file://src/components/AchievementSystem.jsx)
- [AchievementShowcase.jsx](file://src/components/AchievementShowcase.jsx)
- [api.js](file://src/lib/api.js)
- [index.js](file://server/index.js)

### Community Features: Forums, Leaderboards, User-Generated Content
- Forums: threaded discussions with moderation
- Leaderboards: rankings by score/achievements
- UGC: posts, screenshots, reviews with approval workflows

```mermaid
graph LR
Forum["Forums"] --> Posts["Posts"]
Forum --> Threads["Threads"]
Posts --> Moderate["Moderation"]
Leaderboard["LeaderboardPage.jsx"] --> Rankings["Rankings"]
UGC["User-Generated Content"] --> Review["Review Workflow"]
Moderate --> Safe["Safe Content"]
Review --> Safe
```

**Diagram sources**
- [CommunityPage.jsx](file://src/pages/CommunityPage.jsx)
- [LeaderboardPage.jsx](file://src/pages/LeaderboardPage.jsx)
- [index.js](file://server/index.js)

**Section sources**
- [CommunityPage.jsx](file://src/pages/CommunityPage.jsx)
- [LeaderboardPage.jsx](file://src/pages/LeaderboardPage.jsx)
- [index.js](file://server/index.js)

### Authentication Integration and Data Validation
- Authentication handled via Tauri APIs and session tokens
- API client wraps requests with headers and validation
- Input validation on client and server sides

```mermaid
sequenceDiagram
participant UI as "UI"
participant T as "Tauri"
participant API as "API Client"
participant S as "Server"
UI->>T : "Login"
T-->>UI : "Session token"
UI->>API : "Authenticated request"
API->>S : "With Authorization header"
S-->>API : "Validate token"
API-->>UI : "Response"
```

**Diagram sources**
- [tauri.js](file://src/lib/tauri.js)
- [api.js](file://src/lib/api.js)
- [index.js](file://server/index.js)

**Section sources**
- [tauri.js](file://src/lib/tauri.js)
- [api.js](file://src/lib/api.js)
- [index.js](file://server/index.js)

## Dependency Analysis
Key dependencies and relationships:
- Frontend depends on API client for network operations
- API client depends on Tauri for secure context and window management
- Server provides REST endpoints for social features
- Tauri configuration defines allowed capabilities and window behavior

```mermaid
graph TB
React["React UI"] --> API["api.js"]
API --> Tauri["tauri.js"]
API --> Server["server/index.js"]
Tauri --> Config["tauri.conf.json"]
Server --> Data["Data Store"]
```

**Diagram sources**
- [api.js](file://src/lib/api.js)
- [tauri.js](file://src/lib/tauri.js)
- [index.js](file://server/index.js)
- [tauri.conf.json](file://src-tauri/tauri.conf.json)

**Section sources**
- [api.js](file://src/lib/api.js)
- [tauri.js](file://src/lib/tauri.js)
- [index.js](file://server/index.js)
- [tauri.conf.json](file://src-tauri/tauri.conf.json)

## Performance Considerations
- Lazy load heavy components (e.g., 3D skin viewer) to reduce initial bundle size
- Debounce real-time updates to minimize network overhead
- Paginate activity feeds and leaderboards
- Cache frequently accessed data locally via Tauri
- Optimize image uploads (avatars, screenshots) with compression and resizing

## Troubleshooting Guide
Common issues and resolutions:
- Authentication failures: Verify Tauri session token lifecycle and refresh logic
- Network errors: Check API client error handling and retry policies
- Real-time update delays: Confirm WebSocket connections and server push mechanisms
- Privacy violations: Audit privacy filters and user consent flows
- Desktop packaging issues: Validate Tauri capabilities and entitlements

**Section sources**
- [tauri.js](file://src/lib/tauri.js)
- [api.js](file://src/lib/api.js)
- [index.js](file://server/index.js)
- [NotificationSystem.jsx](file://src/components/NotificationSystem.jsx)

## Conclusion
The social networking system integrates React UI, Tauri desktop capabilities, and a Node.js backend to deliver a cohesive platform for friends, messaging, groups, activity tracking, and achievements. With robust authentication, privacy controls, and real-time updates, it provides a scalable foundation for community-driven features while maintaining performance and user safety.