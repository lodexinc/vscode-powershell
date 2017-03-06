import fs = require('fs');
import os = require('os');
import path = require('path');

export let PowerShellLanguageId = 'powershell';

export function ensurePathExists(targetPath: string) {
    // Ensure that the path exists
    try {
        fs.mkdirSync(targetPath);
    }
    catch (e) {
        // If the exception isn't to indicate that the folder
        // exists already, rethrow it.
        if (e.code != 'EEXIST') {
            throw e;
        }
    }
}

export function getUniqueSessionId() {
    // We need to uniquely identify the current VS Code session
    // using some string so that we get a reliable pipe server name
    // for both the language and debug servers.

    if (os.platform() == "linux") {
        // Electron running on Linux uses an additional layer of
        // separation between parent and child processes which
        // prevents environment variables from being inherited
        // easily.  This causes VSCODE_PID to not be available
        // (for now) so use a different variable to get a
        // unique session.
        return process.env.VSCODE_PID;
    }
    else {
        // VSCODE_PID is available on Windows and OSX
        return process.env.VSCODE_PID;
    }
}

export function getPipePath(pipeName: string) {
    if (os.platform() == "win32") {
        return "\\\\.\\pipe\\" + pipeName;
    }
    else {
        // On UNIX platforms the pipe will live under the temp path
        // For details on how this path is computed, see the corefx
        // source for System.IO.Pipes.PipeStream:
        // https://github.com/dotnet/corefx/blob/d0dc5fc099946adc1035b34a8b1f6042eddb0c75/src/System.IO.Pipes/src/System/IO/Pipes/PipeStream.Unix.cs#L340
        return path.resolve(
            os.tmpdir(),
            ".dotnet", "corefx", "pipe",
            pipeName);
    }
}

export interface EditorServicesSessionDetails {
    status: string;
    reason: string;
    powerShellVersion: string;
    channel: string;
    languageServicePort: number;
    debugServicePort: number;
}

export interface ReadSessionFileCallback {
    (details: EditorServicesSessionDetails): void;
}

export interface WaitForSessionFileCallback {
    (details: EditorServicesSessionDetails, error: string): void;
}

let sessionsFolder = path.resolve(__dirname, "..", "sessions/");
let sessionFilePath = path.resolve(sessionsFolder, "PSES-VSCode-" + process.env.VSCODE_PID);

// Create the sessions path if it doesn't exist already
ensurePathExists(sessionsFolder);

export function getSessionFilePath() {
    return sessionFilePath;
}

export function writeSessionFile(sessionDetails: EditorServicesSessionDetails) {
    ensurePathExists(sessionsFolder);

    var writeStream = fs.createWriteStream(sessionFilePath);
    writeStream.write(JSON.stringify(sessionDetails));
    writeStream.close();
}

export function waitForSessionFile(callback: WaitForSessionFileCallback) {

    function innerTryFunc(remainingTries: number) {
        if (remainingTries == 0) {
            callback(undefined, "Timed out waiting for session file to appear.");
        }
        else if(!checkIfFileExists(sessionFilePath)) {
            // Wait a bit and try again
            setTimeout(function() { innerTryFunc(remainingTries - 1); }, 500);
        }
        else {
            // Session file was found, load and return it
            callback(readSessionFile(), undefined);
        }
    }

    // Since the delay is 500ms, 50 tries gives 25 seconds of time
    // for the session file to appear
    innerTryFunc(50);
}

export function readSessionFile(): EditorServicesSessionDetails {
    let fileContents = fs.readFileSync(sessionFilePath, "utf-8");
    return JSON.parse(fileContents)
}

export function deleteSessionFile() {
    try {
        fs.unlinkSync(sessionFilePath);
    }
    catch (e) {
        // TODO: Be more specific about what we're catching
    }
}

export function checkIfFileExists(filePath: string): boolean {
    try {
        fs.accessSync(filePath, fs.constants.R_OK)
        return true;
    }
    catch (e) {
        return false;
    }
}