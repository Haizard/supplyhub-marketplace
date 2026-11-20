"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { firstFieldErrors, formValue, type FormState } from "@/features/identity/form-state";
import { logger } from "@/lib/logging/logger";
import { getSessionActor } from "@/server/auth/session";
import { getDatabase } from "@/server/db/client";

import { MAX_CART_QUANTITY } from "./constants";
import { findCurrentCart, getOrCreateCartForMutation, touchCart } from "./service";
import { cartItemIdSchema, cartLineMutationSchema, cartMutationSchema } from "./validation";

function revalidateCart(): void {
  revalidatePath("/", "layout");
}

async function rejectInactiveActor(): Promise<FormState | null> {
  const actor = await getSessionActor();

  if (actor && actor.status !== "ACTIVE") {
    return { status: "error", message: "This account cannot use the cart." };
  }

  return null;
}

export async function addToCartAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const inactive = await rejectInactiveActor();

  if (inactive) {
    return inactive;
  }

  const parsed = cartMutationSchema.safeParse({
    productId: formValue(formData, "productId"),
    variantId: formValue(formData, "variantId"),
    quantity: formValue(formData, "quantity"),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: firstFieldErrors(parsed.error) };
  }

  const database = getDatabase();
  const product = await database.product.findFirst({
    where: {
      id: parsed.data.productId,
      status: "PUBLISHED",
      vendor: { status: "APPROVED" },
      category: { status: "ACTIVE" },
    },
    select: {
      id: true,
      stock: true,
      variants: { where: { isActive: true }, select: { id: true, stock: true } },
    },
  });

  if (!product) {
    return { status: "error", message: "That object is no longer available." };
  }

  if (product.variants.length > 0 && !parsed.data.variantId) {
    return { status: "error", message: "Choose an option for this object." };
  }

  const variant = parsed.data.variantId
    ? product.variants.find((entry) => entry.id === parsed.data.variantId)
    : null;

  if (parsed.data.variantId && !variant) {
    return { status: "error", message: "That option is no longer available." };
  }

  const availableStock = variant ? variant.stock : product.stock;

  if (availableStock <= 0) {
    return { status: "error", message: "That object is sold out." };
  }

  const { cartId } = await getOrCreateCartForMutation();
  const existing = await database.cartItem.findFirst({
    where: {
      cartId,
      productId: product.id,
      variantId: variant?.id ?? null,
    },
    select: { quantity: true },
  });

  if ((existing?.quantity ?? 0) + parsed.data.quantity > availableStock) {
    return {
      status: "error",
      message:
        availableStock === 1
          ? "Only one of that object is available."
          : `Only ${availableStock} of that object are available.`,
    };
  }

  if (variant) {
    await database.$executeRaw`
      INSERT INTO "cart_items" ("id", "cart_id", "product_id", "variant_id", "quantity", "created_at", "updated_at")
      VALUES (${randomUUID()}::uuid, ${cartId}::uuid, ${product.id}::uuid, ${variant.id}::uuid, ${parsed.data.quantity}, now(), now())
      ON CONFLICT ("cart_id", "product_id", "variant_id")
      DO UPDATE SET
        "quantity" = LEAST(
          "cart_items"."quantity" + EXCLUDED."quantity",
          ${MAX_CART_QUANTITY},
          ${availableStock}
        ),
        "updated_at" = now()
    `;
  } else {
    await database.$executeRaw`
      INSERT INTO "cart_items" ("id", "cart_id", "product_id", "quantity", "created_at", "updated_at")
      VALUES (${randomUUID()}::uuid, ${cartId}::uuid, ${product.id}::uuid, ${parsed.data.quantity}, now(), now())
      ON CONFLICT ("cart_id", "product_id") WHERE "variant_id" IS NULL
      DO UPDATE SET
        "quantity" = LEAST(
          "cart_items"."quantity" + EXCLUDED."quantity",
          ${MAX_CART_QUANTITY},
          ${availableStock}
        ),
        "updated_at" = now()
    `;
  }
  await touchCart(cartId);

  logger.info("cart.item_added", {
    productId: product.id,
    variantId: variant?.id ?? null,
    quantity: parsed.data.quantity,
  });
  revalidateCart();

  return { status: "success", message: "Added to your cart." };
}

export async function updateCartLineAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const inactive = await rejectInactiveActor();

  if (inactive) {
    return inactive;
  }

  const parsed = cartLineMutationSchema.safeParse({
    cartItemId: formValue(formData, "cartItemId"),
    quantity: formValue(formData, "quantity"),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: firstFieldErrors(parsed.error) };
  }

  const cart = await findCurrentCart();

  if (!cart) {
    return { status: "error", message: "That object is no longer in your cart." };
  }

  const database = getDatabase();
  const line = await database.cartItem.findFirst({
    where: { id: parsed.data.cartItemId, cartId: cart.id },
    select: {
      id: true,
      product: { select: { name: true, stock: true } },
      variant: { select: { stock: true } },
    },
  });

  if (!line) {
    return { status: "error", message: "That object is no longer in your cart." };
  }

  const availableStock = line.variant ? line.variant.stock : line.product.stock;

  if (parsed.data.quantity > availableStock) {
    return {
      status: "error",
      message:
        availableStock === 0
          ? `${line.product.name} is sold out.`
          : `Only ${availableStock} of ${line.product.name} are available.`,
    };
  }

  await database.cartItem.update({
    where: { id: line.id },
    data: { quantity: parsed.data.quantity },
  });
  await touchCart(cart.id);

  revalidateCart();
  return { status: "success", message: "Quantity updated." };
}

export async function removeCartLineAction(formData: FormData): Promise<void> {
  if (await rejectInactiveActor()) {
    redirect("/cart?inactive=1");
  }

  const cartItemId = cartItemIdSchema.safeParse(formValue(formData, "cartItemId"));

  if (!cartItemId.success) {
    redirect("/cart");
  }

  const cart = await findCurrentCart();

  if (cart) {
    await getDatabase().cartItem.deleteMany({
      where: { id: cartItemId.data, cartId: cart.id },
    });
    await touchCart(cart.id);
  }

  revalidateCart();
  redirect("/cart?removed=1");
}

export async function clearCartAction(): Promise<void> {
  if (await rejectInactiveActor()) {
    redirect("/cart?inactive=1");
  }

  const cart = await findCurrentCart();

  if (cart) {
    await getDatabase().cartItem.deleteMany({ where: { cartId: cart.id } });
    await touchCart(cart.id);
  }

  revalidateCart();
  redirect("/cart?cleared=1");
}
