"use strict";
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { cleanIncludesAndDefines } from "src/commands/cleanIncludesAndDefines";
import { doImportBuildVariantFromSettings, importIncludesAndDefines } from "src/commands/importIncludesAndDefines";
import { BakeCompletionItemProvider } from "src/languages/BakeCompletionItemProvider";
import { BakeHoverProvider } from "src/languages/BakeHoverProvider";
import { registerAutoDetectedBakeTasks } from "src/tasks/AutoDetectedBuildTasks";
import { registerActiveBakeTasks } from "src/tasks/VariantBuildTasks";

import newCppFile from "src/commands/newCppFile";
import newHeaderFile from "src/commands/newHeaderFile";

import { BakeExtensionSettings } from "src/settings/BakeExtensionSettings";
import logger from "src/util/logger";

import * as path from "path";

import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind,
  } from "vscode-languageclient";

let client: LanguageClient;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(cntxt: vscode.ExtensionContext) {

    logger.info("Project.meta file(s) detected. Activating bake extension.");

    // These commands have been defined in the package.json file
    // Now provide the implementation of the command with  registerCommand
    // The commandId parameter must match the command field in package.json

    registerCommand(cntxt, "bake.createNewHeaderFile", (context) => {
        newHeaderFile(context);
    });

    registerCommand(cntxt, "bake.createNewCppFile", (context) => {
        newCppFile(context);
    });

    registerCommand(cntxt, "bake.importIncludesAndDefines", (context) => {
        importIncludesAndDefines(context);
    });

    registerCommand(cntxt, "bake.cleanIncludesAndDefines", (context) => {
        cleanIncludesAndDefines(context);
    });

    cntxt.subscriptions.push(registerActiveBakeTasks(cntxt));
    cntxt.subscriptions.push(registerAutoDetectedBakeTasks(cntxt));
    cntxt.subscriptions.push(vscode.languages.registerHoverProvider(BakeHoverProvider.BakeType, new BakeHoverProvider(cntxt)));
    cntxt.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            "bake", new BakeCompletionItemProvider(), ":", ",", "\n"));

    warnOnDeprecated();

    await importDefaultBuildVariant();

    // The server is implemented in node
    const serverModule = cntxt.asAbsolutePath(path.join("src", "server", "out", "server.js"));
    // The debug options for the server
    // --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
    const debugOptions = { execArgv: ["--nolazy", "--inspect-brk=6009"] };

    // If the extension is launched in debug mode then the debug server options are used
    // Otherwise the run options are used
    const serverOptions: ServerOptions = {
        debug: {
            module: serverModule,
            options: debugOptions,
            transport: TransportKind.ipc,
        },
        run: { module: serverModule, transport: TransportKind.ipc },
    };

    // Options to control the language client
    const clientOptions: LanguageClientOptions = {
        // Register the server for bake project files
        documentSelector: [{ scheme: "file", language: "bake", pattern: "**/{Project,Adapt}.meta" }],
        synchronize: {
            // Notify the server about file changes to Project.meta files contained in the workspace
            fileEvents: vscode.workspace.createFileSystemWatcher("**/{Project,Adapt}.meta"),
        },
    };

    // Create the language client and start the client.
    client = new LanguageClient(
        "bakeServer",
        "Bake Language Server",
        serverOptions,
        clientOptions,
    );

    // Start the client. This will also launch the server
    client.start();
}

export function deactivate(): Thenable<void> {
    if (!client) {
        return undefined;
    }
    return client.stop();
}

function registerCommand(context: vscode.ExtensionContext, id: string, callback: (...args: any[]) => any, thisArg?: any) {
    logger.info("Registering command " + id);
    const disposable = vscode.commands.registerCommand(id, callback);
    context.subscriptions.push(disposable);
}

async function importDefaultBuildVariant() {
    const settings = new BakeExtensionSettings();
    const name = settings.getDefaultBuildVariant();
    if (name) {
        logger.info(`Found default build variant ${name} in settings.json - auto importing it`);

        await doImportBuildVariantFromSettings(name, settings.getBuildVariant(name));
    }
    vscode.window.setStatusBarMessage(`Auto imported C++ Includes and Defines from Bake done`, 5000);
}

function warnOnDeprecated() {
    const config = vscode.workspace.getConfiguration("bake");

    if (config.has("mainProject")) {
        vscode.window.showWarningMessage("bake: setting bake.mainProject is deprecated. Search for project targets wiht 'ctrl+shift+p'.");
    }
    if (config.has("targetConfig")) {
        vscode.window.showWarningMessage("bake: setting bake.targetConfig is deprecated. Search for project targets wiht 'ctrl+shift+p'.");
    }
}
