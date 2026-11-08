<script lang="ts">
  import reports from '#lib/data/reports-4471.json';
  import notes from '#lib/data/desk-notes.json';
  import type { Report } from '#lib/kb/causes';
  import { tenantOf } from '#lib/kb/locales';
  import { PROBLEMS, splitTicket, subjectsAcross, type Problem } from '#lib/kb/problems';

  // issues: where each problem is tracked now, e.g. { parser: 'https://github.com/…/issues/1' }.
  let { ticket, issues = {} }: { ticket: number; issues?: Partial<Record<Problem, string>> } = $props();

  const split = $derived(splitTicket(reports as Report[], ticket, tenantOf, notes.oneDayMove));
  const subjects = $derived(subjectsAcross(split.groups));
  const shared = $derived(subjects.filter((s) => s.problems.length > 1));
  // Intake tags only know `parser` and `hint`; count a report as mistagged when its tag is not its problem.
  const mistagged = $derived(split.groups.flatMap((g) => g.reports.filter((r) => r.meta.intakeTag !== g.problem)).length);
  const list = (n: Record<string, number>) =>
    Object.entries(n)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k} ×${v}`)
      .join(' · ');
</script>

<p class="sum">
  <strong>{split.reports.length}</strong> reports merged into #{ticket}
  ({split.rows} rows in the export, {split.rows - split.reports.length} of them repeats) ·
  <strong>{split.groups.length}</strong> {split.groups.length === 1 ? 'problem' : 'problems'}
</p>

<table>
  <thead>
    <tr><th>problem</th><th>reports</th><th>tenants</th><th>came in by</th><th>intake tagged</th><th>seen</th><th>ticket</th></tr>
  </thead>
  <tbody>
    {#each split.groups as g (g.problem)}
      <tr>
        <td><code>{g.problem}</code><br /><span class="what">{PROBLEMS[g.problem].title}</span></td>
        <td class="n">{g.reports.length}</td>
        <td class="n" title={g.tenants.join(', ')}>{g.tenants.length}</td>
        <td class="tags">{list(g.channels)}</td>
        <td class="tags">{list(g.taggedAs)}</td>
        <td class="tags">{g.firstSeen} → {g.lastSeen}</td>
        <td>{#if issues[g.problem]}<a href={issues[g.problem]}>{issues[g.problem]?.replace(/^.*\/issues\//, '#')}</a>{:else}<span class="none">none yet</span>{/if}</td>
      </tr>
    {/each}
  </tbody>
</table>

<p class="note">
  {mistagged} of {split.reports.length} reports carry an intake tag that is not their problem. Intake tags
  come from the reporter's browser; the problem comes from the tenant, its form and the channel.
</p>
<p class="note">
  {shared.length} of {subjects.length} subject lines occur in more than one problem, so a subject match
  (decision 0001) could not have kept them apart.
</p>

<style>
  .sum { font-size: 1.1rem; }
  .what { color: var(--muted); font-size: 0.85em; }
  .n { font-variant-numeric: tabular-nums; }
  .tags { color: var(--muted); font-size: 0.85em; }
  .note { color: var(--muted); font-size: 0.85em; }
  .none { color: var(--warn); }
</style>
