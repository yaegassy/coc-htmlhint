/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
'use strict';

/// <reference path="typings/node/node.d.ts" />
/// <reference path="typings/htmlhint/htmlhint.d.ts" />

import * as path from 'path';
import * as server from 'vscode-languageserver';
import * as htmlhint from 'htmlhint';
import fs = require('fs');

// let stripJsonComments: any = require('strip-json-comments');
import stripJsonComments from 'strip-json-comments';

interface Settings {
  htmlhint: {
    configFile: string;
    enable: boolean;
    options: any;
  };
  [key: string]: any;
}

let settings: Settings;
let linter: any = null;

/**
 * This variable is used to cache loaded htmlhintrc objects.  It is a dictionary from path -> config object.
 * A value of null means a .htmlhintrc object didn't exist at the given path.
 * A value of undefined means the file at this path hasn't been loaded yet, or should be reloaded because it changed
 */
const htmlhintrcOptions: any = {};

/**
 * Given an htmlhint Error object, approximate the text range highlight
 */
function getRange(error: htmlhint.Error, lines: string[]): any {
  const line = lines[error.line - 1];
  let isWhitespace = false;
  let curr = error.col;
  while (curr < line.length && !isWhitespace) {
    const char = line[curr];
    isWhitespace = char === ' ' || char === '\t' || char === '\n' || char === '\r' || char === '<';
    ++curr;
  }

  if (isWhitespace) {
    --curr;
  }

  return {
    start: {
      line: error.line - 1, // Html-hint line numbers are 1-based.
      character: error.col - 1,
    },
    end: {
      line: error.line - 1,
      character: curr,
    },
  };
}

/**
 * Given an htmlhint.Error type return a VS Code server Diagnostic object
 */
function makeDiagnostic(problem: htmlhint.Error, lines: string[]): server.Diagnostic {
  return {
    severity: server.DiagnosticSeverity.Warning,
    message: problem.message,
    range: getRange(problem, lines),
    code: problem.rule.id,
  };
}

/**
 * Get the html-hint configuration settings for the given html file.  This method will take care of whether to use
 * VS Code settings, or to use a .htmlhintrc file.
 */
function getConfiguration(filePath: string): any {
  let options: any;
  if (settings.htmlhint) {
    if (
      settings.htmlhint.configFile &&
      settings.htmlhint.options &&
      Object.keys(settings.htmlhint.options).length > 0
    ) {
      throw new Error(
        `The configuration settings for HTMLHint are invalid. Please specify either 'htmlhint.configFile' or 'htmlhint.options', but not both.`
      );
    }
    if (settings.htmlhint.configFile) {
      if (fs.existsSync(settings.htmlhint.configFile)) {
        options = loadConfigurationFile(settings.htmlhint.configFile);
      } else {
        const configFileHint = !path.isAbsolute(settings.htmlhint.configFile)
          ? ` (resolves to '${path.resolve(settings.htmlhint.configFile)}')`
          : '';
        throw new Error(
          `The configuration settings for HTMLHint are invalid. The file '${settings.htmlhint.configFile}'${configFileHint} specified in 'htmlhint.configFile' could not be found.`
        );
      }
    } else if (settings.htmlhint.options && Object.keys(settings.htmlhint.options).length > 0) {
      options = settings.htmlhint.options;
    } else {
      options = findConfigForHtmlFile(filePath);
    }
  } else {
    options = findConfigForHtmlFile(filePath);
  }

  options = options || {};
  return options;
}

/**
 * Given the path of an html file, this function will look in current directory & parent directories
 * to find a .htmlhintrc file to use as the linter configuration.  The settings are
 */
function findConfigForHtmlFile(base: string) {
  let options: any;

  if (fs.existsSync(base)) {
    // find default config file in parent directory
    if (fs.statSync(base).isDirectory() === false) {
      base = path.dirname(base);
    }

    while (base && !options) {
      const tmpConfigFile = path.resolve(base + path.sep, '.htmlhintrc');

      // undefined means we haven't tried to load the config file at this path, so try to load it.
      if (htmlhintrcOptions[tmpConfigFile] === undefined) {
        htmlhintrcOptions[tmpConfigFile] = loadConfigurationFile(tmpConfigFile);
      }

      // defined, non-null value means we found a config file at the given path, so use it.
      if (htmlhintrcOptions[tmpConfigFile]) {
        options = htmlhintrcOptions[tmpConfigFile];
        break;
      }

      base = base.substring(0, base.lastIndexOf(path.sep));
    }
  }
  return options;
}

/**
 * Given a path to a .htmlhintrc file, load it into a javascript object and return it.
 */
//function loadConfigurationFile(configFile: string | Buffer): any {
function loadConfigurationFile(configFile: string): any {
  let ruleset: any = null;
  if (fs.existsSync(configFile)) {
    const config = fs.readFileSync(configFile, 'utf8');
    try {
      ruleset = JSON.parse(stripJsonComments(config));
    } catch (e) {}
  }
  return ruleset;
}

function getErrorMessage(err: any, document: server.TextDocument): string {
  let result: string;
  if (typeof err.message === 'string' || err.message instanceof String) {
    result = <string>err.message;
  } else {
    result = `An unknown error occured while validating file: ${server.Files.uriToFilePath(document.uri)}`;
  }
  return result;
}

function validateAllTextDocuments(connection: server.IConnection, documents: server.TextDocument[]): void {
  const tracker = new server.ErrorMessageTracker();
  documents.forEach((document) => {
    try {
      validateTextDocument(connection, document);
    } catch (err) {
      tracker.add(getErrorMessage(err, document));
    }
  });
  tracker.sendErrors(connection);
}

function validateTextDocument(connection: server.IConnection, document: server.TextDocument): void {
  try {
    doValidate(connection, document);
  } catch (err) {
    connection.window.showErrorMessage(getErrorMessage(err, document));
  }
}

const connection: server.IConnection = server.createConnection();
const documents: server.TextDocuments = new server.TextDocuments();
documents.listen(connection);

function trace(message: string, verbose?: string): void {
  connection.tracer.log(message, verbose);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
connection.onInitialize((params: server.InitializeParams, token: server.CancellationToken) => {
  const rootFolder = params.rootPath || '';
  const initOptions: {
    nodePath: string;
  } = params.initializationOptions;
  const nodePath = initOptions ? (initOptions.nodePath ? initOptions.nodePath : '') : '';

  const result = server.Files.resolveModule2(rootFolder, 'htmlhint', nodePath, trace).then(
    (value): server.InitializeResult | server.ResponseError<server.InitializeError> => {
      linter = value.default || value.HTMLHint || value;

      const result: server.InitializeResult = { capabilities: { textDocumentSync: documents.syncKind } };
      return result;
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (error) => {
      // didn't find htmlhint in project or global, so use embedded version.
      linter = htmlhint.default || htmlhint.HTMLHint || htmlhint;
      //connection.window.showInformationMessage(`onInitialize() using embedded htmlhint(version ! ${linter.version})`);
      const result: server.InitializeResult = { capabilities: { textDocumentSync: documents.syncKind } };
      return result;
    }
  );

  return result as Thenable<server.InitializeResult>;
});

function doValidate(connection: server.IConnection, document: server.TextDocument): void {
  try {
    const uri = document.uri;
    const fsPath = server.Files.uriToFilePath(uri) || '';
    const contents = document.getText();
    const lines = contents.split('\n');

    const config = getConfiguration(fsPath);

    const errors: htmlhint.Error[] = linter.verify(contents, config);

    const diagnostics: server.Diagnostic[] = [];
    if (errors.length > 0) {
      errors.forEach((each) => {
        diagnostics.push(makeDiagnostic(each, lines));
      });
    }
    connection.sendDiagnostics({ uri, diagnostics });
  } catch (err: any) {
    let message: string;
    if (typeof err.message === 'string' || err.message instanceof String) {
      message = <string>err.message;
      throw new Error(message);
    }
    throw err;
  }
}

// A text document has changed. Validate the document.
documents.onDidChangeContent((event) => {
  // the contents of a text document has changed
  validateTextDocument(connection, event.document);
});

// The VS Code htmlhint settings have changed. Revalidate all documents.
connection.onDidChangeConfiguration((params) => {
  settings = params.settings;

  validateAllTextDocuments(connection, documents.all());
});

// The watched .htmlhintrc has changed. Clear out the last loaded config, and revalidate all documents.
connection.onDidChangeWatchedFiles((params) => {
  for (let i = 0; i < params.changes.length; i++) {
    // @ts-ignore
    htmlhintrcOptions[server.Files.uriToFilePath(params.changes[i].uri)] = undefined;
  }
  validateAllTextDocuments(connection, documents.all());
});

connection.listen();
