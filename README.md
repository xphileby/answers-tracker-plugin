# answers-tracker-plugin

A Claude Code plugin: a pane that indexes the answers of the current session, the main conversation's and each subagent's, so they do not get lost under long or parallel tasks. Click an entry to jump to it in the transcript.

## Install

At the prompt of a Claude Code terminal session (`y` to add the marketplace, then pick a scope):

```
/plugin install answers --marketplace xphileby/answers-tracker-plugin
```

From a shell:

```
claude plugin install answers --marketplace xphileby/answers-tracker-plugin
```

Then `/answers`; also `/answers all`, `/answers final`, `/answers clear`.

Requires Claude Code 2.1.308 or newer (hooks modules and the pane API).

Details: [answers/README.md](answers/README.md). Installing from a local folder, in Russian: [INSTALL.md](INSTALL.md).
