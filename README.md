# coc-htmlhint

> fork from a [Microsoft/vscode-htmlhint](https://github.com/Microsoft/vscode-htmlhint) | [HTMLHint](https://marketplace.visualstudio.com/items?itemName=mkaufman.HTMLHint)

Integrates the HTMLHint static analysis tool into [coc.nvim](https://github.com/neoclide/coc.nvim).

## Install

`:CocInstall coc-htmlhint`

## Configuration options

- `htmlhint.enable`: Enable coc-htmlhint extension, default: `true`
- `htmlhint.documentSelector`: The associated document types to be linted, default: `["html", "htm"]`
- `htmlhint.options`: The htmlhint options object to provide args to the htmlhint command, default: `{}`

## HTMLHint module

The coc-htmlhint extension will attempt to use the locally installed HTMLHint module (the project-specific module if present, or a globally installed HTMLHint module). If a locally installed HTMLHint isn't available, the extension will use the embedded version.

## Rules

The HTMLHint extension uses the default [rules](https://github.com/htmlhint/HTMLHint/wiki/Usage#about-rules) provided by HTMLHint.

```json
{
  "tagname-lowercase": true,
  "attr-lowercase": true,
  "attr-value-double-quotes": true,
  "doctype-first": true,
  "tag-pair": true,
  "spec-char-escape": true,
  "id-unique": true,
  "src-not-empty": true,
  "attr-no-duplication": true,
  "title-require": true
}
```

## .htmlhintrc

If you'd like to modify the rules, you can provide a `.htmlhintrc` file in the root of your project folder with a reduced ruleset or modified values.

You can learn more about rule configuration at the HTMLHint [Usage page](https://github.com/htmlhint/HTMLHint/wiki/Usage).

## Thanks

- [Microsoft/vscode-htmlhint](https://github.com/Microsoft/vscode-htmlhint) : The origin of this repository.

## License

MIT

---

> This extension is built with [create-coc-extension](https://github.com/fannheyward/create-coc-extension)
