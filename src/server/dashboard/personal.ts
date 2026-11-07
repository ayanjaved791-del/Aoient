import "server-only";
import { can, type OrgContext } from "@/server/tenancy/context";
import { getEmployee, getMyEmployeeId, type EmployeeDetail } from "@/server/people/employees";
import { listLeave, type LeaveRow, type LeaveType } from "@/server/people/leave";

export interface PersonalDashboard {
  /** The viewer's own People record, if one is linked to their membership. */
  me: Pick<EmployeeDetail, "id" | "fullName" | "jobTitle" | "department" | "manager" | "startDate" | "location" | "employmentType" | "onLeaveToday" | "reports"> | null;
  leave: {
    canRequest: boolean;
    pending: LeaveRow[];
    /** Approved leave that hasn't ended yet, soonest first. */
    upcoming: LeaveRow[];
    /** Approved leave days starting this calendar year, by type. */
    takenThisYear: { type: LeaveType; days: number }[];
    takenTotal: number;
  };
}

/** Today's date (YYYY-MM-DD) in the organization's time zone. */
function today(tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/**
 * The viewer's own information only: their profile and their leave. Never
 * reads anyone else's records, so every role (including custom ones) can see it.
 */
export async function getPersonalDashboard(ctx: OrgContext): Promise<PersonalDashboard> {
  const canRequest = can(ctx, "people.leave.request");
  const id = await getMyEmployeeId(ctx);
  const [emp, mine] = await Promise.all([id ? getEmployee(ctx, id) : null, id && canRequest ? listLeave(ctx, { scope: "mine" }) : []]);
  const now = today(ctx.organization.timezone);
  const year = now.slice(0, 4);
  const approved = mine.filter((l) => l.status === "approved");
  const byType = new Map<LeaveType, number>();
  for (const l of approved) if (l.startDate.startsWith(year)) byType.set(l.type, (byType.get(l.type) ?? 0) + l.days);
  const takenThisYear = [...byType].map(([type, days]) => ({ type, days })).sort((a, b) => b.days - a.days);
  return {
    me: emp && {
      id: emp.id, fullName: emp.fullName, jobTitle: emp.jobTitle, department: emp.department, manager: emp.manager, startDate: emp.startDate,
      location: emp.location, employmentType: emp.employmentType, onLeaveToday: emp.onLeaveToday, reports: emp.reports,
    },
    leave: {
      canRequest: canRequest && Boolean(id),
      pending: mine.filter((l) => l.status === "pending"),
      upcoming: approved.filter((l) => l.endDate >= now).sort((a, b) => a.startDate.localeCompare(b.startDate)).slice(0, 5),
      takenThisYear,
      takenTotal: takenThisYear.reduce((s, t) => s + t.days, 0),
    },
  };
}
