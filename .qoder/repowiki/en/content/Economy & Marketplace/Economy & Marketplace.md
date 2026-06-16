# Economy & Marketplace

<cite>
**Referenced Files in This Document**
- [ShopPage.jsx](file://src/pages/ShopPage.jsx)
- [InventoryTab.jsx](file://src/pages/InventoryTab.jsx)
- [LeaderboardPage.jsx](file://src/pages/LeaderboardPage.jsx)
- [TopupPage.jsx](file://website/src/pages/TopupPage.jsx)
- [SupportPage.jsx](file://src/pages/SupportPage.jsx)
- [remote_server_index.js](file://scratch/remote_server_index.js)
- [server_index.js](file://server_index.js)
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
10. [Appendices](#appendices)

## Introduction
This document describes the virtual economy and marketplace system centered around the in-game currency SBT. It covers:
- Virtual currency (SBT) management and balance tracking
- Shop functionality for direct purchases and cosmetic/premium items
- Trading platform for peer-to-peer (P2P) listings
- Inventory management for item storage, categorization, and equipping
- Leaderboard system (placeholder)
- Transaction history and audit trail for financial activities
- Payment processor integration and security measures
- Economic gameplay mechanics and revenue models
- Anti-fraud measures and transaction validation processes

## Project Structure
The economy spans frontend UI pages and backend services:
- Frontend UI pages for shop, inventory, top-up, and support
- Backend endpoints for shop, inventory, market listings, and payments
- Telegram bot integration for manual balance confirmations and receipts

```mermaid
graph TB
subgraph "Frontend"
SP["ShopPage.jsx"]
IT["InventoryTab.jsx"]
LB["LeaderboardPage.jsx"]
TP["TopupPage.jsx"]
SU["SupportPage.jsx"]
end
subgraph "Backend"
RS["remote_server_index.js"]
SRV["server_index.js"]
end
SP --> RS
IT --> RS
TP --> SRV
SU --> SRV
LB --> LB
```

**Diagram sources**
- [ShopPage.jsx:51-83](file://src/pages/ShopPage.jsx#L51-L83)
- [InventoryTab.jsx:236-278](file://src/pages/InventoryTab.jsx#L236-L278)
- [LeaderboardPage.jsx:4-21](file://src/pages/LeaderboardPage.jsx#L4-L21)
- [TopupPage.jsx:23-57](file://website/src/pages/TopupPage.jsx#L23-L57)
- [SupportPage.jsx:427-564](file://src/pages/SupportPage.jsx#L427-L564)
- [remote_server_index.js:630-643](file://scratch/remote_server_index.js#L630-L643)
- [server_index.js:1518-1770](file://server_index.js#L1518-L1770)

**Section sources**
- [ShopPage.jsx:51-83](file://src/pages/ShopPage.jsx#L51-L83)
- [InventoryTab.jsx:236-278](file://src/pages/InventoryTab.jsx#L236-L278)
- [LeaderboardPage.jsx:4-21](file://src/pages/LeaderboardPage.jsx#L4-L21)
- [TopupPage.jsx:23-57](file://website/src/pages/TopupPage.jsx#L23-L57)
- [SupportPage.jsx:427-564](file://src/pages/SupportPage.jsx#L427-L564)
- [remote_server_index.js:630-643](file://scratch/remote_server_index.js#L630-L643)
- [server_index.js:1518-1770](file://server_index.js#L1518-L1770)

## Core Components
- SBT currency and balance
  - Balance display and tracking across UI surfaces
  - Balance updates after purchases and top-ups
- Shop (direct purchases)
  - Server and category filtering
  - Cart and checkout flow
- Market (P2P listings)
  - Listing retrieval and purchase
  - Sell modal for listing owned items
- Inventory
  - Item grid, filtering, and equipping/unequipping
- Top-up and payments
  - Payment method selection and initiation
  - Telegram-based manual confirmations
- Leaderboard
  - Placeholder page indicating future development

**Section sources**
- [ShopPage.jsx:86-113](file://src/pages/ShopPage.jsx#L86-L113)
- [ShopPage.jsx:496-600](file://src/pages/ShopPage.jsx#L496-L600)
- [InventoryTab.jsx:236-314](file://src/pages/InventoryTab.jsx#L236-L314)
- [TopupPage.jsx:23-57](file://website/src/pages/TopupPage.jsx#L23-L57)
- [LeaderboardPage.jsx:4-21](file://src/pages/LeaderboardPage.jsx#L4-L21)

## Architecture Overview
The economy integrates frontend UI with backend endpoints and a Telegram bot for manual verification.

```mermaid
sequenceDiagram
participant U as "User"
participant UI as "ShopPage.jsx"
participant API as "remote_server_index.js"
participant INV as "Inventory Endpoint"
participant BAL as "Balance Update"
U->>UI : Select items and click Buy
UI->>API : POST /api/shop/buy (itemIds)
API->>INV : Update inventory and balance
INV-->>API : { ok, balance, inventory }
API-->>UI : { balance, inventory }
UI->>BAL : Update local balance display
BAL-->>U : SBT balance updated
```

**Diagram sources**
- [ShopPage.jsx:95-113](file://src/pages/ShopPage.jsx#L95-L113)
- [remote_server_index.js:630-643](file://scratch/remote_server_index.js#L630-L643)

## Detailed Component Analysis

### SBT Currency and Balance Tracking
- Display and formatting
  - Balance shown in multiple UI locations with consistent SBT notation
- Updates
  - After shop purchases and top-ups, the UI receives updated balance and refreshes displays
- Backend persistence
  - Balance stored per user account and updated atomically during transactions

```mermaid
flowchart TD
Start(["Purchase Initiated"]) --> Validate["Validate Purchase<br/>- Items exist<br/>- User has sufficient SBT"]
Validate --> Deduct["Deduct SBT from user balance"]
Deduct --> UpdateInv["Add item to user inventory"]
UpdateInv --> Persist["Persist account state"]
Persist --> Notify["Notify UI with new balance"]
Notify --> End(["Balance Updated"])
```

**Diagram sources**
- [remote_server_index.js:630-643](file://scratch/remote_server_index.js#L630-L643)

**Section sources**
- [ShopPage.jsx:104-105](file://src/pages/ShopPage.jsx#L104-L105)
- [remote_server_index.js:630-643](file://scratch/remote_server_index.js#L630-L643)

### Shop Functionality (Direct Purchases)
- Filtering and presentation
  - Server and category filters
  - Item cards with rarity and pricing
- Cart and checkout
  - Add/remove items
  - Submit order via authenticated endpoint
- Post-purchase
  - Balance update and notification

```mermaid
sequenceDiagram
participant U as "User"
participant UI as "DonateView"
participant API as "remote_server_index.js"
U->>UI : Add items to cart
U->>UI : Click Checkout
UI->>API : POST /api/shop/buy { itemIds }
API-->>UI : { balance, inventory }
UI->>U : Show success notification and reset cart
```

**Diagram sources**
- [ShopPage.jsx:86-113](file://src/pages/ShopPage.jsx#L86-L113)
- [remote_server_index.js:630-643](file://scratch/remote_server_index.js#L630-L643)

**Section sources**
- [ShopPage.jsx:86-113](file://src/pages/ShopPage.jsx#L86-L113)

### Marketplace (P2P Listings)
- Browse listings
  - Load active listings with optional type filter
- Purchase
  - Buy button triggers purchase on selected listing
- Sell
  - Modal to pick owned item and set price
  - Creates listing and removes item from inventory until sold

```mermaid
sequenceDiagram
participant U as "User"
participant UI as "MarketplaceView"
participant API as "remote_server_index.js"
U->>UI : Open Marketplace
UI->>API : GET /api/market/listings?type=...
API-->>UI : { listings }
U->>UI : Click Buy on a listing
UI->>API : POST /api/market/buy/{listingId}
API-->>UI : Success (updates inventory and balance)
U->>UI : Open Sell Modal
UI->>API : POST /api/market/sell { itemId, price }
API-->>UI : Success (creates listing)
```

**Diagram sources**
- [ShopPage.jsx:496-600](file://src/pages/ShopPage.jsx#L496-L600)
- [ShopPage.jsx:626-668](file://src/pages/ShopPage.jsx#L626-L668)
- [ShopPage.jsx:670-765](file://src/pages/ShopPage.jsx#L670-L765)
- [remote_server_index.js:630-643](file://scratch/remote_server_index.js#L630-L643)

**Section sources**
- [ShopPage.jsx:496-600](file://src/pages/ShopPage.jsx#L496-L600)
- [ShopPage.jsx:626-668](file://src/pages/ShopPage.jsx#L626-L668)
- [ShopPage.jsx:670-765](file://src/pages/ShopPage.jsx#L670-L765)

### Inventory Management
- Loading and caching
  - Fetch inventory and equipped items; fallback to local cache when offline
- Filtering and search
  - By category, server, and free-text search
- Equipping and unequipping
  - Toggle equipment state for items
- Detail view
  - Extended info and action buttons

```mermaid
flowchart TD
Load["Load Inventory"] --> Cache{"Online?"}
Cache --> |Yes| Fetch["Fetch from /api/inventory"]
Fetch --> SaveCache["Save to localStorage"]
Cache --> |No| LoadCache["Load from localStorage"]
SaveCache --> Render["Render grid and detail"]
LoadCache --> Render
Render --> Actions["Equip/Unequip actions"]
Actions --> Update["POST /api/inventory/equip or /api/inventory/unequip"]
Update --> Reload["Reload inventory"]
```

**Diagram sources**
- [InventoryTab.jsx:248-278](file://src/pages/InventoryTab.jsx#L248-L278)
- [InventoryTab.jsx:280-314](file://src/pages/InventoryTab.jsx#L280-L314)

**Section sources**
- [InventoryTab.jsx:236-314](file://src/pages/InventoryTab.jsx#L236-L314)
- [InventoryTab.jsx:316-337](file://src/pages/InventoryTab.jsx#L316-L337)

### Leaderboard System
- Current state
  - Placeholder page indicating development status
- Future scope
  - Ranking by various metrics and achievements

```mermaid
flowchart TD
Placeholder["LeaderboardPage.jsx"] --> Dev["Development in progress"]
Dev --> Features["Rank by metrics and achievements"]
```

**Diagram sources**
- [LeaderboardPage.jsx:4-21](file://src/pages/LeaderboardPage.jsx#L4-L21)

**Section sources**
- [LeaderboardPage.jsx:4-21](file://src/pages/LeaderboardPage.jsx#L4-L21)

### Transaction History and Audit Trail
- Financial activity logging
  - Backend maintains account state and transaction outcomes
- Telegram audit
  - Manual payment tickets with receipts and admin actions
  - Receipt submission and confirmation process

```mermaid
sequenceDiagram
participant U as "User"
participant WEB as "TopupPage.jsx"
participant BOT as "server_index.js"
participant TG as "Telegram Bot"
U->>WEB : Choose amount and method
WEB->>BOT : Create payment request
BOT-->>TG : Send ticket with instructions
TG->>U : Prompt to send receipt
U->>TG : Attach receipt photo/document
TG->>BOT : Forward receipt to admin session
BOT-->>U : Confirm balance credit (manual)
```

**Diagram sources**
- [TopupPage.jsx:34-57](file://website/src/pages/TopupPage.jsx#L34-L57)
- [server_index.js:1518-1770](file://server_index.js#L1518-L1770)

**Section sources**
- [TopupPage.jsx:34-57](file://website/src/pages/TopupPage.jsx#L34-L57)
- [server_index.js:1518-1770](file://server_index.js#L1518-L1770)

### Payment Processor Integration and Security Measures
- Payment initiation
  - Website initiates payment creation and redirects to external provider
- Manual verification
  - Telegram bot routes payments to admins for manual confirmation
  - Receipts collected and verified before crediting balances
- Security
  - Tokenized requests with bearer tokens
  - Admin-only controls for balance adjustments
  - Receipt-based audit trail

```mermaid
flowchart TD
Start(["Top-up Request"]) --> Init["Initiate payment via API"]
Init --> Redirect["Redirect to payment provider"]
Redirect --> Pending["Awaiting admin confirmation"]
Pending --> Receipt["Admin receives receipt"]
Receipt --> Verify{"Verification passed?"}
Verify --> |Yes| Credit["Credit SBT to user balance"]
Verify --> |No| Reject["Reject and notify user"]
Credit --> Done(["Transaction complete"])
Reject --> Done
```

**Diagram sources**
- [TopupPage.jsx:34-57](file://website/src/pages/TopupPage.jsx#L34-L57)
- [server_index.js:1518-1770](file://server_index.js#L1518-L1770)

**Section sources**
- [TopupPage.jsx:23-57](file://website/src/pages/TopupPage.jsx#L23-L57)
- [SupportPage.jsx:427-564](file://src/pages/SupportPage.jsx#L427-L564)
- [server_index.js:1518-1770](file://server_index.js#L1518-L1770)

### Economic Gameplay Mechanics and Revenue Models
- Direct monetization
  - Cosmetic and premium items in shop
  - VIP status and server-wide effects
- Secondary market
  - Player-driven P2P trading via marketplace
- Revenue model
  - Upfront purchases (shop)
  - Transaction fees on marketplace (conceptual)
  - Premium subscriptions (conceptual)

[No sources needed since this section provides general guidance]

### Anti-Fraud Measures and Transaction Validation
- Validation steps
  - Item existence checks
  - Balance sufficiency verification
  - Atomic balance and inventory updates
- Manual verification
  - Telegram bot workflow for receipts
  - Admin callbacks for balance adjustments
- Audit trail
  - Persistent logs and ticket histories

**Section sources**
- [remote_server_index.js:630-643](file://scratch/remote_server_index.js#L630-L643)
- [server_index.js:1518-1770](file://server_index.js#L1518-L1770)
- [SupportPage.jsx:427-564](file://src/pages/SupportPage.jsx#L427-L564)

## Dependency Analysis
- UI-to-backend dependencies
  - Shop and inventory depend on authenticated fetch to backend endpoints
  - Top-up depends on payment creation API and Telegram bot for manual confirmations
- Backend-to-storage dependencies
  - Account and inventory persistence via Redis-like storage
- Cross-service dependencies
  - Telegram bot coordinates manual confirmations and receipts

```mermaid
graph LR
UI_Shop["ShopPage.jsx"] --> API_Buy["/api/shop/buy"]
UI_Market["ShopPage.jsx"] --> API_List["/api/market/listings"]
UI_Market --> API_BuyM["/api/market/buy/{id}"]
UI_Market --> API_Sell["/api/market/sell"]
UI_Inv["InventoryTab.jsx"] --> API_Inv["/api/inventory"]
UI_Top["TopupPage.jsx"] --> API_Pay["/payments/create"]
API_Pay --> Bot["Telegram Bot"]
```

**Diagram sources**
- [ShopPage.jsx:506-528](file://src/pages/ShopPage.jsx#L506-L528)
- [ShopPage.jsx:626-668](file://src/pages/ShopPage.jsx#L626-L668)
- [ShopPage.jsx:670-765](file://src/pages/ShopPage.jsx#L670-L765)
- [InventoryTab.jsx:248-278](file://src/pages/InventoryTab.jsx#L248-L278)
- [TopupPage.jsx:34-57](file://website/src/pages/TopupPage.jsx#L34-L57)
- [server_index.js:1518-1770](file://server_index.js#L1518-L1770)

**Section sources**
- [ShopPage.jsx:506-528](file://src/pages/ShopPage.jsx#L506-L528)
- [ShopPage.jsx:626-668](file://src/pages/ShopPage.jsx#L626-L668)
- [ShopPage.jsx:670-765](file://src/pages/ShopPage.jsx#L670-L765)
- [InventoryTab.jsx:248-278](file://src/pages/InventoryTab.jsx#L248-L278)
- [TopupPage.jsx:34-57](file://website/src/pages/TopupPage.jsx#L34-L57)
- [server_index.js:1518-1770](file://server_index.js#L1518-L1770)

## Performance Considerations
- UI responsiveness
  - Use of animations and lazy loading for item grids
  - Local caching for offline inventory access
- Backend throughput
  - Atomic balance and inventory updates
  - Efficient listing retrieval with filters
- Payment flow
  - Minimal client-side computation; rely on server-side validations

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
- Shop purchase errors
  - Insufficient SBT, item not found, or account not found
  - UI alerts and retry mechanisms
- Inventory sync issues
  - Fallback to cached inventory; check network connectivity
- Payment confirmations
  - Ensure receipt is attached; verify amount and method
  - Contact support if pending for extended periods

**Section sources**
- [remote_server_index.js:630-643](file://scratch/remote_server_index.js#L630-L643)
- [InventoryTab.jsx:252-276](file://src/pages/InventoryTab.jsx#L252-L276)
- [SupportPage.jsx:427-564](file://src/pages/SupportPage.jsx#L427-L564)

## Conclusion
The economy and marketplace system combines a direct shop, a player-driven marketplace, robust inventory management, and secure payment flows with manual verification. The architecture emphasizes atomic updates, clear audit trails, and user-friendly UIs across servers and categories.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices
- Glossary
  - SBT: In-game virtual currency
  - VIP: Premium status granting global benefits
  - P2P: Peer-to-peer trading between players

[No sources needed since this section provides general guidance]