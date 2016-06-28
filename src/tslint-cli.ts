/**
 * @license
 * Copyright 2013 Palantir Technologies, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as colors from "colors";
import * as diff from "diff";
import * as fs from "fs";
import * as glob from "glob";
import * as optimist from "optimist";
import * as path from "path";
import * as ts from "typescript";

import {
    CONFIG_FILENAME,
    DEFAULT_CONFIG,
    findConfiguration,
} from "./configuration";
import {IReplacement, RuleFailure} from "./language/rule/rule";
import {consoleTestResultHandler, runTest} from "./test";
import * as Linter from "./tslint";

let processed = optimist
    .usage("Usage: $0 [options] file ...")
    .check((argv: any) => {
        // at least one of file, help, version, project or unqualified argument must be present
        if (!(argv.h || argv.i || argv.test || argv.v || argv.project || argv._.length > 0)) {
            throw "Missing files";
        }

        if (argv.f) {
            throw "-f option is no longer available. Supply files directly to the tslint command instead.";
        }
    })
    .options({
        "c": {
            alias: "config",
            describe: "configuration file",
        },
        "force": {
            describe: "return status code 0 even if there are lint errors",
            "type": "boolean",
        },
        "h": {
            alias: "help",
            describe: "display detailed help",
        },
        "i": {
            alias: "init",
            describe: "generate a tslint.json config file in the current working directory",
        },
        "o": {
            alias: "out",
            describe: "output file",
        },
        "r": {
            alias: "rules-dir",
            describe: "rules directory",
        },
        "s": {
            alias: "formatters-dir",
            describe: "formatters directory",
        },
        "e": {
            alias: "exclude",
            describe: "exclude globs from path expansion",
        },
        "t": {
            alias: "format",
            default: "prose",
            describe: "output format (prose, json, verbose, pmd, msbuild, checkstyle, vso)",
        },
        "x": {
            alias: "fix",
            default: "none",
            describe: "output suggested fixes of a certain level (none, info, warning, error)",
        },
        "m": {
            alias: "fix-method",
            default: "interactive",
            describe: "method of applying fixes (interactive, patch, copy, direct)",
        },
        "test": {
            describe: "test that tslint produces the correct output for the specified directory",
        },
        "project": {
            describe: "tsconfig.json file",
        },
        "type-check": {
            describe: "enable type checking when linting a project",
        },
        "v": {
            alias: "version",
            describe: "current version",
        },
    });
const argv = processed.argv;

let outputStream: any;
if (argv.o != null) {
    outputStream = fs.createWriteStream(argv.o, {
        flags: "w+",
        mode: 420,
    });
} else {
    outputStream = process.stdout;
}

if (argv.v != null) {
    outputStream.write(Linter.VERSION + "\n");
    process.exit(0);
}

if (argv.i != null) {
    if (fs.existsSync(CONFIG_FILENAME)) {
        console.error(`Cannot generate ${CONFIG_FILENAME}: file already exists`);
        process.exit(1);
    }

    const tslintJSON = JSON.stringify(DEFAULT_CONFIG, undefined, "    ");
    fs.writeFileSync(CONFIG_FILENAME, tslintJSON);
    process.exit(0);
}

if (argv.test != null) {
    const results = runTest(argv.test, argv.r);
    const didAllTestsPass = consoleTestResultHandler(results);
    process.exit(didAllTestsPass ? 0 : 1);
}

if ("help" in argv) {
    outputStream.write(processed.help());
    const outputString = `
tslint accepts the following commandline options:

    -c, --config:
        The location of the configuration file that tslint will use to
        determine which rules are activated and what options to provide
        to the rules. If no option is specified, the config file named
        tslint.json is used, so long as it exists in the path.
        The format of the file is { rules: { /* rules list */ } },
        where /* rules list */ is a key: value comma-seperated list of
        rulename: rule-options pairs. Rule-options can be either a
        boolean true/false value denoting whether the rule is used or not,
        or a list [boolean, ...] where the boolean provides the same role
        as in the non-list case, and the rest of the list are options passed
        to the rule that will determine what it checks for (such as number
        of characters for the max-line-length rule, or what functions to ban
        for the ban rule).

    -e, --exclude:
        A filename or glob which indicates files to exclude from linting.
        This option can be supplied multiple times if you need multiple
        globs to indicate which files to exclude.

    --force:
        Return status code 0 even if there are any lint errors.
        Useful while running as npm script.

    -i, --init:
        Generates a tslint.json config file in the current working directory.

    -o, --out:
        A filename to output the results to. By default, tslint outputs to
        stdout, which is usually the console where you're running it from.

    -r, --rules-dir:
        An additional rules directory, for user-created rules.
        tslint will always check its default rules directory, in
        node_modules/tslint/lib/rules, before checking the user-provided
        rules directory, so rules in the user-provided rules directory
        with the same name as the base rules will not be loaded.

    -s, --formatters-dir:
        An additional formatters directory, for user-created formatters.
        Formatters are files that will format the tslint output, before
        writing it to stdout or the file passed in --out. The default
        directory, node_modules/tslint/build/formatters, will always be
        checked first, so user-created formatters with the same names
        as the base formatters will not be loaded.

    -t, --format:
        The formatter to use to format the results of the linter before
        outputting it to stdout or the file passed in --out. The core
        formatters are prose (human readable), json (machine readable)
        and verbose. prose is the default if this option is not used.
        Other built-in options include pmd, msbuild, checkstyle, and vso.
        Additonal formatters can be added and used if the --formatters-dir
        option is set.

    -x, --fix:
        The severity level at which to apply fixes for. By default, fixes
        not applied at all. This can be changed to any comma separated
        combination of stylistic or formatting issues (info), warnings
        (warning), and errors (error).

    -m, --fix-method:
        The method used to apply the specified fixes. By default, fixes will
        be interactive, requiring user confirmation on each. Fixes can also
        be provided in the form of a unified patch (patch), a copy of files
        (copy) or to files directly (direct).

    --test:
        Runs tslint on the specified directory and checks if tslint's output matches
        the expected output in .lint files. Automatically loads the tslint.json file in the
        specified directory as the configuration file for the tests. See the
        full tslint documentation for more details on how this can be used to test custom rules.

    --project:
        The location of a tsconfig.json file that will be used to determine which
        files will be linted.

    --type-check
        Enables the type checker when running linting rules. --project must be
        specified in order to enable type checking.

    -v, --version:
        The current version of tslint.

    -h, --help:
        Prints this help message.\n`;
    outputStream.write(outputString);
    process.exit(0);
}

// when provided, it should point to an existing location
if (argv.c && !fs.existsSync(argv.c)) {
    console.error("Invalid option for configuration: " + argv.c);
    process.exit(1);
}
const possibleConfigAbsolutePath = argv.c != null ? path.resolve(argv.c) : null;

let fixInteractive = (file: string, contents: string, failures: RuleFailure[]) => {
    // Accumulate fix replacements
    let replacements = failures.reduce((acc: IReplacement[], failure: RuleFailure) => {
        const fileName = failure.getFileName();
        const failureString = failure.getFailure();

        const lineAndCharacter = failure.getStartPosition().getLineAndCharacter();
        const positionTuple = `[${lineAndCharacter.line + 1}, ${lineAndCharacter.character + 1}]`;
        let prompt = `${fileName}${positionTuple}: ${failureString}\n`;
        let red = colors.red;
        let green = colors.green;
        failure.getFixes().forEach((fix) => {
            prompt += "    [ ] " + fix.description + "\n";
            fix.replacements.forEach((replacement) => {
                // Find relevant lines
                let start = replacement.start;
                let end = start + replacement.length;
                let previousLineBoundary = contents.lastIndexOf("\n", start) + 1;
                let nextLineBoundary = contents.indexOf("\n", end);
                if (nextLineBoundary === -1) {
                    nextLineBoundary = contents.length;
                }
                // Modify the snippet
                let snippet = contents.substring(previousLineBoundary, nextLineBoundary);
                let newSnippet = snippet.substring(0, start - previousLineBoundary) +
                    replacement.text + snippet.substring(end - previousLineBoundary);

                snippet.split("\n").forEach((line) => {
                    prompt += red("        - " + line + "\n");
                });
                newSnippet.split("\n").forEach((line) => {
                    prompt += green("        + " + line + "\n");
                });
            });
        });
        prompt += "    [ ] Do not fix\n";
        process.stdout.write(prompt);
        // TODO Get selection through ansi-escape
        return acc;
    }, []);

    if (replacements.length > 0) {
        // Sort in reverse order
        replacements.sort((a, b) => b.end - a.end);

        // Apply
        // TODO Make sure there is no overlap, choose the most fixes otherwise
        let newContents = contents;

        // Make the fixes directory
        const fixDir = path.join(process.cwd(), "fixes");
        if (!fs.existsSync(fixDir)) {
            fs.mkdirSync(fixDir);
        }
        replacements.forEach(r => {
            newContents = newContents.substring(0, r.start) +
                r.text + contents.substring(r.end);
        });
        // Overwrite file
        fs.writeFileSync(file, newContents);
    }
};

let fixPatch = (file: string, contents: string, failures: RuleFailure[]) => {
    // Accumulate fix replacements
    let replacements = failures.reduce((acc: IReplacement[], f: RuleFailure) => {
        if (f.getFixes().length > 0) {
            return acc.concat(f.getFixes()[0].replacements);
        } else {
            return acc;
        }
    }, []);

    if (replacements.length > 0) {
        // Sort in reverse order
        replacements.sort((a, b) => b.end - a.end);

        // Apply
        // TODO Make sure there is no overlap, choose the most fixes otherwise
        let newContents = contents;

        // Make the fixes directory
        const fixDir = path.join(process.cwd(), "fixes");
        if (!fs.existsSync(fixDir)) {
            fs.mkdirSync(fixDir);
        }
        replacements.forEach(r => {
            newContents = newContents.substring(0, r.start) +
                r.text + newContents.substring(r.end);
        });
        // Save new source in a 'fixes' folder with the same structure
        const newPath = path.relative(process.cwd(), file) + ".patch";
        mkdirParents(fixDir, path.dirname(newPath));
        const patch = diff.createPatch(files, contents, newContents, "original", "fixed");
        fs.writeFileSync(path.join(fixDir, newPath), patch);
    }
};

let fixCopy = (file: string, contents: string, failures: RuleFailure[]) => {
    // Accumulate fix replacements
    let replacements = failures.reduce((acc: IReplacement[], f: RuleFailure) => {
        if (f.getFixes().length > 0) {
            return acc.concat(f.getFixes()[0].replacements);
        } else {
            return acc;
        }
    }, []);

    if (replacements.length > 0) {
        // Sort in reverse order
        replacements.sort((a, b) => b.end - a.end);

        // Apply
        // TODO Make sure there is no overlap, choose the most fixes otherwise
        let newContents = contents;

        // Make the fixes directory
        const fixDir = path.join(process.cwd(), "fixes");
        if (!fs.existsSync(fixDir)) {
            fs.mkdirSync(fixDir);
        }
        replacements.forEach(r => {
            newContents = newContents.substring(0, r.start) +
                r.text + newContents.substring(r.end);
        });
        // Save new source in a 'fixes' folder with the same structure
        const newPath = path.relative(process.cwd(), file);
        mkdirParents(fixDir, path.dirname(newPath));
        fs.writeFileSync(path.join(fixDir, newPath), newContents);
    }
};

let fixDirect = (file: string, contents: string, failures: RuleFailure[]) => {
    // Accumulate fix replacements
    let replacements = failures.reduce((acc: IReplacement[], f: RuleFailure) => {
        if (f.getFixes().length > 0) {
            return acc.concat(f.getFixes()[0].replacements);
        } else {
            return acc;
        }
    }, []);

    if (replacements.length > 0) {
        // Sort in reverse order
        replacements.sort((a, b) => b.end - a.end);

        // Apply
        // TODO Make sure there is no overlap, choose the most fixes otherwise
        let newContents = contents;

        replacements.forEach(r => {
            newContents = newContents.substring(0, r.start) +
                r.text + newContents.substring(r.end);
        });
        // Overwrite file
        fs.writeFileSync(file, newContents);
    }
};

const processFile = (file: string, program?: ts.Program) => {
    if (!fs.existsSync(file)) {
        console.error(`Unable to open file: ${file}`);
        process.exit(1);
    }

    const buffer = new Buffer(256);
    buffer.fill(0);
    const fd = fs.openSync(file, "r");
    try {
        fs.readSync(fd, buffer, 0, 256, null);
        if (buffer.readInt8(0) === 0x47 && buffer.readInt8(188) === 0x47) {
            // MPEG transport streams use the '.ts' file extension. They use 0x47 as the frame
            // separator, repeating every 188 bytes. It is unlikely to find that pattern in
            // TypeScript source, so tslint ignores files with the specific pattern.
            console.warn(`${file}: ignoring MPEG transport stream`);
            return;
        }
    } finally {
        fs.closeSync(fd);
    }

    const contents = fs.readFileSync(file, "utf8");
    const configuration = findConfiguration(possibleConfigAbsolutePath, file);

    const linter = new Linter(file, contents, {
        configuration,
        formatter: argv.t,
        formattersDirectory: argv.s,
        rulesDirectory: argv.r,
    }, program);

    const lintResult = linter.lint();

    if (argv.x !== "none") {
        // Filter by severity and fixes
        let severities = argv.x.split(",");
        let fixFailures: RuleFailure[] = lintResult.failures.filter(failure =>
            failure.hasSeverity(severities) && failure.getFixCount() > 0);

        switch (argv.m) {
            default:
            case "interactive":
                fixInteractive(file, contents, fixFailures);
                break;
            case "patch":
                fixPatch(file, contents, fixFailures);
                break;
            case "copy":
                fixCopy(file, contents, fixFailures);
                break;
            case "direct":
                fixDirect(file, contents, fixFailures);
                break;
        }
    }

    if (lintResult.failureCount > 0) {
        outputStream.write(lintResult.output, () => {
            process.exit(argv.force ? 0 : 2);
        });
    }
};

// Create parent direcotries
function mkdirParents(baseDir: string, dir: string) {
    if (dir === "." || fs.existsSync(path.join(baseDir, dir))) {
        return;
    } else {
        mkdirParents(baseDir, path.dirname(dir));
        fs.mkdirSync(path.join(baseDir, dir));
    }
}

// if both files and tsconfig are present, use files
let files = argv._;
let program: ts.Program;

if (argv.project != null) {
    if (!fs.existsSync(argv.project)) {
        console.error("Invalid option for project: " + argv.project);
        process.exit(1);
    }
    program = Linter.createProgram(argv.project, path.dirname(argv.project));
    if (files.length === 0) {
        files = Linter.getFileNames(program);
    }
    if (argv["type-check"]) {
        // if type checking, run the type checker
        const diagnostics = ts.getPreEmitDiagnostics(program);
        if (diagnostics.length > 0) {
            const messages = diagnostics.map((diag) => {
                // emit any error messages
                let message = ts.DiagnosticCategory[diag.category];
                if (diag.file) {
                    const {line, character} = diag.file.getLineAndCharacterOfPosition(diag.start);
                    message += ` at ${diag.file.fileName}:${line + 1}:${character + 1}:`;
                }
                message += " " + ts.flattenDiagnosticMessageText(diag.messageText, "\n");
                return message;
            });
            throw new Error(messages.join("\n"));
        }
    } else {
        // if not type checking, we don't need to pass in a program object
        program = undefined;
    }
}

for (const file of files) {
    glob.sync(file, { ignore: argv.e }).forEach((file) => processFile(file, program));
}
