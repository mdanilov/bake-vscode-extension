import * as vscode from "vscode";
import { createBuildVariantFrom } from "../model/BuildVariant";
import { createBakeWorkspace } from "../model/Workspace";
import { createBuildTask } from "./TasksCommon";


/**
 * Searches for build variants in the workspace
 * and adds them to the list of build tasks
 *
 * This is realised with the registered TaskProvider.
 *
 * Please dispose the returned provider when the extension
 * is ended.
 *
 * @param context
 */
export function registerAutoDetectedBakeTasks(context: vscode.ExtensionContext) {
    return vscode.workspace.registerTaskProvider("bake", {
        provideTasks: (token?: vscode.CancellationToken) => {
            return createBuildTasksFromAutoDetetectedBuildVariants();
            //return []
        },
        resolveTask(task: vscode.Task, token?: vscode.CancellationToken): vscode.ProviderResult<vscode.Task> {
            // Refining tasks is not supported by VSCODE yet.
            // See https://github.com/Microsoft/vscode/issues/33523
            return undefined;
        },
    });
}

async function createBuildTasksFromAutoDetetectedBuildVariants(): Promise<vscode.Task[]> {
    let workspace = await createBakeWorkspace();

    let buildTasks : vscode.Task[] = [];
    for (const project of workspace.getProjectMetas()){
        let targets = await project.getTargets();
        for (const target of targets){
            const buildVariant = createBuildVariantFrom(project, target);
            const projectName = project.getName()
            const name = (buildVariant.project === projectName)?
                (`'${buildVariant.config}' in ${project.getName()}`) :
                (`'${buildVariant.config}' in ${project.getName()} (${buildVariant.project})`)
            buildTasks.push(createBuildTask(name, buildVariant, "Bake", project.getWorkspaceFolder()));
        }
    }

    return Promise.resolve(buildTasks);
}
