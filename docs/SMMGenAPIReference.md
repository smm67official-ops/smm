# SMMGen API — Full Reference

**Source:** https://my.smmgen.com/api (extracted 2026-08-15)

---

## 1. Connection Basics

| Item | Value |
|---|---|
| **HTTP Method** | `POST` |
| **API URL** | `https://my.smmgen.com/api/v2` |
| **API Key** | Get it on the Account page: https://my.smmgen.com/account |
| **Response format** | JSON |
| **Body encoding** | `application/x-www-form-urlencoded` (standard form POST) |

Every request sends two mandatory fields plus action-specific fields:

```
key=YOUR_API_KEY&action=ACTION_NAME&...
```

> This is a **Perfect Panel**–style SMM API. Anything you build against it will also work
> against most other SMM panels with only the base URL and key changed.

---

## 2. Actions Overview

| Action | Purpose |
|---|---|
| `services` | List all services (id, name, category, rate, min, max, refill, cancel) |
| `add` | Create an order |
| `status` | Order status (single via `order`, bulk via `orders`) |
| `refill` | Create refill (single via `order`, bulk via `orders`) |
| `refill_status` | Refill status (single via `refill`, bulk via `refills`) |
| `cancel` | Cancel orders (bulk only, via `orders`) |
| `balance` | Account balance |

Bulk endpoints accept **up to 100 comma-separated IDs**.

---

## 3. Service List

**Request**

| Parameter | Description |
|---|---|
| `key` | Your API key |
| `action` | `services` |

**Response**

```json
[
  {
    "service": 1,
    "name": "Followers",
    "type": "Default",
    "category": "First Category",
    "rate": "0.90",
    "min": "50",
    "max": "10000",
    "refill": true,
    "cancel": true
  },
  {
    "service": 2,
    "name": "Comments",
    "type": "Custom Comments",
    "category": "Second Category",
    "rate": "8",
    "min": "10",
    "max": "1500",
    "refill": false,
    "cancel": true
  }
]
```

**Field notes**

- `rate` = price **per 1000 units** in your account currency.
- `type` tells you **which set of `add` parameters to use** (see section 4).
- `refill` / `cancel` = booleans indicating whether those actions are supported for that service.

**Price formula:** `cost = rate * quantity / 1000`

---

## 4. Add Order — parameters by service type

The `add` action always requires `key`, `action=add`, and `service`.
The remaining fields depend on the service's `type` value.

Internal type IDs (useful if you map types numerically):

| Type ID | Type name |
|---|---|
| 0 | Default |
| 10 | Package |
| 2 | Custom Comments |
| 9 | Mentions |
| 3 | Mentions with Hashtags |
| 4 | Mentions Custom List |
| 6 | Mentions Hashtag |
| 7 | Mentions User Followers |
| 8 | Mentions Media Likers |
| 14 | Custom Comments Package |
| 15 | Comment Likes |
| 17 | Poll |
| 20 | Invites from Groups |
| 100 | Subscriptions |
| 102 | Web Traffic |

### 4.1 Default (type 0)

| Parameter | Description |
|---|---|
| `key` | Your API key |
| `action` | `add` |
| `service` | Service ID |
| `link` | Link to page |
| `quantity` | Needed quantity |
| `runs` *(optional)* | Runs to deliver |
| `interval` *(optional)* | Interval in minutes |

### 4.2 Package (type 10)

| Parameter | Description |
|---|---|
| `key`, `action`, `service` | as above |
| `link` | Link to page |

*(No `quantity` — the package defines it.)*

### 4.3 Custom Comments (type 2)

| Parameter | Description |
|---|---|
| `key`, `action`, `service` | as above |
| `link` | Link to page |
| `comments` | Comments list separated by `\r\n` or `\n` |

### 4.4 Mentions (type 9)

| Parameter | Description |
|---|---|
| `key`, `action`, `service` | as above |
| `link` | Link to page |
| `quantity` | Needed quantity |
| `usernames` | Usernames list separated by `\r\n` or `\n` |

### 4.5 Mentions with Hashtags (type 3)

| Parameter | Description |
|---|---|
| `key`, `action`, `service` | as above |
| `link` | Link to page |
| `quantity` | Needed quantity |
| `usernames` | Usernames list separated by `\r\n` or `\n` |
| `hashtags` | Hashtags list separated by `\r\n` or `\n` |

### 4.6 Mentions Custom List (type 4)

| Parameter | Description |
|---|---|
| `key`, `action`, `service` | as above |
| `link` | Link to page |
| `usernames` | Usernames list separated by `\r\n` or `\n` |

### 4.7 Mentions Hashtag (type 6)

| Parameter | Description |
|---|---|
| `key`, `action`, `service` | as above |
| `link` | Link to page |
| `quantity` | Needed quantity |
| `hashtag` | Hashtag to scrape usernames from |

### 4.8 Mentions User Followers (type 7)

| Parameter | Description |
|---|---|
| `key`, `action`, `service` | as above |
| `link` | Link to page |
| `quantity` | Needed quantity |
| `username` | URL to scrape followers from |

### 4.9 Mentions Media Likers (type 8)

| Parameter | Description |
|---|---|
| `key`, `action`, `service` | as above |
| `link` | Link to page |
| `quantity` | Needed quantity |
| `media` | Media URL to scrape likers from |

### 4.10 Custom Comments Package (type 14)

| Parameter | Description |
|---|---|
| `key`, `action`, `service` | as above |
| `link` | Link to page |
| `comments` | Comments list separated by `\r\n` or `\n` |

### 4.11 Comment Likes (type 15)

| Parameter | Description |
|---|---|
| `key`, `action`, `service` | as above |
| `link` | Link to page |
| `quantity` | Needed quantity |
| `username` | Username of the comment owner |

### 4.12 Poll (type 17)

| Parameter | Description |
|---|---|
| `key`, `action`, `service` | as above |
| `link` | Link to page |
| `quantity` | Needed quantity |
| `answer_number` | Answer number of the poll |

### 4.13 Invites from Groups (type 20)

| Parameter | Description |
|---|---|
| `key`, `action`, `service` | as above |
| `link` | Link to page |
| `quantity` | Needed quantity |
| `groups` | Groups list separated by `\r\n` or `\n` |

### 4.14 Subscriptions (type 100)

| Parameter | Description |
|---|---|
| `key`, `action`, `service` | as above |
| `username` | Username |
| `min` | Quantity min |
| `max` | Quantity max |
| `posts` *(optional)* | Limits how many new (future) posts are parsed and get orders. If not set, the subscription is unlimited. |
| `old_posts` *(optional)* | Number of existing posts to parse and create orders for (if the service supports it). |
| `delay` | Delay in minutes. Allowed: `0, 5, 10, 15, 20, 30, 40, 50, 60, 90, 120, 150, 180, 210, 240, 270, 300, 360, 420, 480, 540, 600` |
| `expiry` *(optional)* | Expiry date, format `d/m/Y` |

*(No `link` — subscriptions target a username.)*

### 4.15 Web Traffic (type 102)

| Parameter | Description |
|---|---|
| `key`, `action`, `service` | as above |
| `link` | Link to page |
| `quantity` | Needed quantity |
| `runs` *(optional)* | Runs to deliver |
| `interval` *(optional)* | Interval in minutes |
| `country` | Country code or full name. Format: `"US"` or `"United States"` |
| `device` | `1` Desktop, `2` Mobile (Android), `3` Mobile (iOS), `4` Mixed (Mobile), `5` Mixed (Mobile & Desktop) |
| `type_of_traffic` | `1` Google Keyword, `2` Custom Referrer, `3` Blank Referrer |
| `google_keyword` | Required if `type_of_traffic = 1` |
| `referring_url` | Required if `type_of_traffic = 2` |

**Add order response**

```json
{ "order": 23501 }
```

---

## 5. Order Status

**Single order**

| Parameter | Description |
|---|---|
| `key` | Your API key |
| `action` | `status` |
| `order` | Order ID |

```json
{
  "charge": "0.27819",
  "start_count": "3572",
  "status": "Partial",
  "remains": "157",
  "currency": "USD"
}
```

**Multiple orders** (up to 100 IDs, comma-separated in `orders`)

```json
{
  "1":   { "charge": "0.27819", "start_count": "3572", "status": "Partial",     "remains": "157", "currency": "USD" },
  "10":  { "error": "Incorrect order ID" },
  "100": { "charge": "1.44219", "start_count": "234",  "status": "In progress", "remains": "10",  "currency": "USD" }
}
```

**Status values seen in the docs:** `Partial`, `In progress`.
Standard Perfect Panel panels also return: `Pending`, `Processing`, `Completed`, `Canceled`.
→ *Treat status as a free-form string; don't hard-fail on unknown values.*

---

## 6. Refill

**Create refill (single)**

| Parameter | Description |
|---|---|
| `key` | Your API key |
| `action` | `refill` |
| `order` | Order ID |

```json
{ "refill": "1" }
```

**Create refill (multiple)** — `orders` = comma-separated IDs (max 100)

```json
[
  { "order": 1, "refill": 1 },
  { "order": 2, "refill": 2 },
  { "order": 3, "refill": { "error": "Incorrect order ID" } }
]
```

**Refill status (single)** — `action=refill_status`, `refill` = Refill ID

```json
{ "status": "Completed" }
```

**Refill status (multiple)** — `refills` = comma-separated IDs (max 100)

```json
[
  { "refill": 1, "status": "Completed" },
  { "refill": 2, "status": "Rejected" },
  { "refill": 3, "status": { "error": "Refill not found" } }
]
```

---

## 7. Cancel

| Parameter | Description |
|---|---|
| `key` | Your API key |
| `action` | `cancel` |
| `orders` | Order IDs, comma-separated, up to 100 |

```json
[
  { "order": 9, "cancel": { "error": "Incorrect order ID" } },
  { "order": 2, "cancel": 1 }
]
```

*Note: cancel is **bulk-only** — there is no single-`order` form documented.*

---

## 8. Balance

| Parameter | Description |
|---|---|
| `key` | Your API key |
| `action` | `balance` |

```json
{ "balance": "100.84292", "currency": "USD" }
```

---

## 9. Error Handling

The docs only show errors **inline inside bulk responses** (e.g. `{"error": "Incorrect order ID"}`).
Perfect Panel APIs return top-level errors in the same shape:

```json
{ "error": "Incorrect request" }
```

Common messages: `Incorrect request`, `Incorrect API key`, `Incorrect service ID`,
`Incorrect link`, `Incorrect quantity`, `Not enough funds on balance`,
`Active order with this link exists`, `Incorrect order ID`.

**Integration rule:** always check for an `error` property **before** reading `order` /
`status` / `balance`. HTTP status is typically `200` even on logical errors.

---

## 10. Integration Checklist (connecting another website)

1. **Store the API key server-side only.** Never ship it to browser JS — anyone who
   reads it can spend your panel balance.
2. **Proxy all calls through your own backend endpoint** (e.g. `POST /api/smm/order`).
3. **Cache the `services` response** (15–60 min). It is large and changes rarely.
4. **Validate before ordering:** `quantity` between the service's `min` and `max`;
   correct parameter set for the service `type`.
5. **Compute price** as `rate * quantity / 1000` and add your own markup.
6. **Persist the returned `order` ID** against your own order record.
7. **Poll `status` in bulk** (100 IDs per call) on a cron, e.g. every 5–10 minutes —
   not per page view.
8. **Idempotency:** the API has no idempotency key. Guard against double-submit on your
   side (lock/unique constraint) or you will place duplicate paid orders.
9. **Timeouts & retries:** use ~30s timeout; retry only on network/5xx errors,
   never blindly retry `add`.
10. **Rate limits are not documented.** Be conservative (a few requests/second) and
    handle non-JSON responses (HTML error pages) gracefully.

---

## 11. Raw cURL examples

```bash
# Balance
curl -X POST https://my.smmgen.com/api/v2 \
  -d "key=YOUR_API_KEY" -d "action=balance"

# Services
curl -X POST https://my.smmgen.com/api/v2 \
  -d "key=YOUR_API_KEY" -d "action=services"

# Add default order
curl -X POST https://my.smmgen.com/api/v2 \
  -d "key=YOUR_API_KEY" -d "action=add" \
  -d "service=1" -d "link=https://example.com/user" -d "quantity=1000"

# Bulk status
curl -X POST https://my.smmgen.com/api/v2 \
  -d "key=YOUR_API_KEY" -d "action=status" -d "orders=1,10,100"
```
