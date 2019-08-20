import { Component, Input, OnDestroy, Output, EventEmitter, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { SafeHtml } from '@angular/platform-browser';

import { combineLatest as observableCombineLatest, BehaviorSubject, Subscription, Observable, merge, combineLatest } from 'rxjs';
import {
    filter,
    debounceTime,
    distinctUntilChanged,
    switchMap,
    map,
    startWith,
    materialize,
    endWith,
    shareReplay,
    flatMap,
    take
} from 'rxjs/operators';

import { ValueEvent } from 'lassy-xpath/ng';
import { ClipboardService } from 'ngx-clipboard';

import {
    DownloadService,
    FilterValue,
    Hit,
    MetadataValueCounts,
    ResultsService,
    TreebankService,
    mapTreebanksToSelectionSettings,
    FilterValues,
    FilterByXPath,
    SelectedTreebanks,
    SearchResults,
    StateService
} from '../../../services/_index';
import { Filter } from '../../filters/filters.component';
import { TreebankMetadata } from '../../../treebank';
import { StepComponent } from '../step.component';
import { NotificationKind } from 'rxjs/internal/Notification';
import { GlobalState, StepType } from '../../../pages/multi-step-page/steps';

const DebounceTime = 200;

type HitWithOrigin = Hit & {
    provider: string;
    corpus: string;
    componentDisplayName: string;
};

interface ResultsInfo {
    [provider: string]: {
        [corpus: string]: {
            hidden: boolean;
            loading: boolean;
            hits: HitWithOrigin[];
            error?: HttpErrorResponse;
            hiddenComponents: {
                [componentId: string]: boolean
            }
        }
    };
}

@Component({
    selector: 'grt-results',
    templateUrl: './results.component.html',
    styleUrls: ['./results.component.scss']
})
export class ResultsComponent extends StepComponent<GlobalState> implements OnInit, OnDestroy {
    private xpathSubject = new BehaviorSubject<string>(undefined);
    private filterValuesSubject = new BehaviorSubject<FilterValues>({});

    /** The hits and their visibility status */
    public info: ResultsInfo = {};
    public hiddenHits = 0;
    public filteredResults: Hit[] = [];
    public stepType = StepType.Results;

    @Input('xpath')
    public set xpath(value: string) { this.xpathSubject.next(value); }
    public get xpath(): string { return this.xpathSubject.value; }
    @Output()
    public changeXpath = new EventEmitter<string>();

    @Input('filterValues')
    public set filterValues(v: FilterValues) {
        const values = Object.values(v);
        this.filterValuesSubject.next(v);
        this.filterXPaths = values.filter((val): val is FilterByXPath => val.type === 'xpath');
        this.activeFilterCount = values.length;
    }
    public get filterValues(): FilterValues { return this.filterValuesSubject.value; }
    @Output()
    public changeFilterValues = new EventEmitter<FilterValues>();


    @Input()
    public retrieveContext = false;
    @Output()
    public changeRetrieveContext = new EventEmitter<boolean>();


    @Input()
    public inputSentence: string = null;

    @Output()
    public prev = new EventEmitter();

    @Output()
    public next = new EventEmitter();

    public loading = true;

    public xpathCopied = false;
    public customXPath: string;
    public validXPath = true;
    public isModifyingXPath = false;
    public activeFilterCount = 0;

    public filters: Filter[] = [];

    /**
     * Filters on node properties created in the analysis component
     */
    public filterXPaths: FilterByXPath[] = [];

    // Xml tree displaying (of a result)
    public treeXml?: string;
    public loadingTree = false;
    public treeSentence?: SafeHtml;

    public columns = [
        { field: 'number', header: '#', width: '5%' },
        { field: 'fileId', header: 'ID', width: '20%' },
        { field: 'componentDisplayName', header: 'Component', width: '20%' },
        { field: 'highlightedSentence', header: 'Sentence', width: 'fill' },
    ];

    private subscriptions: Subscription[];

    constructor(private downloadService: DownloadService,
        private clipboardService: ClipboardService,
        private resultsService: ResultsService,
        private treebankService: TreebankService,
        stateService: StateService<GlobalState>
    ) {
        super(stateService);
        this.changeValid = new EventEmitter();
    }

    ngOnInit() {
        // intermediate streams
        const treebankSelections$ = this.treebankService.treebanks.pipe(
            debounceTime(1000),
            map(v => mapTreebanksToSelectionSettings(v.state)),
            shareReplay(1), // this stream is used as input in multiple others, no need to re-run it for every subscription.
        );
        const filterValues$ = this.filterValuesSubject.pipe( // the user-selected values
            debounceTime(1000),
            map(v => Object.values(v)),
            shareReplay(1),
        );
        // the metadata properties for the selected treebanks
        const metadataProperties$ = this.createMetadataPropertiesStream();
        // the values for the properties
        const metadataCounts$ = this.createMetadataCountsStream(treebankSelections$, this.xpathSubject, filterValues$);

        // subscribed streams
        const metadataFilters$ = this.createMetadataFiltersStream(metadataProperties$, metadataCounts$);
        const results$ = this.createResultsStream(treebankSelections$, this.xpathSubject, filterValues$);

        this.subscriptions = [
            metadataFilters$.subscribe(filters => this.filters = filters),

            // When different treebanks are selected, clear our results and make entries for the new banks
            treebankSelections$.subscribe(selections => {
                const newInfo = selections.reduce((info, s) => {
                    const oldCorpusInfo = this.info[s.provider] ? this.info[s.provider][s.corpus] : undefined;

                    const p = info[s.provider] = info[s.provider] || {};
                    p[s.corpus] = {
                        loading: true,
                        hidden: oldCorpusInfo ? oldCorpusInfo.hidden : false,
                        hits: [],
                        // Add all searched components immediately, so the info can be used in downloadResults()
                        hiddenComponents: s.components.reduce((hidden, comp) => {
                            hidden[comp] = !!(oldCorpusInfo && oldCorpusInfo.hiddenComponents[comp]);
                            return hidden;
                        }, {} as { [componentId: string]: boolean }),
                    };
                    return info;
                }, {} as ResultsInfo);
                this.info = newInfo;
            }),

            results$.subscribe(r => {
                if (typeof r === 'string') {
                    switch (r) {
                        case 'start': {
                            // info reset on selected treebanks changing (see below).
                            this.loading = true;
                            this.filteredResults = [];
                            this.hiddenHits = 0;
                            break;
                        }
                        case 'finish': {
                            this.loading = false;
                            break;
                        }
                    }
                } else {
                    switch (r.result.kind) {
                        case NotificationKind.COMPLETE: {
                            // treebank has finished loading
                            const i = this.info[r.provider][r.corpus];
                            i.loading = false;
                            break;
                        }
                        case NotificationKind.ERROR: {
                            // treebank has errored out!
                            const i = this.info[r.provider][r.corpus];
                            i.loading = false;
                            i.error = r.result.error;
                            break;
                        }
                        case NotificationKind.NEXT: {
                            // some new hits!
                            const i = this.info[r.provider][r.corpus];
                            i.hits.push(...r.result.value.hits);
                            if (!i.hidden) {
                                const filtered = i.hidden ? [] : r.result.value.hits.filter(h => !i.hiddenComponents[h.component]);
                                this.filteredResults.push(...filtered);
                                this.hiddenHits += filtered.length - r.result.value.hits.length;
                            }
                            break;
                        }
                    }
                }
            }),
        ];
    }

    ngOnDestroy() {
        for (const subscription of this.subscriptions) {
            subscription.unsubscribe();
        }
    }

    /** Show a tree of the given xml file, needs to contact the server as the result might not contain the entire tree */
    async showTree(result: HitWithOrigin) {
        this.treeXml = undefined;
        this.loadingTree = true;
        this.treeSentence = result.highlightedSentence;

        try {
            const treeXml = await this.resultsService.highlightSentenceTree(
                result.provider,
                result.corpus,
                result.component,
                result.database,
                result.fileId,
                result.nodeIds,
            );
            this.treeXml = treeXml;
        } catch (e) {
            this.treeSentence = undefined;
            this.treeXml = undefined;
            this.loadingTree = false;

            console.warn(`Error retrieving tree in ${result.provider}:${result.corpus}:${result.component}:${result.fileId}`);
        }

        this.loadingTree = false;
    }

    public deleteFilter(filterValue: FilterValue) {
        const { [filterValue.field]: _, ...updated } = this.filterValues;
        this.filterChange(updated);
    }

    public downloadResults() {
        const r = [] as Array<{
            xpath: string,
            components: string[],
            provider: string,
            corpus: string,
            hits: Hit[]
        }>;

        Object.entries(this.info).forEach(([provider, treebanks]) => {
            Object.entries(treebanks).forEach(([corpus, settings]) => {
                r.push({
                    components: Object.keys(settings.hiddenComponents),
                    corpus,
                    hits: settings.hits,
                    provider,
                    xpath: this.xpath
                });
            });
        });

        this.downloadService.downloadResults(r);
    }

    public downloadXPath() {
        this.downloadService.downloadXPath(this.xpath);
    }


    public downloadFilelist() {
        const fileNames = this.getFileNames();
        this.downloadService.downloadFilelist(fileNames, 'filelist');
    }

    /**
     * Returns the unique file names from the filtered results sorted on name.
     */
    public getFileNames() {
        return Object.values(this.info)
            .flatMap(provider => Object.values(provider))
            .filter(c => !c.hidden) // filter hidden banks
            .flatMap(c => c.hits.filter(h => !c.hiddenComponents[h.component])) // extract hits, filter hidden components
            .map(c => c.fileId) // extract names
            .sort();
    }

    public copyXPath() {
        if (this.clipboardService.copyFromContent(this.xpath)) {
            this.xpathCopied = true;
            setTimeout(() => {
                this.xpathCopied = false;
            }, 5000);
        }
    }

    public hideComponents({ provider, corpus, components }: { provider: string, corpus: string, components: string[] }) {
        const c = this.info[provider][corpus];
        Object.keys(c.hiddenComponents).forEach(comp => {
            c.hiddenComponents[comp] = false;
        });
        components.forEach(comp => c.hiddenComponents[comp] = true);
        this.filterHits();
    }

    public filterChange(filterValues: FilterValues) {
        this.changeFilterValues.next(filterValues);
    }

    public print() {
        (window as any).print();
    }

    public editXPath() {
        this.isModifyingXPath = true;
    }

    public updateXPath() {
        if (this.validXPath) {
            this.changeXpath.next(this.customXPath);
            this.isModifyingXPath = false;
        }
    }

    public resetXPath() {
        this.isModifyingXPath = false;
    }

    public addFiltersXPath() {
        this.customXPath = this.resultsService.createFilteredQuery(
            this.xpath || this.customXPath,
            Object.values(this.filterValues));
        this.filterChange({});

        this.changeXpath.next(this.customXPath);
    }

    public changeCustomXpath(valueEvent: ValueEvent) {
        this.validXPath = !valueEvent.error;
        if (this.validXPath) {
            this.customXPath = valueEvent.xpath;
        }
    }

    toggleContext() {
        this.changeRetrieveContext.emit(!this.retrieveContext);
    }

    // ----

    /** Extracts metadata fields from the selected treebanks */
    private createMetadataPropertiesStream(): Observable<TreebankMetadata[]> {
        return this.treebankService.treebanks.pipe(
            map(v => v.state),
            map(providers => {
                return Object.values(providers)
                    .flatMap(banks => Object.values(banks))
                    .filter(bank => bank.treebank.selected)
                    .flatMap(bank => bank.metadata);
            })
        );
    }

    /** Retrieves metadata counts based on selected banks and filters */
    private createMetadataCountsStream(
        banksInput: Observable<SelectedTreebanks>,
        xpathInput: Observable<string>,
        filterValueInput: Observable<FilterValue[]>
    ): Observable<MetadataValueCounts> {
        return observableCombineLatest(
            banksInput,
            xpathInput,
            filterValueInput
        )
            .pipe(
                debounceTime(DebounceTime),
                distinctUntilChanged(),
                switchMap(([banks, xpath, filterValues]) =>
                    // TODO: change to stream-based approach, so we can cancel http requests?
                    // TODO: error handling, just ignore that metadata?
                    // would need to check if requests are actually cancelled in the angular http service

                    // get counts for all selected
                    Promise.all(banks.map(({ provider, corpus, components }) =>
                        this.resultsService.metadataCounts(
                            xpath,
                            provider,
                            corpus,
                            components,
                            filterValues
                        ).catch((): MetadataValueCounts => {
                            return {};
                        }))
                    )
                        // deep merge all results into a single object
                        .then((c: MetadataValueCounts[]) => {
                            return c.reduce<MetadataValueCounts>((counts, cur) => {
                                Object.keys(cur)
                                    .forEach(fieldName => {
                                        const field = counts[fieldName] = counts[fieldName] || {};
                                        Object.entries(cur[fieldName])
                                            .forEach(([metadataValue, valueCount]) => {
                                                field[metadataValue] = (field[metadataValue] || 0) + valueCount;
                                            });
                                    });

                                return counts;
                            }, {});
                        })
                ),
            );
    }

    /** Transforms metadata fields along with their values into filter definitions */
    private createMetadataFiltersStream(
        metadataFieldsInput: Observable<TreebankMetadata[]>,
        metadataValuesInput: Observable<MetadataValueCounts>,
    ): Observable<Filter[]> {
        return combineLatest(
            metadataFieldsInput,
            metadataValuesInput
        )
            .pipe(
                debounceTime(100), // lots of values bouncing around during initialization
                map(([fields, counts]) => {
                    return fields
                        .filter(field => field.show)
                        .map<Filter>(item => {
                            const options: string[] = [];
                            if (item.field in counts) {
                                for (const key of Object.keys(counts[item.field])) {
                                    // TODO: show the frequency (the data it right here now!)
                                    options.push(key);
                                }
                            }

                            // use a dropdown instead of checkboxes when there
                            // are too many options
                            if (item.facet === 'checkbox' && options.length > 8) {
                                item.facet = 'dropdown';
                            }

                            return {
                                field: item.field,
                                dataType: item.type,
                                filterType: item.facet,
                                minValue: item.minValue,
                                maxValue: item.maxValue,
                                options
                            };
                        });
                })
            );
    }

    /**
     * Gets up-to-date results for all selected treebanks
     *
     * Three types of values are emitted:
     *  'start': indicates a search/new result set is being started
     *  'finish': all treebanks finished searching
     *  @type {Notification} either a set of results, a finished message, or an error message within a selected treebank
     */
    private createResultsStream(
        selectedTreebanksInput: Observable<SelectedTreebanks>,
        xpathInput: Observable<string>,
        filterValueInput: Observable<FilterValue[]>
    ) {
        return observableCombineLatest(
            selectedTreebanksInput,
            xpathInput,
            filterValueInput
        ).pipe(
            filter((values) => values.every(value => value != null)),
            debounceTime(DebounceTime),
            distinctUntilChanged(),
            switchMap(([selectedTreebanks, xpath, filterValues]) => {
                // create a request for each treebank
                const resultStreams = selectedTreebanks.map(({ provider, corpus, components }) => {
                    // create the basic request, without error handling
                    const base = this.resultsService.getAllResults(
                        xpath,
                        provider,
                        corpus,
                        components,
                        this.retrieveContext,
                        false,
                        filterValues,
                        []
                    );

                    return base.pipe(
                        // expand hits with the corpus and provider
                        // (so we can use this later in the interface)
                        // This mapping is skipped if the query returns an error
                        flatMap(async (result: SearchResults) => {
                            const treebank = (await this.treebankService.treebanks.pipe(take(1)).toPromise()).state[provider][corpus];
                            return {
                                ...result,
                                hits: result.hits.map(hit => ({
                                    ...hit,
                                    provider,
                                    corpus,
                                    componentDisplayName: treebank.components[hit.component].title
                                }))
                            };
                        }),

                        // (This will run even if base receives an error)
                        // Capture errors and send them on as a regular events
                        // This is required because this only one stream in a set of multiple result streams
                        // that will eventually be merged together
                        // and we don't want that merged stream to abort when one of them throws an error
                        materialize(),

                        // We've already attached the provider and corpus to the results,
                        // but if an error happens, or we're done requesting results,
                        // that message doesn't contain that info yet, so attach it
                        map(result => ({
                            result,
                            provider,
                            corpus
                        })),
                    );
                });

                // join all results, and wrap the entire sequence in a start and end message so
                // we know what's happening and can update spinners etc.
                return merge(...resultStreams).pipe(
                    startWith('start'),
                    endWith('finish'),
                );
            }),
        );
    }

    /**
     * Filter out the hits which are part of hidden components or banks and update the hiddenHits counter
     */
    private filterHits() {
        this.hiddenHits = 0;
        this.filteredResults =
            Object.values(this.info)
                .flatMap(provider => Object.values(provider))
                .filter(corpus => {
                    if (corpus.hidden) {
                        this.hiddenHits += corpus.hits.length;
                    }
                    return !corpus.hidden;
                })
                .flatMap(q => {
                    const filtered = q.hits.filter(h => !q.hiddenComponents[h.component]);
                    this.hiddenHits += q.hits.length - filtered.length;
                    return filtered;
                });
    }

    public getWarningMessage() {
        // Should never show warning
    }
}
