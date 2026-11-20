"use client";

import "leaflet/dist/leaflet.css";

import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { JobStatusBadge, JobTimeline } from "@/components/logistics/job-actions";
import { JOB_STATUS_LABELS } from "@/features/logistics/status";
import type { DeliveryJobStatus } from "@/generated/prisma/enums";

interface TrackingJob {
  id: string;
  jobNumber: string;
  status: DeliveryJobStatus;
  agentName: string | null;
  pickupName: string;
  pickupAddress: string;
  pickupLatitude: string;
  pickupLongitude: string;
  dropoffName: string;
  dropoffAddress: string;
  dropoffLatitude: string;
  dropoffLongitude: string;
  fee: string;
  currency: string;
  otpCode: string | null;
  assignedAt: string;
  latestLocation: {
    latitude: string;
    longitude: string;
    heading: string | null;
    recordedAt: string;
  } | null;
  history: { id: string; toStatus: DeliveryJobStatus; note: string | null; createdAt: string }[];
}

const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

function LiveMap({
  pickup,
  dropoff,
  courier,
}: {
  pickup: [number, number];
  dropoff: [number, number];
  courier: [number, number] | null;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const markersRef = useRef<Leaflet.LayerGroup | null>(null);
  const leafletRef = useRef<typeof Leaflet | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const pickupLat = pickup[0];
  const pickupLng = pickup[1];
  const dropoffLat = dropoff[0];
  const dropoffLng = dropoff[1];
  const courierLat = courier?.[0] ?? null;
  const courierLng = courier?.[1] ?? null;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const leaflet = await import("leaflet");
      if (cancelled || !containerRef.current || mapRef.current) return;
      leafletRef.current = leaflet;

      const map = leaflet.map(containerRef.current, {
        center: [pickupLat, pickupLng],
        zoom: 13,
        scrollWheelZoom: false,
      });
      leaflet.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 19 }).addTo(map);
      markersRef.current = leaflet.layerGroup().addTo(map);
      mapRef.current = map;
      setMapReady(true);
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current = null;
      leafletRef.current = null;
    };
    // The map is created once; coordinate updates are handled by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const leaflet = leafletRef.current;
    if (!mapReady || !leaflet || !mapRef.current || !markersRef.current) return;

    markersRef.current.clearLayers();
    const pickupPoint: [number, number] = [pickupLat, pickupLng];
    const dropoffPoint: [number, number] = [dropoffLat, dropoffLng];
    leaflet.marker(pickupPoint).addTo(markersRef.current).bindPopup("Pickup");
    leaflet.marker(dropoffPoint).addTo(markersRef.current).bindPopup("Drop-off");
    if (courierLat !== null && courierLng !== null) {
      leaflet
        .circleMarker([courierLat, courierLng], {
          radius: 9,
          color: "#f97316",
          fillColor: "#f97316",
          fillOpacity: 0.9,
        })
        .addTo(markersRef.current)
        .bindPopup("Courier (last reported)");
    }
    mapRef.current.fitBounds(leaflet.latLngBounds([pickupPoint, dropoffPoint]), {
      padding: [40, 40],
    });
  }, [mapReady, pickupLat, pickupLng, dropoffLat, dropoffLng, courierLat, courierLng]);

  return (
    <div
      ref={containerRef}
      className="h-80 w-full rounded-xl border border-border bg-surface-muted"
    />
  );
}

export function LiveTracking({ jobId }: { jobId: string }) {
  const [job, setJob] = useState<TrackingJob | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function poll() {
      try {
        const response = await fetch(`/api/delivery/jobs/${jobId}/track`, { cache: "no-store" });
        if (!response.ok) {
          if (active) setError("You cannot view this delivery.");
          return;
        }
        const data = (await response.json()) as TrackingJob;
        if (active) {
          setJob(data);
          setError(null);
        }
      } catch {
        if (active) setError("Could not reach the tracking service.");
      }
    }

    void poll();
    const timer = window.setInterval(poll, 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [jobId]);

  if (error) return <p className="text-sm text-danger">{error}</p>;
  if (!job) return <p className="text-sm text-muted-foreground">Connecting to live tracking…</p>;

  const pickup: [number, number] = [Number(job.pickupLatitude), Number(job.pickupLongitude)];
  const dropoff: [number, number] = [Number(job.dropoffLatitude), Number(job.dropoffLongitude)];
  const courier: [number, number] | null = job.latestLocation
    ? [Number(job.latestLocation.latitude), Number(job.latestLocation.longitude)]
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-sm font-medium">{job.jobNumber}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {job.pickupAddress} → {job.dropoffAddress}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Courier: {job.agentName ?? "Awaiting assignment"} · {job.fee} {job.currency}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <JobStatusBadge status={job.status} />
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              void fetch(`/api/delivery/jobs/${jobId}/track`, { cache: "no-store" })
                .then((r) => r.json())
                .then(setJob)
            }
          >
            Refresh now
          </Button>
        </div>
      </div>

      <LiveMap pickup={pickup} dropoff={dropoff} courier={courier} />

      {job.latestLocation ? (
        <p className="text-xs text-muted-foreground">
          Last reported position: {job.latestLocation.latitude}, {job.latestLocation.longitude} ·{" "}
          {new Date(job.latestLocation.recordedAt).toLocaleString()}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          No position reported yet. The courier&apos;s map position appears once they share it.
        </p>
      )}

      {job.otpCode ? (
        <div className="rounded-xl border border-accent/40 bg-surface p-4">
          <p className="text-sm font-medium">Hand-over code</p>
          <p className="mt-1 font-mono text-2xl tracking-widest">{job.otpCode}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Share this code with your courier only when they arrive.
          </p>
        </div>
      ) : null}

      <section aria-labelledby="tracking-timeline-heading" className="space-y-3">
        <h2 id="tracking-timeline-heading" className="text-lg font-medium">
          Delivery timeline
        </h2>
        <JobTimeline
          history={job.history.map((event) => ({
            ...event,
            createdAt: new Date(event.createdAt),
          }))}
        />
        {job.status !== "DELIVERED" && job.status !== "CANCELLED" ? (
          <p className="text-xs text-muted-foreground">
            Current stage: {JOB_STATUS_LABELS[job.status]}
          </p>
        ) : null}
      </section>

      <div className="flex flex-wrap gap-2">
        <Badge tone="neutral">Live polling every 5 seconds</Badge>
      </div>
    </div>
  );
}
