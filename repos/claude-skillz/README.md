# claude-skillz

A collection of Claude Code skills.

## Skills

| Skill | Description |
|---|---|
| [gauntlet-loop](.claude/skills/gauntlet-loop/SKILL.md) | Turns any goal into one short, paste-ready "gauntlet loop" prompt — an agent sets a real quality bar, splits the work into small judgeable pieces, runs a builder and a separate harsh critic on each, compares blind against the bar, and loops until it wins. |

## Usage

Skills live under `.claude/skills/`, so Claude Code picks them up automatically when working in this repository. To use one in another project, copy its folder:

```
cp -r .claude/skills/gauntlet-loop your-project/.claude/skills/
```

Then invoke it, e.g. `/gauntlet-loop build me a pricing page for my SaaS`.

## Credits

The gauntlet-loop skill is from [robonuggets/gauntlet-loop](https://github.com/robonuggets/gauntlet-loop) by Jay E at [RoboNuggets](https://robonuggets.com), licensed CC BY 4.0. The underlying technique is [Matt Shumer's](https://github.com/mshumer), from [Claude of Duty](https://github.com/mshumer/Claude-of-Duty).
