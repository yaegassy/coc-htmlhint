import * as path from 'path';

import {
  workspace,
  ExtensionContext,
  LanguageClient,
  LanguageClientOptions,
  SettingMonitor,
  ServerOptions,
  TransportKind,
  DocumentSelector,
} from 'coc.nvim';

export async function activate(context: ExtensionContext): Promise<void> {
  const config = workspace.getConfiguration('htmlhint');

  const isEnable = config.get<boolean>('enable', true);
  if (!isEnable) {
    return;
  }

  const serverModulePath = path.join(__dirname, '..', 'server', 'server.js');

  const debugOptions = { execArgv: ['--nolazy', '--inspect=6010'], cwd: process.cwd() };
  const serverOptions: ServerOptions = {
    run: { module: serverModulePath, transport: TransportKind.ipc },
    debug: { module: serverModulePath, transport: TransportKind.ipc, options: debugOptions },
  };

  const extensionDocumentSelector: undefined | string[] | DocumentSelector = config.get<string[] | DocumentSelector>(
    'documentSelector'
  ) || [
    { scheme: 'file', language: 'html' },
    { scheme: 'untitled', language: 'html' },
  ];

  const clientOptions: LanguageClientOptions = {
    documentSelector: extensionDocumentSelector,
    diagnosticCollectionName: 'htmlhint',
    synchronize: {
      configurationSection: 'htmlhint',
      fileEvents: workspace.createFileSystemWatcher('**/.htmlhintrc'),
    },
  };

  const forceDebug = false;
  const client = new LanguageClient('HTML-hint', serverOptions, clientOptions, forceDebug);

  context.subscriptions.push(new SettingMonitor(client, 'htmlhint.enable').start());
}
