import { api } from "../lib/api";

/**
 * DA view of registered accounts.
 * Endpoint: GET /api/v1/officer/accounts (role: OFFICER | TECHNICIAN)
 * Accounts with no activity for `inactivityMonths` are marked inactive
 * automatically; they become active again when the owner signs back in.
 */
export type AccountStatusFilter = "all" | "active" | "inactive";

export interface AccountRow {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: "FARMER" | "TECHNICIAN" | "OFFICER";
  isActive: boolean;
  lastActiveAt: string;
  createdAt: string;
  rsbsaNumber: string | null;
  farmCount: number;
  municipality: string | null;
  barangay: string | null;
}

export interface AccountsResponse {
  accounts: AccountRow[];
  counts: { all: number; active: number; inactive: number };
  pagination: { page: number; pageSize: number; total: number };
  inactivityMonths: number;
}

export interface AccountsQuery {
  status?: AccountStatusFilter;
  search?: string;
  page?: number;
  pageSize?: number;
}

export const getAccounts = async (
  params: AccountsQuery = {},
): Promise<AccountsResponse> => {
  const { data } = await api.get<{ data: AccountsResponse }>(
    "/officer/accounts",
    { params: { role: "farmer", ...params } },
  );
  return data.data;
};
