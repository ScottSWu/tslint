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

import * as fs from "fs";
import * as path from "path";
import {camelize} from "underscore.string";

const moduleDirectory = path.dirname(module.filename);
const CORE_FIXERS_DIRECTORY = path.resolve(moduleDirectory, ".", "fixers");

export function findFixer(name: string, fixersDirectory?: string) {
    if (typeof name === "function") {
        return name;
    }

    const camelizedName = camelize(`${name}Fixer`);

    // first check for core fixers
    let Fixer = loadFixer(CORE_FIXERS_DIRECTORY, camelizedName);
    if (Fixer != null) {
        return Fixer;
    }

    // then check for rules within the first level of rulesDirectory
    if (fixersDirectory) {
        Fixer = loadFixer(fixersDirectory, camelizedName);
        if (Fixer) {
            return Fixer;
        }
    }

    // else try to resolve as module
    return loadFixerModule(name);
}

function loadFixer(...paths: string[]) {
    const fixerPath = paths.reduce((p, c) => path.join(p, c), "");
    const fullPath = path.resolve(moduleDirectory, fixerPath);

    if (fs.existsSync(`${fullPath}.js`)) {
        const fixerModule = require(fullPath);
        return fixerModule.Fixer;
    }

    return undefined;
}

function loadFixerModule(name: string) {
    let src: string;
    try {
        src = require.resolve(name);
    } catch (e) {
        return undefined;
    }
    return require(src).Fixer;
}
