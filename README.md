# answers-tracker-plugin

A Claude Code plugin that keeps an index of the session's answers in a pane beside the transcript. Long tasks bury the answer under hundreds of tool calls, and parallel subagents bury it twice over; the pane lists every prompt you typed and the answer each one got, and a click scrolls the transcript to that message.

## What you see

```
 Answers 3 [final only]
 › 09:12 Review the plugins in this folder and suggest fixes
   The plugin validates cleanly. One real bug and four improvements…
 › 09:40 Check the theory about agent sessions
   Confirmed: line 95 drops every row that carries an agentId…
 › 10:02 go
 ● Done. Validation, tsc and both tests pass on the real folder…
```

- `›` rows are your prompts, dim, with the time they were sent.
- The other rows are answers: the first meaningful line of each, markdown stripped.
- `●` marks an answer the transcript shows on screen right now.
- A click on any row scrolls the transcript to that message.
- `[final only]` / `[all blocks]` toggles between the closing answer of each turn and every text block the model wrote, including the interim lines between tool calls.

The pane docks beside the transcript in the fullscreen renderer from 110 columns; narrower terminals get it inline above the prompt.

## Commands

| Command | What it does |
| --- | --- |
| `/answers` | Opens the pane (or brings it back). |
| `/answers all` | Shows every text block, interim ones included. |
| `/answers final` | Shows closing answers only (the default). |
| `/answers clear` | Empties the index for this session. |
| `/answers index` | Rebuilds the index of the conversation in view (the main one, or the agent's) from the session's history, after a `clear` or whenever it looks wrong. |

## Examples

**A long task.** You ask for a refactor, the model runs sixty tool calls and writes a report at the end. Three more prompts later the report is forty screens up. Open the pane, click the answer row, and the transcript is there.

**Parallel subagents.** The main conversation spawns three agents. Open one of them from the tasks list and the pane switches to that agent's prompts and answers, reading the agent's history the first time; come back to the main transcript and it switches back. Each conversation keeps its own index.

**A resumed session.** `claude --resume` loads yesterday's transcript. The pane lists its prompts and answers as soon as it opens, without time stamps (the engine does not hand those out); each row becomes clickable once the transcript has drawn that message.

**What did it say between the tool calls?** `/answers all` adds the interim blocks: "Looking at the config first", "Tests fail, fixing the import", and so on, each one a jump target.

## How it works

Every row a conversation keeps passes through the plugin as it is stored, in the main conversation and in each subagent's. Prompts and the model's text blocks are indexed by their transcript id. When a turn completes, its closing text is marked as the final answer. The pane reads the index and draws the conversation in view. History that was stored before the plugin loaded (a resumed session, a plugin installed mid-session, an agent's transcript opened for the first time) is read once from the session's messages.

The index is kept in session state, so a plugin reload keeps it, and capped at 400 rows per conversation. The plugin reads no files, runs no processes and sends nothing anywhere.

## Limits

- Jumping to a message and the `●` marks need the fullscreen renderer; on the main screen the pane lists the answers but cannot scroll the transcript.
- History rows have no time stamp and become clickable only after the transcript has drawn them.
- An answer is one row per text block; a reply with several text blocks shows each under `[all blocks]` and all of the closing ones under `[final only]`.

## Install

At the prompt of a Claude Code terminal session (`y` to add the marketplace, then pick a scope):

```
/plugin install answers --marketplace xphileby/answers-tracker-plugin
```

From a shell:

```
claude plugin install answers --marketplace xphileby/answers-tracker-plugin
```

Requires Claude Code 2.1.308 or newer (hooks modules and the pane API). Installing from a local folder, in Russian: [INSTALL.md](INSTALL.md).

Update later with `/plugin marketplace update answers-plugin`, then `/reload-plugins`.

## Develop

```
claude plugin validate answers
claude plugin test answers
claude --plugin-dir ./answers    # one session with the folder's version, no install
```

The plugin is one hooks module, `answers/hooks/register.tsx`, with its state contract in `answers/types/index.d.ts` and its tests beside it.
