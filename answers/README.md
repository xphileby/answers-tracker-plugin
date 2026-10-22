# answers

A pane that indexes the answers of the current Claude Code session so they do not get lost under the output of long or parallel tasks.

Every prompt the person types and every assistant text block is indexed by its transcript id as it is stored, in the main conversation and in each subagent's. The pane lists the transcript in view: switch to an agent from the tasks list and it shows that agent's answers. When a turn completes, its closing assistant text is marked as the final answer. The pane lists prompts (dim) and final answers; `[all blocks]` also shows the interim text between tool calls. A click on an entry scrolls the transcript to that message (fullscreen renderer; the main-screen renderer cannot be scrolled by a plugin). A dot marks answers currently on screen.

History stored before the plugin loaded (a resumed session, a plugin installed mid-session) is read once from the session's messages: those rows have no time stamp, and each becomes a jump target once the transcript has drawn it.

Commands: `/answers` opens the pane, `/answers all` or `/answers final` switches the filter, `/answers clear` empties the index, `/answers index` rebuilds the main conversation's part of it from the session's history.

## Install

This folder's parent is a one-plugin marketplace (`answers-plugin`); see `../INSTALL.md`, or run `../install.sh`:

```
claude plugin marketplace add <path to answers-plugin>
claude plugin install answers@answers-plugin --scope user
```

From a repository that holds the marketplace file:

```
/plugin install answers --marketplace xphileby/answers-tracker-plugin
```

For one session, with no install: `claude --plugin-dir <path to answers-plugin>/answers`. Edits to the folder are picked up with `/reload-plugins`.

## Check

```
claude plugin validate answers
claude plugin test answers
```
