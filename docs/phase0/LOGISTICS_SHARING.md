# Fleet sharing and parcel hubs (Phase 9 L11)

All behaviour sits behind the `phase9.logisticsNetwork` flag, requires the
`logistics.fleet.share` company permission, and is scoped by
`requireLogisticsAccess()` — a client never supplies a foreign company ID.

## Fleet sharing agreements

Two **platform-approved** logistics companies may share capacity. The owner
offers specific vehicles; the partner must explicitly consent before the
agreement can activate. Creating the offer records the owner's consent with a
timestamp and actor ID; accepting records the partner's consent the same way.

An agreement activates only when **all** of the following hold:

1. Status is `PENDING_PARTNER` (no already-answered offer can be revived).
2. Both consent timestamps exist.
3. Both companies are `APPROVED` by the platform.
4. The `accountableCompanyId` is exactly one of the two parties.
5. An insurance policy reference exists and its expiry is in the future.
6. The effective window is valid and has not ended.
7. At least one vehicle is shared; every shared vehicle is `ACTIVE`, its
   insurance (if recorded) has not expired, and it is not already committed to
   another active agreement.
8. No platform funds move: `rateAmount`/`rateCurrency` and `liabilityTerms` are
   informational contract data captured on the agreement.

Suspension and resumption are audited; resuming re-checks insurance and company
approval. Termination cancels all open shared-vehicle reservations.

### Accountability

Before a partner uses borrowed capacity it reserves a vehicle. The reservation
stores `usingCompanyId`, `accountableCompanyId` (copied from the agreement), the
linked job (if any) and the reserving actor. A second company cannot reserve the
same vehicle while a reservation is open. This is the single accountability
record per shared delivery; the job lifecycle itself is unchanged.

Withdrawing a vehicle that has an open reservation is rejected.

## Parcel hubs

A hub belongs to one company, has a code unique within that company, and
declares a parcel `capacity`. Intake creates a custody record (`STORED`) with a
six-digit pickup code generated server-side. Code and capacity are checked on
the server:

- Intake is rejected when stored + received parcels >= capacity, so a hub cannot
  be over-promised.
- Release requires the exact pickup code (`timingSafeEqual` comparison) and
  changes custody to `RELEASED` with recipient details and timestamps.
- Codes are shown exactly once — in the intake action result — and are never
  returned by list queries.
- Changing capacity below the number of stored parcels is rejected.

## Configurable defaults (not invented policy)

- Hub capacity defaults to 50 parcels; operators set the real value per hub.
- Rate, currency and liability terms are optional free-text/amount fields with
  no platform settlement or verification logic.
- Insurance expiry is required at the agreement level; vehicle-level insurance
  is checked only when a value is recorded.

## Data model and audit

New models: `FleetShareAgreement`, `FleetShareVehicle`, `FleetShareUsage`,
`ParcelHub`, `ParcelHubHandover`. Migration:
`prisma/migrations/20261124220000_phase9_logistics_l11`.

Audit actions: `FLEET_SHARE_CREATED`, `FLEET_SHARE_STATUS_CHANGED`,
`FLEET_SHARE_VEHICLE_CHANGED`, `PARCEL_HUB_SAVED`, `PARCEL_HANDOVER_RECORDED`.
Business rules live in `src/features/logistics-sharing/rules.ts` and are covered
by unit tests in `tests/unit/logistics-network-l11.test.ts`.
