"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { initialFormState } from "@/features/identity/form-state";
import {
  createBuyerRequestAction,
  createFarmerProfileAction,
  decideOfferAction,
  saveFarmAction,
  saveListingAction,
  savePlotAction,
  submitOfferAction,
  verifyFarmerAction,
} from "@/features/agriculture/actions";

function Feedback({ message, error }: { message?: string; error?: boolean }) {
  if (!message) return null;
  return <p className={error ? "text-xs text-danger" : "text-xs text-success"}>{message}</p>;
}

export function FarmerProfileForm() {
  const [state, action, pending] = useActionState(createFarmerProfileAction, initialFormState);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <Field label="Phone" htmlFor="farmerPhone" error={state.fieldErrors?.phone}>
        <Input id="farmerPhone" name="phone" />
      </Field>
      <Field label="Region" htmlFor="farmerRegion" error={state.fieldErrors?.region}>
        <Input id="farmerRegion" name="region" />
      </Field>
      <Field label="District" htmlFor="farmerDistrict" error={state.fieldErrors?.district}>
        <Input id="farmerDistrict" name="district" />
      </Field>
      <Field label="Ward" htmlFor="farmerWard" error={state.fieldErrors?.ward}>
        <Input id="farmerWard" name="ward" />
      </Field>
      <Field label="Village" htmlFor="farmerVillage" error={state.fieldErrors?.village}>
        <Input id="farmerVillage" name="village" />
      </Field>
      <div className="flex items-end">
        <Button type="submit" variant="accent" disabled={pending}>
          Save profile
        </Button>
      </div>
      <Feedback message={state.message} error={state.status === "error"} />
    </form>
  );
}

export function FarmForm() {
  const [state, action, pending] = useActionState(saveFarmAction, initialFormState);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <Field label="Farm name" htmlFor="farmName" error={state.fieldErrors?.name}>
        <Input id="farmName" name="name" required />
      </Field>
      <Field label="Size" htmlFor="farmSize" error={state.fieldErrors?.sizeValue}>
        <Input id="farmSize" name="sizeValue" type="number" min="0" step="0.01" required />
      </Field>
      <Field label="Size unit" htmlFor="farmSizeUnit" error={state.fieldErrors?.sizeUnit}>
        <Select id="farmSizeUnit" name="sizeUnit" defaultValue="ACRE">
          <option value="ACRE">Acres</option>
          <option value="HECTARE">Hectares</option>
        </Select>
      </Field>
      <Field label="Ownership" htmlFor="farmOwnership" error={state.fieldErrors?.ownership}>
        <Select id="farmOwnership" name="ownership" defaultValue="OWNED">
          <option value="OWNED">Owned</option>
          <option value="LEASED">Leased</option>
        </Select>
      </Field>
      <Field label="Region" htmlFor="farmRegion" error={state.fieldErrors?.region}>
        <Input id="farmRegion" name="region" />
      </Field>
      <Field label="Water source" htmlFor="farmWater" error={state.fieldErrors?.waterSource}>
        <Input id="farmWater" name="waterSource" />
      </Field>
      <div className="flex items-end">
        <Button type="submit" variant="secondary" disabled={pending}>
          Add farm
        </Button>
      </div>
      <Feedback message={state.message} error={state.status === "error"} />
    </form>
  );
}

export function PlotForm({ farms }: { farms: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(savePlotAction, initialFormState);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <Field label="Farm" htmlFor="plotFarm" error={state.fieldErrors?.farmId}>
        <Select id="plotFarm" name="farmId" required>
          {farms.map((farm) => (
            <option key={farm.id} value={farm.id}>
              {farm.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Plot name" htmlFor="plotName" error={state.fieldErrors?.name}>
        <Input id="plotName" name="name" required />
      </Field>
      <Field label="Size" htmlFor="plotSize" error={state.fieldErrors?.sizeValue}>
        <Input id="plotSize" name="sizeValue" type="number" min="0" step="0.01" required />
      </Field>
      <Field label="Size unit" htmlFor="plotUnit" error={state.fieldErrors?.sizeUnit}>
        <Select id="plotUnit" name="sizeUnit" defaultValue="ACRE">
          <option value="ACRE">Acres</option>
          <option value="HECTARE">Hectares</option>
        </Select>
      </Field>
      <div className="flex items-end">
        <Button type="submit" size="sm" variant="secondary" disabled={pending}>
          Add plot
        </Button>
      </div>
      <Feedback message={state.message} error={state.status === "error"} />
    </form>
  );
}

export function ListingForm({
  farms,
  plots,
}: {
  farms: { id: string; name: string }[];
  plots: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(saveListingAction, initialFormState);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <Field label="Farm" htmlFor="listingFarm">
        <Select id="listingFarm" name="farmId">
          <option value="">No farm</option>
          {farms.map((farm) => (
            <option key={farm.id} value={farm.id}>
              {farm.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Plot" htmlFor="listingPlot">
        <Select id="listingPlot" name="plotId">
          <option value="">No plot</option>
          {plots.map((plot) => (
            <option key={plot.id} value={plot.id}>
              {plot.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Buyer user ID (optional)" htmlFor="listingBuyer">
        <Input id="listingBuyer" name="buyerUserId" placeholder="UUID" />
      </Field>
      <Field label="Crop" htmlFor="listingCrop" error={state.fieldErrors?.cropName}>
        <Input id="listingCrop" name="cropName" required />
      </Field>
      <Field label="Variety" htmlFor="listingVariety">
        <Input id="listingVariety" name="variety" />
      </Field>
      <Field label="Quantity" htmlFor="listingQty" error={state.fieldErrors?.quantity}>
        <Input id="listingQty" name="quantity" type="number" min="0" step="0.01" required />
      </Field>
      <Field label="Unit" htmlFor="listingUnit" error={state.fieldErrors?.unit}>
        <Select id="listingUnit" name="unit" defaultValue="KG">
          <option value="KG">kg</option>
          <option value="BAG">bag</option>
          <option value="TONNE">tonne</option>
          <option value="CRATE">crate</option>
          <option value="LITRE">litre</option>
          <option value="PIECE">piece</option>
        </Select>
      </Field>
      <Field label="Price per unit" htmlFor="listingPrice" error={state.fieldErrors?.pricePerUnit}>
        <Input id="listingPrice" name="pricePerUnit" type="number" min="0" step="0.01" required />
      </Field>
      <Field label="Currency" htmlFor="listingCurrency" error={state.fieldErrors?.currency}>
        <Input id="listingCurrency" name="currency" defaultValue="TZS" maxLength={3} required />
      </Field>
      <Field label="Minimum order" htmlFor="listingMin" error={state.fieldErrors?.minimumOrder}>
        <Input id="listingMin" name="minimumOrder" type="number" min="0" step="0.01" required />
      </Field>
      <Field label="Grade" htmlFor="listingGrade">
        <Input id="listingGrade" name="grade" />
      </Field>
      <Field label="Harvest date" htmlFor="listingHarvest" error={state.fieldErrors?.harvestDate}>
        <Input id="listingHarvest" name="harvestDate" type="date" />
      </Field>
      <Field
        label="Collection location"
        htmlFor="listingLocation"
        error={state.fieldErrors?.collectionLocation}
      >
        <Input id="listingLocation" name="collectionLocation" required />
      </Field>
      <Field
        label="Cover image path (optional)"
        htmlFor="listingCover"
        error={state.fieldErrors?.coverImageUrl}
      >
        <Input
          id="listingCover"
          name="coverImageUrl"
          placeholder="/images/marketplace/avocado.jpg"
        />
      </Field>
      <fieldset className="space-y-1 sm:col-span-full">
        <legend className="text-sm font-medium">Claims and delivery</legend>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" name="deliveryAvailable" value="true" className="size-4" />{" "}
          Delivery available
        </label>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" name="organicClaim" value="true" className="size-4" /> Organic
          claim (self-declared)
        </label>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" name="certifiedClaim" value="true" className="size-4" /> Certified
          claim (unverified)
        </label>
      </fieldset>
      <div className="flex items-end sm:col-span-full">
        <Button type="submit" variant="accent" disabled={pending}>
          Publish listing
        </Button>
      </div>
      <Feedback message={state.message} error={state.status === "error"} />
    </form>
  );
}

export function BuyerRequestForm() {
  const [state, action, pending] = useActionState(createBuyerRequestAction, initialFormState);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <Field label="Product" htmlFor="requestProduct" error={state.fieldErrors?.productName}>
        <Input id="requestProduct" name="productName" required />
      </Field>
      <Field label="Quantity" htmlFor="requestQty" error={state.fieldErrors?.quantity}>
        <Input id="requestQty" name="quantity" type="number" min="0" step="0.01" required />
      </Field>
      <Field label="Unit" htmlFor="requestUnit" error={state.fieldErrors?.unit}>
        <Select id="requestUnit" name="unit" defaultValue="KG">
          <option value="KG">kg</option>
          <option value="BAG">bag</option>
          <option value="TONNE">tonne</option>
          <option value="CRATE">crate</option>
          <option value="LITRE">litre</option>
          <option value="PIECE">piece</option>
        </Select>
      </Field>
      <Field
        label="Delivery location"
        htmlFor="requestLocation"
        error={state.fieldErrors?.deliveryLocation}
      >
        <Input id="requestLocation" name="deliveryLocation" required />
      </Field>
      <Field
        label="Delivery deadline"
        htmlFor="requestDelivery"
        error={state.fieldErrors?.deliveryDeadline}
      >
        <Input id="requestDelivery" name="deliveryDeadline" type="date" required />
      </Field>
      <Field label="Offer deadline" htmlFor="requestOffer" error={state.fieldErrors?.offerDeadline}>
        <Input id="requestOffer" name="offerDeadline" type="date" required />
      </Field>
      <Field
        label="Quality specification"
        htmlFor="requestQuality"
        error={state.fieldErrors?.qualitySpec}
      >
        <Input id="requestQuality" name="qualitySpec" />
      </Field>
      <div className="flex items-end">
        <Button type="submit" variant="accent" disabled={pending}>
          Publish request
        </Button>
      </div>
      <Feedback message={state.message} error={state.status === "error"} />
    </form>
  );
}

export function OfferForm({
  listings,
  requests,
}: {
  listings: { id: string; cropName: string }[];
  requests: { id: string; productName: string }[];
}) {
  const [state, action, pending] = useActionState(submitOfferAction, initialFormState);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <Field label="Listing" htmlFor="offerListing" error={state.fieldErrors?.listingId}>
        <Select id="offerListing" name="listingId" required>
          {listings.map((listing) => (
            <option key={listing.id} value={listing.id}>
              {listing.cropName}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Buyer request" htmlFor="offerRequest">
        <Select id="offerRequest" name="requestId">
          <option value="">Direct offer</option>
          {requests.map((request) => (
            <option key={request.id} value={request.id}>
              {request.productName}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Quantity" htmlFor="offerQty" error={state.fieldErrors?.quantity}>
        <Input id="offerQty" name="quantity" type="number" min="0" step="0.01" required />
      </Field>
      <Field label="Unit" htmlFor="offerUnit" error={state.fieldErrors?.unit}>
        <Select id="offerUnit" name="unit" defaultValue="KG">
          <option value="KG">kg</option>
          <option value="BAG">bag</option>
          <option value="TONNE">tonne</option>
          <option value="CRATE">crate</option>
          <option value="LITRE">litre</option>
          <option value="PIECE">piece</option>
        </Select>
      </Field>
      <Field label="Price per unit" htmlFor="offerPrice" error={state.fieldErrors?.pricePerUnit}>
        <Input id="offerPrice" name="pricePerUnit" type="number" min="0" step="0.01" required />
      </Field>
      <Field label="Currency" htmlFor="offerCurrency" error={state.fieldErrors?.currency}>
        <Input id="offerCurrency" name="currency" defaultValue="TZS" maxLength={3} required />
      </Field>
      <Field label="Note" htmlFor="offerNote">
        <Input id="offerNote" name="note" />
      </Field>
      <div className="flex items-end sm:col-span-full">
        <Button type="submit" variant="secondary" disabled={pending}>
          Submit offer
        </Button>
      </div>
      <Feedback message={state.message} error={state.status === "error"} />
    </form>
  );
}

export function DecideOfferForm({ offerId }: { offerId: string }) {
  const [state, action, pending] = useActionState(decideOfferAction, initialFormState);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="offerId" value={offerId} />
      <Input name="phone" placeholder="Phone for payment" className="h-9 w-40" />
      <Button
        type="submit"
        name="decision"
        value="ACCEPT"
        size="sm"
        variant="accent"
        disabled={pending}
      >
        Accept
      </Button>
      <Button
        type="submit"
        name="decision"
        value="REJECT"
        size="sm"
        variant="ghost"
        disabled={pending}
      >
        Reject
      </Button>
      <Feedback message={state.message} error={state.status === "error"} />
    </form>
  );
}

export function VerifyFarmerForm({ farmerId }: { farmerId: string }) {
  const [state, action, pending] = useActionState(verifyFarmerAction, initialFormState);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="farmerId" value={farmerId} />
      <Input name="note" placeholder="Review note" className="h-9 w-40" />
      <Button
        type="submit"
        name="decision"
        value="VERIFY"
        size="sm"
        variant="accent"
        disabled={pending}
      >
        Verify
      </Button>
      <Button
        type="submit"
        name="decision"
        value="REJECT"
        size="sm"
        variant="ghost"
        disabled={pending}
      >
        Reject
      </Button>
      <Feedback message={state.message} error={state.status === "error"} />
    </form>
  );
}
