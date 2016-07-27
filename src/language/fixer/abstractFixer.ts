import {RuleFailure} from "../rule/rule";
import {FixResult, IFixer} from "./fixer";

export abstract class AbstractFixer implements IFixer {
    public abstract apply(fileName: string, source: string, failures: RuleFailure[]): FixResult;
}
