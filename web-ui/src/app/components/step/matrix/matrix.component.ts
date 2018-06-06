import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { AlpinoService } from '../../../services/_index';
import { StepComponent } from '../step.component';
import { ValueEvent } from 'lassy-xpath/ng';

@Component({
    selector: 'grt-matrix',
    templateUrl: './matrix.component.html',
    styleUrls: ['./matrix.component.scss']
})
export class MatrixComponent extends StepComponent implements OnInit {
    @Input('attributes')
    public set attributes(values: string[]) {
        this.tokenValues = values.map(value => this.options.find(o => o.value == value));
    }

    public get attributes() {
        return this.tokenValues.map(t => t.value);
    }

    @Input('tokens')
    public set tokens(value: string[]) {
        this.indexedTokens = value.map((value, index) => { return { value, index } });
    }
    public get tokens() {
        return this.indexedTokens.map(t => t.value);
    }

    @Input()
    public subTreeXml: string;
    @Input('xml')
    public xml: string;
    @Input()
    public xpath: string;
    @Input()
    public isCustomXPath: boolean;

    @Output()
    public onChangeValue = new EventEmitter<MatrixSettings>();

    public warning: boolean;
    public respectOrder;
    public retrieveContext;
    public ignoreTopNode;

    public indexedTokens: { value: string, index: number }[];
    public showAdvanced: boolean;
    /**
     * If an advanced option has been selected, the toggle will be disabled.
     */
    public alwaysAdvanced: boolean;

    public tokenValues: Part[];

    public options: Part[] = [
        {
            label: "Word",
            description: "The exact word form (also known as token).",
            value: "token",
            advanced: false
        },
        {
            label: "Word (case-sensitive)",
            description: "The word form must match exactly, including the casing.",
            value: "cs",
            advanced: true
        },
        {
            label: "Lemma",
            description: "Word form that generalizes over inflected forms. For example: gaan is the lemma of ga, gaat, gaan, ging, gingen, and gegaan.",
            value: "lemma",
            advanced: false
        },
        {
            label: "Word class",
            description: "Short Dutch part-of-speech tag. The different tags are: n (noun), ww (verb), adj (adjective), lid (article), vnw (pronoun), vg (conjunction), bw (adverb), tw (numeral), vz (preposition), tsw (interjection), spec (special token), and let (punctuation).",
            value: "pos",
            advanced: false
        },
        {
            label: "Detailed word class",
            description: "Long part-of-speech tag. For example: N(soort,mv,basis), WW(pv,tgw,ev), VNW(pers,pron,nomin,vol,2v,ev).",
            value: "postag",
            advanced: true
        },
        {
            label: "Optional",
            description: "The word will be ignored in the search instruction. It may be included in the results, but it is not required that it is present.",
            value: "na",
            advanced: false
        },
        {
            label: "Exclude",
            description: "The word class and the dependency relation will be explicitly excluded from the results.",
            value: "not",
            advanced: true
        }];

    constructor(private alpinoService: AlpinoService) {
        super();
    }

    ngOnInit() {
    }

    public setTokenPart(tokenIndex: number, part: Part) {
        if (part.advanced) {
            this.alwaysAdvanced = true;
        }
        this.tokenValues[tokenIndex] = part;
        if (!part.advanced) {
            this.alwaysAdvanced = !!this.tokenValues.find(value => value.advanced);
        }
        this.emitChange();
    }

    public emitChange(customXPath: string = null) {
        this.onChangeValue.next({
            attributes: this.tokenValues.map(t => t.value),
            retrieveContext: this.retrieveContext,
            customXPath,
            respectOrder: this.respectOrder,
            tokens: [...this.tokens],
            ignoreTopNode: this.ignoreTopNode
        });
        this.updateValidity();
    }

    public customXPathChanged(valueEvent: ValueEvent) {
        this.valid = !valueEvent.error;
        this.emitChange(valueEvent.xpath);
    }

    public editXPath() {
        this.emitChange(this.xpath);
    }

    public resetXPath() {
        this.valid = true;
        this.emitChange();
    }

    public updateValidity() {
        this.onChangeValid.emit(this.valid);
    }

    public getValidationMessage() {
        this.warning = true;
    }
}

type Part = {
    label: string,
    description: string,
    value: string,
    advanced: boolean
}

export type MatrixSettings = {
    attributes: string[],
    customXPath: string,
    retrieveContext: boolean,
    respectOrder: boolean,
    tokens: string[],
    ignoreTopNode: boolean
}