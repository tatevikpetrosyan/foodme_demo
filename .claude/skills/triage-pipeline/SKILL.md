---
name: triage-pipeline
description: Use when asked to triage a problem from a Jira ticket (/triage-pipeline <T>) - confirm the problem with the human, send investigation briefs to triage-worker subagents (Playwright, Grafana Loki/Prometheus, GlitchTip), form and test root-cause hypotheses, have triage-judge check them, show every candidate rated with its artifacts, and after the human approves write back to Jira. Also resumes a run.
---

# Triage with a human in the loop

Rule: **workers collect evidence, the main session thinks, the judge checks, the human decides.**
The main session (opus) is the brain. It never collects evidence itself; it sends briefs to `triage-worker` subagents.

Argument: only `T`, the Jira key (if none was given, ask).
SUT: `https://foodme-tatevikpetrosyan.onrender.com/`. Never ask the human for it.

## Run directory `R = agentic-workflows/triage/runs/<T>/`

| File | Written by |
|---|---|
| `problem.md` | 01: symptom, where, when (time window), expected vs actual, confirmed by the human |
| `briefs/NN.md` | 02/03: one investigation task per worker |
| `findings/NN.md` | the triage-worker that got brief NN |
| `hypotheses.md` | 03: root-cause hypotheses H1..Hn, each with evidence, confidence high/medium/low, and how it was tested |
| `verdicts/judge-NN.json` | 04: the triage-judge JSON, saved word for word |
| `rca.md` | 05: every candidate rated, with its artifacts |
| `gates.yaml` | the step, only right after the human approves in chat |
| `status` | one line for the status line |

## Steps

### 01 Confirm the problem
1. Read the ticket T with mcp-atlassian (summary, description, comments, attachments).
2. Write `problem.md`: symptom, page/endpoint, time window, expected vs actual, how often.
3. Show it to the human and ask with AskUserQuestion: "Is this the problem?" If they correct it, update and ask again.
4. After approval write `problem: {approved: true}` to `gates.yaml`. → STATUS: DONE

### 02 Investigation briefs
1. Write 2–4 briefs in `briefs/`, one source each:
   - UI: reproduce on the SUT with Playwright, screenshots
   - Logs: Loki errors/warnings for the time window (Grafana)
   - Metrics: Prometheus latency and error rate for the endpoint (Grafana)
   - Errors: GlitchTip issues and stack traces in the time window
   Each brief says: goal, source, exact time window, what counts as evidence.
2. Run one `triage-worker` per brief (Agent tool, `subagent_type: triage-worker`, prompt `Investigate brief NN of <T>`), in parallel.
3. Wait for all findings. → STATUS: DONE

### 03 Hypotheses
1. From the findings, write `hypotheses.md`: H1..Hn, each with its supporting artifacts, what would prove or disprove it, and a confidence.
2. If a hypothesis lacks evidence, write a new brief and run another worker to test it. Max 2 extra rounds.
3. → STATUS: DONE

### 04 Judge (phase 2)
1. Run `triage-judge` (Agent tool, `subagent_type: triage-judge`, prompt `Judge the triage of <T>`).
2. Save its JSON word for word to `verdicts/judge-NN.json`.
3. On FAIL: fix `hypotheses.md` (or send a new brief) and judge again. Max 2 rounds; then show the human the open FAILs.
→ STATUS: DONE

### 05 Show the candidates
1. Write `rca.md`: a table of every candidate (rank, hypothesis, confidence, artifacts with links), the most likely root cause, and the judge verdict.
2. Show it in chat and ask with AskUserQuestion: approve / change / investigate more.
3. After approval write `rca: {approved: true, chosen: Hx}` to `gates.yaml`. → STATUS: DONE

### 06 Write back to Jira
1. Show the exact Jira comment text first and ask for approval.
2. Only after approval: add the comment to T (root cause, evidence links, judge verdict). If the human asks, create a linked bug.
3. Write `jira: {approved: true, comment: done}` to `gates.yaml`. → STATUS: DONE

## How to run
1. Find the first unfinished step (a fresh run starts at 01) by checking which files and gates exist.
2. Print one line: `Triage <T>: starting at step NN`.
3. Do that step completely, including its human review.
4. After `STATUS: DONE`, go straight to the next step in the same turn. Don't summarise and don't ask "shall I continue?". Only the reviews inside the steps are decisions for the human.
5. Overwrite `R/status` with one line every time the state changes, for example:
   `Triage <T> │ ✅01 ⏳02 ⏳03 ⏳04 ⏳05 ⏳06 │ 02 Briefs · 3 workers running`
6. Never write to Jira without an approved gate.  