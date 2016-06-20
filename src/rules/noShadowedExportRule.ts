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

import * as ts from "typescript";
import * as Lint from "../lint";

export class Rule extends Lint.Rules.TypedRule {
    /* tslint:disable:object-literal-sort-keys */
    public static metadata: Lint.IRuleMetadata = {
        ruleName: "no-shadowed-export",
        description: "A variable exported from a dependency cannot be shadowed by a variable exported with the same name.",
        optionsDescription: "Not configurable.",
        options: null,
        optionExamples: ["true"],
        type: "functionality",
    };
    /* tslint:enable:object-literal-sort-keys */

    public static SHADOWED_FAILURE = " exported from here is shadowed";

    public applyWithProgram(sourceFile: ts.SourceFile, program: ts.Program): Lint.RuleFailure[] {
        return this.applyWithWalker(new NoShadowedExportRuleWalker(sourceFile, this.getOptions(), program));
    }
}

class NoShadowedExportRuleWalker extends Lint.ProgramAwareRuleWalker {
    /*
    private exports: {string: boolean};

    constructor(sourceFile: ts.SourceFile, options: Lint.IOptions, program: ts.Program) {
        super(sourceFile, options, program);

        exports = {};
        const exportList = this.getExports(sourceFile);
        exportList.forEach(e => exports[e.name] = true);
        let sources = this.getProgram().getSourceFiles();
        for (const source of sources) {
            console.log(source.fileName, source.path);
        }

        const info = ts.preProcessFile(sourceFile.getFullText(), true, true);
        console.log("Imported");
        info.importedFiles.forEach(f => console.log(f.fileName));
    }

    public visitExportDeclaration(node: ts.ExportDeclaration) {
        console.log("Export declaration");
        if (node.moduleSpecifier.kind === ts.SyntaxKind.StringLiteral) {
            let loc = node.moduleSpecifier as ts.StringLiteral;
            let externalSource = this.getProgram().getSourceFile(loc.text);
            const exportList = this.getExports(externalSource);

            // make sure there are no conflicts
            exportList.forEach(e => {
                if (exports[e.name]) {
                    this.addFailure(this.createFailure(node.getStart(),
                        node.getWidth(), e.name + Rule.SHADOWED_FAILURE));
                } else {
                    exports[e.name] = true;
                }
            });
        }

        super.visitExportDeclaration(node);
    }

    private getExports(sourceFile: ts.SourceFile) {
        const tc = this.getTypeChecker();
        return tc.getSymbolsInScope(sourceFile, ts.SymbolFlags.Export);
    }
    */
}
