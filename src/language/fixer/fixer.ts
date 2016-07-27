import {RuleFailure} from "../rule/rule";

export class Replacement {
    constructor(private start: number, private length: number, private text: string) {
    }

    public getStart() {
        return this.start;
    }

    public getLength() {
        return this.length;
    }

    public getEnd() {
        return this.start + this.length;
    }

    public getText() {
        return this.text;
    }

    public apply(content: string) {
        return content.substring(0, this.start) + this.text + content.substring(this.start + this.length);
    }
}

export class Fix {
    constructor(private ruleName: string, private description: string, private replacements: Replacement[]) {
    }

    public getRuleName() {
        return this.ruleName;
    }

    public getDescription() {
        return this.description;
    }

    public getReplacements() {
        return this.replacements;
    }

    public apply(content: string) {
        // sort replacements in reverse so that diffs are properly applied
        this.replacements.sort((a, b) => b.getEnd() - a.getEnd());
        return this.replacements.reduce((text, r) => r.apply(text), content);
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
