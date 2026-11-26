# 11. UX Architecture Blueprint — Progressive Simplicity

This blueprint is the reference for how SupplyHub's many capabilities reach people without
feeling like enterprise software. It sits above the existing product, architecture and security
documents: `01-product-vision.md` still owns business policy, `08-security.md` owns authorization,
and this document owns the experience layer that orchestrates them.

> **Simple on the surface, powerful underneath.**
> The interface shows what a person needs for their role, task and level of experience. The
> platform keeps every capability underneath.

The implementation that ships with this blueprint lives in `src/features/workspace/`,
`src/components/workspace/`, `/workspace` and `/workspace/sell`.

---

## 1. The four layers

| Layer | Responsibility | Where it lives |
| --- | --- | --- |
| 1. User experience | Screens, components, copy, motion | `src/app`, `src/components` |
| 2. Experience orchestration | Role-aware tasks, guided flows, defaults, navigation, guidance | `src/features/workspace` |
| 3. Business capabilities | Catalog, POS, installments, agriculture, inventory, logistics, finance | `src/features/*` |
| 4. Platform infrastructure | PostgreSQL/Prisma, Auth.js, storage, payments, notifications, PWA | `src/server`, `prisma` |

Rules for the boundary between layers 2 and 3:

- Orchestration **never** duplicates business rules. It calls the same server actions the full
  forms call, so validation, permissions and audit logging stay in one place.
- Orchestration **never** decides money, status transitions or access. The guided listing flow ends
  in `saveProductAction`, which authorizes the request and validates it with Zod.
- Presentation **never** trusts a client-supplied role, business, vendor, price or status. The
  experience switcher only selects a view the server already proved the person has; every request
  is still authorized independently.
- AI may suggest or explain inside the experience layer. It may not enforce permissions, compute
  obligations or perform state transitions.

---

## 2. Personas and the experiences they get

One identity, several experiences. A person can be a seller and a buyer at once and never needs a
second account.

| Persona | Wants to accomplish | Reads storage | Home experience |
| --- | --- | --- | --- |
| Shop owner / studio | Sell, record a sale, prepare orders, know what they are owed | `Vendor`, `Business` | Selling |
| Farmer / producer | Record a harvest, list produce, agree a price, pool with a group | `AgricultureFarmer` (flag) | Farming |
| Bulk buyer / business buyer | Find products, request quantities, track orders and invoices | `Business`, B2B | Buying |
| Customer | Buy, track, message, keep favourites | `User` | Buying |
| Delivery agent | Find work, deliver, confirm hand-overs, see earnings | `DeliveryAgent` | Delivering |
| Logistics company | Dispatch, clients, fleet, team, opportunities | `LogisticsCompanyMember` (`ACTIVE`) | Logistics |
| Service provider | Publish services, manage bookings | `ServiceListing` | Selling |
| Administrator | Verification, moderation, reconciliation | `UserRole.ADMIN` | Admin surfaces (not personalised here) |

Experience resolution is deterministic and tested:

- `courier` is available when a `DeliveryAgent` row belongs to the user.
- `farmer` is available when an `AgricultureFarmer` row belongs to the user.
- `logistics` is available when the user holds an `ACTIVE` `LogisticsCompanyMember` row. Its tasks,
  attention items and navigation carry that company id, so nothing has to be guessed in the browser.
- `seller` is available when `studioIdentityFor()` resolves an approved vendor (business-linked or
  legacy owner) — the same rule the studio already uses.
- `buyer` is always available.
- `?as=` is validated against that list; anything else falls back to the first available view.

---

## 3. Task catalogue (user language, not module language)

| Technical module | User-facing task | Entry point |
| --- | --- | --- |
| Catalog management | Sell something | `/workspace/sell` |
| POS | Record a sale | `/vendor/pos` |
| Order fulfilment | Prepare orders | `/vendor/orders` |
| Payouts / receivables | See my money | `/vendor/earnings` |
| Storefront | Buy something | `/products` |
| Orders | My orders | `/account/orders` |
| Messaging | Messages | `/messages`, `/vendor/messages` |
| Wishlist | Saved products | `/account/wishlist` |
| Logistics dispatch | Arrange a delivery | `/delivery/request` |
| CRM | Add a customer | `/vendor/customers` |
| RFQ / wholesale | Request quantities | `/b2b/rfq/new` |
| Group buying | Buy together | `/vendor/group-buy/new` |
| Courier jobs | My deliveries, My earnings | `/courier` |
| Farm records | Record a harvest | `/agriculture/farm-management` |
| Produce listings | List produce | `/agriculture/farmer` |
| Harvest agreements | My agreements | `/agriculture/contracts` |
| Farmer groups | My groups | `/agriculture/groups` |
| Company dispatch | Dispatch a delivery | `/logistics/[companyId]/dispatch` |
| Company jobs | Company deliveries | `/logistics/[companyId]/jobs` |
| Company clients | Clients | `/logistics/[companyId]/clients` |
| Company team | Team | `/logistics/[companyId]/members` |

Adding a capability means adding one row here plus one `WorkspaceTask`; it does not mean adding a
menu item to everyone's home screen.

---

## 4. Navigation architecture

### Mobile (default)

| Destination | Seller | Farmer | Logistics | Buyer | Courier |
| --- | --- | --- | --- | --- | --- |
| Home | `/workspace` | `/workspace` | `/workspace` | `/workspace` | `/workspace` |
| Explore | `/products` | `/products` | `/products` | `/products` | `/products` |
| Activities | `/vendor/orders` | `/agriculture/farm-management` | `/logistics/[companyId]/dispatch` | `/account/orders` | `/courier` |
| Messages | `/vendor/messages` | `/messages` | `/messages` | `/messages` | `/messages` |
| More | `/account` | `/account` | `/account` | `/account` | `/account` |

- Five destinations maximum, persistent, with `aria-current="page"` and safe-area padding.
- The universal **Create** launcher is a single entry point whose catalogue is role-filtered.
- Desktop keeps the same information architecture: an inline navigation row plus the same launcher,
  rather than a second, differently organised product.

### Screen hierarchy

```
/workspace                     task-first home (this blueprint)
├── ?as=seller|buyer|courier   experience switch (validated server-side)
└── /workspace/sell            guided listing flow (four steps)
```

The studio (`/vendor/*`), business (`/business/*`), agriculture, logistics and admin areas remain
intact as the "power underneath" surfaces. The workspace links into them; it does not absorb them.

---

## 5. Role-based home screen

The home answers three questions and nothing else:

1. **What can I do?** — role-filtered task tiles plus the Create launcher.
2. **What needs my attention?** — urgent, counted items (orders, payments, stock, messages,
   deliveries). Empty is a first-class, honest state.
3. **How is my business doing?** — one headline number (today's settled sales for a seller, open
   orders for a buyer, deliveries in progress for a courier) with at most three supporting figures.

Deliberate omissions on the first screen: inventory, procurement, accounting, CRM, logistics
modules, charts and tables. They exist one tap away.

First-use guidance appears only while it is true: a seller with no published product sees a
three-step "Start here" checklist (first product, check stock, see money). It disappears once the
first product exists.

---

## 6. Guided task flows

### Sell something (implemented)

| Step | One decision | Guidance |
| --- | --- | --- |
| 1 | Which department? | Visual selection, not a long dropdown |
| 2 | Name and description; advanced options collapsed | Handle auto-built from the name |
| 3 | Price and stock | Contextual help under each field |
| 4 | Cover photo and review, then publish | Review of department, price and stock |

Behaviour contract:

- One decision per screen, a back button on every step, a progress bar with `aria-valuenow`.
- Smart defaults (handle, stock = 1, department remembered in the draft).
- The draft autosaves to `localStorage` and restores on return; the page says so.
- Advanced settings (web address, maker note) sit behind a disclosure, never in the happy path.
- The final step submits the **real** server action, so permission checks and Zod validation still
  run, and a published product goes live exactly as the studio form does.
- Errors are field-level and actionable; no raw status codes.

### Flow specs still to build (same pattern)

- Sell on installments: pay-in-full vs installments → deposit → frequency → generated schedule →
  buyer acceptance, with contract settings collapsed.
- Arrange a delivery: what, from where, to where, when → quote → confirm.
- Record a sale: scan or pick products → payment method (cash, mobile money, installment) → receipt.
- Sell my harvest: crop → quantity and unit → price per unit → collection point → preview.

---

## 7. Progressive disclosure rules

1. A screen asks for the smallest set of facts that completes the current decision.
2. Advanced configuration is available, collapsed, and never required to finish the common path.
3. Financial and contractual disclosures are the exception: irreversibility, who is involved, the
   amount, and what happens next are always visible before confirmation.
4. Defaults are shown as values a person can change, not as invisible policy.
5. Never hide a legal term to make a screen look simpler.

---

## 8. Contextual guidance system

| Form | Implementation |
| --- | --- |
| First use | "Start here" checklist, only while the business has no products |
| Contextual help | Short helper text beside inputs (`Help` block in the listing flow) |
| Visual explanation | Iconography per task; department cards instead of a select |
| Recovery | Field-level messages with the next action, e.g. "Enter a price like 1200 or 1200.50" |
| Confirmation | Review step before publishing; the destructive-action pattern stays in dialogs |

Copy rules: user language, present tense, no module names, no codes. Localisation is first-class:
every workspace string is a dictionary key in all five locales (en, sw, ar, zh, fr), and Kiswahili
uses everyday wording ("Uza kitu", "Malipo yanayodaiwa") rather than translated technical English.

---

## 9. PWA behaviour for the workspace

| Capability | Requirement |
| --- | --- |
| Installability | Existing manifest and install flow, unchanged |
| Navigation | Persistent bottom navigation on mobile |
| Connectivity | Show when offline; say plainly whether an action is saved locally, synced or confirmed |
| Drafts | Listing draft survives a closed tab (implemented with `localStorage`) |
| Sensitive caching | Never cache workspace, order, payment, vendor or admin responses |
| Permissions | Camera for product photos, location only on explicit request |
| Touch | 44px minimum targets, comfortable input sizes, no horizontal overflow at 360px |

Optimistic answers are allowed only for reversible, local actions. Money and status always wait
for the server.

---

## 10. Design-system components

Implemented in this slice:

- `WorkspaceShell` — header, identity bar, experience switcher, desktop nav
- `WorkspaceNav` — bottom navigation and inline desktop navigation
- `ActionLauncher` — universal Create catalogue, role-filtered
- `GuidedListingFlow` — wizard with progress, draft, review and server submit
- Task tiles, attention rows and the "Start here" checklist as composable markup

Still required as the platform grows: `BusinessSwitcher` (present, using the existing active-business
action), `SmartForm`, `OrderCard`, `PaymentSummary`, `StatusTimeline`, `EmptyState` (exists),
`ContextualHelp` (exists as helper text), `ConfirmationSheet`, `OfflineStatus`, `SyncStatus`,
`NotificationCenter`. Each must define interaction behaviour, not only appearance.

Confirmation pattern — every sensitive confirmation states: what happens, who is involved, how much
money (if any), whether it can be reversed, and what happens next.

---

## 11. Measurable simplicity targets

Proposed product targets, not measured results. Measure with real sellers and buyers on their own
phones, asking them to complete the task, not whether they like the screens.

| Measurement | Initial target |
| --- | --- |
| First product listing | under 2 minutes |
| Recording an ordinary sale | under 45 seconds |
| Finding an existing order | under 20 seconds |
| Creating a basic delivery request | under 90 seconds |
| Common tasks completed without help | at least 85% |
| Recovering from a common input error | a clear next action every time |

Instrumentation must be privacy-safe: task name, duration bucket and outcome — never customer data
or amounts.

---

## 12. Usability acceptance criteria

A workspace change is ready only when:

- [ ] The first screen shows role-relevant tasks and no unrelated modules.
- [ ] Every action ends in a route that authorizes on the server.
- [ ] No count, amount or status is derived from client input.
- [ ] A guided flow has one decision per step, a back control and visible progress.
- [ ] Drafts survive navigation; the interface says where the draft is stored.
- [ ] Empty states are honest and offer a next step.
- [ ] All strings exist in all five locales (`tests/unit/i18n.test.ts` passes).
- [ ] Keyboard focus is visible, targets are at least 44px, and 360px width has no overflow.
- [ ] Reduced-motion and dark-mode rendering are both checked.
- [ ] `format:check`, `lint`, `typecheck`, `test` and `build` pass.

---

## 13. Roadmap

1. Personas and task catalogue — documented above; keep it updated as capabilities ship.
2. Journeys — map each catalogue row end to end, including cancellation and error paths.
3. Wireframes — mobile first, then desktop equivalents.
4. Shared components — build the interaction patterns before more modules.
5. Guided flows — listing (done), sale, delivery, installments, harvest.
6. Test with real users — farmers, shop owners and couriers on their own devices.
7. Standardise — fix the flows people hesitate on before adding modules.

Do not make the interface simple by removing capabilities. Make it simple by removing unnecessary
decisions.
