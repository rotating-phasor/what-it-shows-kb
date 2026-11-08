// The problems inside a big ticket, one per fix. causes.ts tells `parser` from `hint` by tenant;
// this file adds the reports the desk read as a one-day move (desk-notes.json). Those are not a
// flipped date at all: the day moves by one, so they are a third problem with a fix of their own.
// Counted the desk's way: a one-day report stays counted where it is filed (by tenant) and is
// counted again under `shift`.
import { causeOf, uniqueById, type Report, type Tenant } from '#lib/kb/causes';

export type Problem = 'parser' | 'hint' | 'shift' | 'unplaced';

export const PROBLEMS: Record<Problem, { title: string; symptom: string }> = {
  parser: {
    title: 'Shared parser reads every date month first',
    symptom: 'Day and month swap: 7 April comes out as 4 July.',
  },
  hint: {
    title: 'booking-v3 form hints MM/DD to day-first tenants',
    symptom: 'People type month first, as the hint says; the form reads it day first.',
  },
  shift: {
    title: 'Invite date moves by one day',
    symptom: 'No swap. The day moves by one, and the result depends on where the reader is.',
  },
  unplaced: {
    title: 'No tenant on file, or not a day-first tenant',
    symptom: 'The desk cannot place it.',
  },
};

// Every problem a report counts toward: where it is filed, and `shift` if the desk read it as a one-day move.
export function problemsOf(r: Report, t: Tenant | undefined, shiftIds: readonly string[]): Problem[] {
  const filed: Problem = causeOf(r, t) ?? 'unplaced';
  return shiftIds.includes(r.id) ? [filed, 'shift'] : [filed];
}

export type ProblemGroup = {
  problem: Problem;
  reports: Report[];
  tenants: string[];
  channels: Record<string, number>;
  taggedAs: Record<string, number>;
  firstSeen: string;
  lastSeen: string;
};

const tally = (xs: string[]) => xs.reduce<Record<string, number>>((n, x) => ({ ...n, [x]: (n[x] ?? 0) + 1 }), {});

// One id, one report; only reports merged into `ticket`; grouped by problem, biggest first.
export function splitTicket(
  all: Report[],
  ticket: number,
  tenantOf: (r: Report) => Tenant | undefined,
  shiftIds: readonly string[],
): { rows: number; reports: Report[]; groups: ProblemGroup[] } {
  const reports = uniqueById(all).filter((r) => r.mergedInto === ticket);
  const by = new Map<Problem, Report[]>();
  for (const r of reports) {
    for (const p of problemsOf(r, tenantOf(r), shiftIds)) by.set(p, [...(by.get(p) ?? []), r]);
  }
  const groups = [...by.entries()]
    .map(([problem, rs]) => {
      const days = rs.map((r) => r.receivedAt.slice(0, 10)).sort();
      return {
        problem,
        reports: rs,
        tenants: [...new Set(rs.map((r) => r.tenant))].sort(),
        channels: tally(rs.map((r) => r.channel)),
        taggedAs: tally(rs.map((r) => r.meta.intakeTag)),
        firstSeen: days[0],
        lastSeen: days[days.length - 1],
      };
    })
    .sort((a, b) => b.reports.length - a.reports.length);
  return { rows: all.length, reports, groups };
}

// Decision 0001 merges on the subject line. A subject that several problems share cannot keep them apart.
export function subjectsAcross(groups: ProblemGroup[]): { subject: string; problems: Problem[] }[] {
  const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, '').trim();
  const by = new Map<string, Set<Problem>>();
  for (const g of groups) for (const r of g.reports) by.set(norm(r.subject), (by.get(norm(r.subject)) ?? new Set()).add(g.problem));
  return [...by.entries()].map(([subject, ps]) => ({ subject, problems: [...ps].sort() })).sort((a, b) => b.problems.length - a.problems.length || a.subject.localeCompare(b.subject));
}
