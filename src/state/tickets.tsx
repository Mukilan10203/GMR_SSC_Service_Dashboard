"use client";

import { useCallback, useEffect, useState } from "react";
import type { Issue, Priority, ServiceId } from "@/lib/domain/types";
import { DEMO_AS_OF } from "@/lib/mock/calendar";

/**
 * Customer-raised tickets. Stored in localStorage per entity so a raised
 * ticket survives reloads and sits alongside the illustrative issue
 * register. In production this becomes the service-management system's
 * ticket API; the shape is already `Issue`, so nothing downstream changes.
 */

const SLA_TARGET_BY_PRIORITY: Record<Priority, number> = {
  critical: 2,
  high: 5,
  medium: 10,
  low: 30,
};

export interface RaiseTicketInput {
  serviceId: ServiceId;
  subServiceName?: string;
  priority: Priority;
  title: string;
  description: string;
  raisedBy: string;
}

const storageKey = (entityId: string) => `ssc-tickets-${entityId}`;

function load(entityId: string): Issue[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(storageKey(entityId)) ?? "[]");
  } catch {
    return [];
  }
}

export const isCustomerTicket = (issue: Issue) => issue.id.startsWith("ticket-");

export function useTickets(entityId: string) {
  const [tickets, setTickets] = useState<Issue[]>([]);

  useEffect(() => {
    setTickets(load(entityId));
  }, [entityId]);

  const raiseTicket = useCallback(
    (input: RaiseTicketInput): Issue => {
      const seq = load(entityId).length + 1;
      const ticket: Issue = {
        id: `ticket-${Date.now()}`,
        ref: `SSC-CR-${String(seq).padStart(3, "0")}`,
        title: input.title,
        description: input.description,
        serviceId: input.serviceId,
        entityId,
        priority: input.priority,
        status: "open",
        category: input.subServiceName ? `Customer raised · ${input.subServiceName}` : "Customer raised",
        openedOn: DEMO_AS_OF,
        agingDays: 0,
        slaTargetDays: SLA_TARGET_BY_PRIORITY[input.priority],
        owner: "SSC Service Desk",
        ownerTeam: "GMR SSC — Service Desk",
        impact: `Raised by ${input.raisedBy} via the customer portal.`,
        timeline: [
          { on: DEMO_AS_OF, note: "Ticket raised via the customer portal.", by: input.raisedBy },
          {
            on: DEMO_AS_OF,
            note: "Acknowledged by the SSC Service Desk and queued for triage.",
            by: "SSC Service Desk",
          },
        ],
      };
      setTickets((prev) => {
        const next = [ticket, ...prev];
        window.localStorage.setItem(storageKey(entityId), JSON.stringify(next));
        return next;
      });
      return ticket;
    },
    [entityId],
  );

  return { tickets, raiseTicket };
}
