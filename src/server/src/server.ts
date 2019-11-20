import {
    createConnection, Diagnostic, DiagnosticSeverity, ProposedFeatures, Range, TextDocuments, TextDocumentSyncKind,
} from "vscode-languageserver";

import { RtextClient } from "src/rtextClient";
import * as rtext from "src/rtextProtocol";

// Creates the LSP connection
const connection = createConnection(ProposedFeatures.all);

// Create a manager for open text documents
const documents = new TextDocuments();

// The workspace folder this server is operating on
let workspaceFolder: string | null;

const rtextClient = new RtextClient();

documents.onDidOpen((event) => {
    connection.console.log(`[Server(${process.pid}) ${workspaceFolder}] Document opened: ${event.document.uri}`);
});

connection.onInitialize((params) => {
    workspaceFolder = params.rootUri;
    connection.console.log(`[Server(${process.pid}) ${workspaceFolder}] Started and initialize received`);

    rtextClient.init();

    return {
        capabilities: {
            textDocumentSync: {
                change: TextDocumentSyncKind.None,
                openClose: true,
            },
        },
    };
});

connection.onDidChangeWatchedFiles((changes) => {
    rtextClient.loadModel().then((data) => {
        data.problems.forEach((problem) => {
            const diagnostics: Diagnostic[] = [];

            function convertSeverity(severity: rtext.ProblemSeverity): DiagnosticSeverity {
                switch (severity) {
                    case rtext.ProblemSeverity.debug:
                        return DiagnosticSeverity.Hint;
                    case rtext.ProblemSeverity.error:
                    case rtext.ProblemSeverity.fatal:
                        return DiagnosticSeverity.Error;
                    case rtext.ProblemSeverity.warn:
                        return DiagnosticSeverity.Warning;
                    case rtext.ProblemSeverity.info:
                        return DiagnosticSeverity.Information;
                    default:
                        //@todo assert
                        return DiagnosticSeverity.Error;
                }
            }

            problem.problems.forEach((fileProblem) => {
                const diagnostic: Diagnostic = {
                    message: fileProblem.message,
                    range: Range.create(fileProblem.line, 0, fileProblem.line, Number.MAX_SAFE_INTEGER),
                    severity: convertSeverity(fileProblem.severity),
                };

                diagnostics.push(diagnostic);
            });
            connection.sendDiagnostics({ uri: problem.file, diagnostics });
        });
    });
});

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
