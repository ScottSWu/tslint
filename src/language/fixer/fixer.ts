import {RuleFailure} from "../rule/rule";

export class Replacement {
    public static compare(a: Replacement, b: Replacement) {
        if (a.end === b.end) {
            return b.priority - a.priority;
        }
        return b.end - a.end;
    }

    constructor(private innerStart: number, private innerLength: number, private innerText: string, private innerPriority: number = 0) {
    }

    get start() {
        return this.innerStart;
    }

    get length() {
        return this.innerLength;
    }

    get end() {
        return this.innerStart + this.innerLength;
    }

    get priority() {
        return this.innerPriority;
    }

    get text() {
        return this.innerText;
    }

    public apply(content: string) {
        return content.substring(0, this.start) + this.text + content.substring(this.start + this.length);
    }
}

export class Fix {
    public static applyAll(content: string, fixes: Fix[]) {
        // accumulate replacements
        let replacements: Replacement[] = [];
        for (const fix of fixes) {
            replacements = replacements.concat(fix.replacements);
        }
        // sort in reverse so that diffs are properly applied
        replacements.sort(Replacement.compare);
        return replacements.reduce((text, r) => r.apply(text), content);
    }

    constructor(private innerRuleName: string, private innerReplacements: Replacement[]) {
    }

    get ruleName() {
        return this.innerRuleName;
    }

    get replacements() {
        return this.innerReplacements;
    }

    public apply(content: string) {
        // sort replacements in reverse so that diffs are properly applied
        this.innerReplacements.sort(Replacement.compare);
        return this.innerReplacements.reduce((text, r) => r.apply(text), content);
    }
}

export interface IFixer {
    apply(fileName: string, source: string, failures: RuleFailure[]): FixResult;
}

export interface FixResult {
    // Name of the source file the fixes were applied to
    fileName: string;
    // Changed content after fixes were applied
    content: string;
    // Resulting message from fixing
    message: string;
    // Array of fixes that failed to be applied
    remaining: Fix[];
}
