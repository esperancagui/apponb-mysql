import { api } from "../api";
import type { BillingSubscription, Invoice } from "../types";

export const billingService = {
  async getSubscription(): Promise<BillingSubscription> {
    const { data, error } = await api.get<BillingSubscription>("/api/billing/subscription");
    if (error) throw new Error(error);
    return data;
  },

  async createCheckoutSession(plan: "basic" | "premium"): Promise<void> {
    const { data, error } = await api.post<{ url: string }>("/api/billing/checkout", { plan });
    if (error) throw new Error(error);
    window.location.href = data.url;
  },

  async createPortalSession(): Promise<void> {
    const { data, error } = await api.post<{ url: string }>("/api/billing/portal");
    if (error) throw new Error(error);
    window.location.href = data.url;
  },

  async getInvoices(): Promise<Invoice[]> {
    const { data, error } = await api.get<Invoice[]>("/api/billing/invoices");
    if (error) throw new Error(error);
    return data ?? [];
  },
};
