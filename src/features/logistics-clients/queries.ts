import "server-only";

import type { ClientRelationshipStatus, LogisticsClientStatus } from "@/generated/prisma/enums";
import { getDatabase } from "@/server/db/client";

export interface ClientView {
  id: string;
  clientNumber: string;
  name: string;
  businessName: string;
  phone: string;
  email: string;
  city: string;
  status: LogisticsClientStatus;
  relationshipStatus: ClientRelationshipStatus | null;
  accountCode: string | null;
  contactCount: number;
  createdAt: string;
}

export interface ClientContactView {
  id: string;
  name: string;
  role: string;
  phone: string;
  email: string;
  isPrimary: boolean;
}

export interface ClientDetailView extends ClientView {
  address: string;
  latitude: string | null;
  longitude: string | null;
  serviceNotes: string;
  verifiedAt: string | null;
  contacts: ClientContactView[];
  companyCount: number;
}

export async function listCompanyClients(companyId: string): Promise<ClientView[]> {
  const rows = await getDatabase().companyClientRelationship.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    select: {
      status: true,
      accountCode: true,
      client: {
        select: {
          id: true,
          clientNumber: true,
          name: true,
          businessName: true,
          phone: true,
          email: true,
          city: true,
          status: true,
          createdAt: true,
          _count: { select: { contacts: true } },
        },
      },
    },
  });
  return rows.map((row) => ({
    id: row.client.id,
    clientNumber: row.client.clientNumber,
    name: row.client.name,
    businessName: row.client.businessName ?? "",
    phone: row.client.phone ?? "",
    email: row.client.email ?? "",
    city: row.client.city ?? "",
    status: row.client.status,
    relationshipStatus: row.status,
    accountCode: row.accountCode,
    contactCount: row.client._count.contacts,
    createdAt: row.client.createdAt.toISOString(),
  }));
}

export async function getClientDetail(
  clientId: string,
  companyId: string,
): Promise<ClientDetailView | null> {
  const database = getDatabase();
  const relationship = await database.companyClientRelationship.findUnique({
    where: { companyId_clientId: { companyId, clientId } },
    select: {
      status: true,
      accountCode: true,
      serviceNotes: true,
      verifiedAt: true,
    },
  });
  if (!relationship) return null;

  const [client, contacts, companyCount] = await Promise.all([
    database.logisticsClient.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        clientNumber: true,
        name: true,
        businessName: true,
        phone: true,
        email: true,
        address: true,
        city: true,
        latitude: true,
        longitude: true,
        status: true,
        createdAt: true,
        verifiedAt: true,
      },
    }),
    database.clientContact.findMany({
      where: { clientId },
      orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
    }),
    database.companyClientRelationship.count({ where: { clientId } }),
  ]);
  if (!client) return null;

  return {
    id: client.id,
    clientNumber: client.clientNumber,
    name: client.name,
    businessName: client.businessName ?? "",
    phone: client.phone ?? "",
    email: client.email ?? "",
    address: client.address ?? "",
    city: client.city ?? "",
    latitude: client.latitude?.toString() ?? null,
    longitude: client.longitude?.toString() ?? null,
    status: client.status,
    relationshipStatus: relationship.status,
    accountCode: relationship.accountCode,
    contactCount: contacts.length,
    createdAt: client.createdAt.toISOString(),
    serviceNotes: relationship.serviceNotes ?? "",
    verifiedAt: client.verifiedAt?.toISOString() ?? null,
    companyCount,
    contacts: contacts.map((contact) => ({
      id: contact.id,
      name: contact.name,
      role: contact.role ?? "",
      phone: contact.phone ?? "",
      email: contact.email ?? "",
      isPrimary: contact.isPrimary,
    })),
  };
}
