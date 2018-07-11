import { BuildVariant } from "../model/BuildVariant";
import { BakeExtensionSettings } from "../settings/BakeExtensionSettings";
import * as vscode from "vscode";
import { globalState } from "../model/GlobalState";

interface BakeTaskDefinition extends vscode.TaskDefinition {
    target?: string;
    file?: string;
}

export function createBuildTask(name: string, buildVariant: BuildVariant): vscode.Task {
    const settings = new BakeExtensionSettings();
    const problemMatcher = settings.getDefaultProblemMatcher();
    const commandLine = createBuildCommandLine(buildVariant, settings);
    const kind = {
        label: name,
        type: "shell",
        command: commandLine
    };
    // FIXME: the next line assumes that we are working with one workspace only (should be the case most of time)
    const task = new vscode.Task(kind, globalState().getWorkspaceFolder(), name , "bake");
    task.group = vscode.TaskGroup.Build;
    task.execution = new vscode.ShellExecution(commandLine);
    if (problemMatcher) {
        task.problemMatchers.push(problemMatcher);
    }
    return task;
}

export function createDynamicBuildTask(project, buildVariant: BuildVariant) : vscode.Task {
    const settings = new BakeExtensionSettings();
    const problemMatcher = settings.getDefaultProblemMatcher();
    const commandLine = createBuildCommandLine(buildVariant, settings)
    const path = project.getPathInWorkspace()
    const projectName = project.getName()
    let name = `'${buildVariant.config}', ${project.getName()}`
    if (path != projectName) {
        name = `${name} (${path})`
    }
    let kind: BakeTaskDefinition = {
        type: "bake",
        target: buildVariant.config,
        file: path
    }
    let task = new vscode.Task(kind, project.getWorkspaceFolder(), name , "bake")
    task.group = vscode.TaskGroup.Build
    task.execution = new vscode.ShellExecution(commandLine)
    if (problemMatcher) {
        task.problemMatchers.push(problemMatcher)
    }
    return task
}

function createBuildCommandLine(buildVariant: BuildVariant, settings: BakeExtensionSettings ){
    const numCores = settings.getNumberOfParallelBuilds();
    const adaptCompiler = settings.getUnitTestAdaptType();
    const runTestsOnBuild = settings.shallUnitTestRunOnBuild();
    const isUnittest = buildVariant.config.toLowerCase().includes("unittest");
    const doAdapt = buildVariant.adapt ? `--adapt ${buildVariant.adapt}` : (isUnittest && adaptCompiler) ? `--adapt ${adaptCompiler}` : "";
    const doRun =  (isUnittest && runTestsOnBuild) ? "--do run" : "";
    return `bake -j${numCores} -m ${buildVariant.project} ${buildVariant.config} -a black ${doAdapt} ${doRun}`;
}
