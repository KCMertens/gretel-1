import {Component, OnInit, ViewChild} from '@angular/core';
import {Crumb} from "../../components/breadcrumb-bar/breadcrumb-bar.component";
import {HttpClient, HttpHeaders} from '@angular/common/http';
import {
    GlobalState,
    Step,
    XpathInputStep,
    ResultStep,
    SelectTreebankStep,
    TreebankSelection
} from "../multi-step-page/steps";
import {Transition, Transitions, IncreaseTransition, DecreaseTransition} from '../multi-step-page/transitions'
import {TreebankService} from "../../services/treebank.service";
import {ResultsService} from "../../services/results.service";
import {MultiStepPageComponent} from "../multi-step-page/multi-step-page.component";
import {ActivatedRoute, Router} from "@angular/router";

/**
 * The xpath search component is the main component for the xpath search page. It keeps track of global state of the page
 * It uses steps and transitions to determine the next state.
 */
@Component({
    selector: 'grt-x-path-search',
    templateUrl: './xpath-search.component.html',
    styleUrls: ['./xpath-search.component.scss']
})
export class XpathSearchComponent extends MultiStepPageComponent {
    steps = [
        new XpathInputStep(0),
        new SelectTreebankStep(1),
        new ResultStep(2),
    ];

    //All the components. used to call functions on.
    @ViewChild('xpathInput')
    xpathInputComponent;
    @ViewChild('selectTreebanksComponentRef')
    selectTreebankComponent;
    @ViewChild('hiddenForm')
    form;
    @ViewChild('resultComponentRef')
    resultComponent;


    constructor(private http: HttpClient, private treebankService: TreebankService, private resultsService: ResultsService, private route: ActivatedRoute, private router: Router) {
        super();
    }


    initializeCrumbs() {
        this.crumbs = [
            {
                name: "XPath",
                number: 0,
            },
            {
                name: "Treebanks",
                number: 1,
            },
            {
                name: "Results",
                number: 2,
            },
            {
                name: "Analysis",
                number: 3,
            },
        ];

    }


    initializeComponents() {
        this.components = [
            this.xpathInputComponent,
            this.selectTreebankComponent,
            this.resultComponent

        ]
    }


    getGlobalStateFromUrl() {
        // TO make sure there is no compile time error
        let temp: any = this.route
        return temp.queryParams._value
    }

    queryParamsToGlobalState(queryParams: any) {


        let step = this.getStepFromNumber(queryParams.currentStep);
        return {
            selectedTreebanks: queryParams.selectedTreebanks ? JSON.parse(queryParams.selectedTreebanks) : undefined,
            currentStep: step,
            xpath: queryParams.xpath || '//node',

            valid: false,
            loading: false

        }

    }

    /**
     * Sets
     * @param boolean
     */
    setValid(valid: boolean) {
        this.globalState.valid = valid
    }


    /**
     * Updates the selected treebanks with the given selection
     * @param selectedTreebanks the new treebank selection
     */
    updateSelected(selectedTreebanks: TreebankSelection) {
        this.globalState.selectedTreebanks = selectedTreebanks;
        this.writeStateToUrl();
    }

    updateXPath(xpath: string) {
        this.globalState.xpath = xpath;
        this.writeStateToUrl();
    }

    getStepFromNumber(n: number) {
        if (n) {
            return this.steps[n]
        } else {
            return this.steps[0]
        }

    }

    initializeGlobalState() {


        let globalState = this.getGlobalStateFromUrl();
        let state = this.queryParamsToGlobalState(globalState);
        // Fill in the global state

        this.globalState = state
    }

    initializeConfiguration() {
        this.configuration = {
            steps: this.steps

        };
    }


    initializeTransitions() {
        this.transitions = new Transitions([new IncreaseTransition(this.configuration.steps), new DecreaseTransition(this.configuration.steps)]);
    }


    stateToString(state: GlobalState) {
        return {
            'currentStep': state.currentStep.number,
            'xpath': state.xpath,
            'selectedTreebanks': JSON.stringify(state.selectedTreebanks)
        }
    }


    updateGlobalState(state: GlobalState) {
        this.globalState = state;
        this.writeStateToUrl();
    }

    writeStateToUrl() {
        let state = this.stateToString(this.globalState);
        this.router.navigate([], {
            relativeTo: this.route,
            queryParams: state,
            skipLocationChange: false
        })
    }
}
