import { StudioShell } from "@/components/vendor/studio-shell";
import { listBusinessesForUser } from "@/features/business/queries";
import { getStudioVendor } from "@/features/vendors/queries";
import { initialsFor } from "@/lib/utils/initials";
import { getSessionActor } from "@/server/auth/session";

// The studio workspace is authenticated per request, so its shell cannot be
// prerendered. Allow the segment to block instead of forcing a static shell.
export const instant = false;

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const actor = await getSessionActor();

  if (!actor) {
    return <>{children}</>;
  }

  const [vendor, memberships] = await Promise.all([
    getStudioVendor(actor),
    listBusinessesForUser(actor.id),
  ]);
  const name = vendor?.name ?? (actor.name.trim() || "Your studio");

  return (
    <StudioShell
      studio={{
        name,
        slug: vendor?.slug ?? null,
        monogram: vendor?.monogram ?? initialsFor(name),
        status: vendor?.status ?? null,
      }}
      businesses={memberships.map((membership) => ({
        id: membership.business.id,
        name: membership.business.name,
      }))}
      activeBusinessId={actor.business?.id ?? null}
      isOwner={actor.business?.isOwner ?? true}
    >
      {children}
    </StudioShell>
  );
}
