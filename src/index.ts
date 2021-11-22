import "lib/polyfill";
import { postwoman, setVar, getVar } from "postwoman";
import {
    TspClient,
    Query,
    TspClientResponse,
    Trace,
    Experiment,
    OutputDescriptor,
    QueryHelper,
    GenericResponse,
    EntryModel,
    Entry,
} from "tsp-typescript-client";
import inquirer from "inquirer";

const TRACE_UUIDS = `trace-uuids`;
const EXP_UUID = `exp-uuid`;
const EXP_START = `exp-start`;
const EXP_END = `exp-end`;
const EXP_OUPUTS = `exp-outputs`;

const xy_cache = {} as {
    output: string;
    entries: number[];
};

const tsp_client = new TspClient((getVar(`tsp-base-url`) as string) + `/tsp/api`);

postwoman({
    TSP: {
        TRACES: {
            "Get traces": {
                request: () => {
                    return tsp_client.fetchTraces();
                },
                postquest: (r) => {
                    const tmp = (r as TspClientResponse<Trace[]>).getModel();
                    if (Array.isArray(tmp))
                        setVar(
                            TRACE_UUIDS,
                            tmp.map((t) => t.UUID),
                        );
                    return Promise.resolve();
                },
            },
            "Import a trace": {
                body: {
                    name: `{{trace-name}}`,
                    uri: `{{trace-uri}}`,
                },
                request: function () {
                    return tsp_client.openTrace(new Query(this.body!));
                },
            },
        },
        Experiments: {
            "Get experiments": {
                request: () => {
                    return tsp_client.fetchExperiments();
                },
                postquest: (r: unknown) => {
                    const tmp = (r as TspClientResponse<Experiment[]>).getModel();
                    if (Array.isArray(tmp) && tmp.length > 0) {
                        return inquirer
                            .prompt([
                                {
                                    type: `list`,
                                    name: EXP_UUID,
                                    message: `Choose experiment for subsequent analyses`,
                                    choices: tmp.map((exp) => {
                                        return {
                                            name: `${exp.name} (${exp.UUID})`,
                                            value: exp,
                                        };
                                    }),
                                },
                            ])
                            .then((answers: { [EXP_UUID]: Experiment }) => {
                                setVar(EXP_UUID, answers[EXP_UUID].UUID);
                                setVar(EXP_START, answers[EXP_UUID].start.toString());
                                setVar(EXP_END, answers[EXP_UUID].end.toString());
                            })
                            .catch((e) => console.error(e));
                    }
                    return Promise.resolve();
                },
            },
            "Create new experiment": {
                body: {
                    name: `experiment`,
                    traces: `{{${TRACE_UUIDS}}}`,
                },
                request: function () {
                    return tsp_client.createExperiment(new Query(this.body!));
                },
            },
            "Get experiment's outputs": {
                request: () => {
                    return tsp_client.experimentOutputs(getVar(EXP_UUID) as string);
                },
                postquest: (r) => {
                    const tmp = (r as TspClientResponse<OutputDescriptor[]>).getModel();
                    if (Array.isArray(tmp)) setVar(EXP_OUPUTS, JSON.parse(JSON.stringify(tmp)));
                    return Promise.resolve();
                },
            },
            "Get XY tree": {
                quiet: true,
                body: {
                    requested_times: null,
                },
                prequest: function () {
                    this.body!.requested_times = [
                        BigInt(getVar(EXP_START) as string),
                        BigInt(getVar(EXP_END) as string),
                    ];
                    return Promise.resolve();
                },
                request: async function () {
                    const outputs = getVar(EXP_OUPUTS) as unknown as OutputDescriptor[];
                    const answer = (await inquirer.prompt([
                        {
                            type: `list`,
                            name: EXP_OUPUTS,
                            message: `Choose experiment for subsequent analyses`,
                            choices: outputs.flatMap((o) =>
                                o.type === `TREE_TIME_XY` ? [{ name: o.name, value: o.id }] : [],
                            ),
                        },
                    ])) as { [EXP_OUPUTS]: string };
                    xy_cache.output = answer[EXP_OUPUTS];
                    return tsp_client.fetchXYTree(
                        getVar(EXP_UUID) as string,
                        xy_cache.output,
                        new Query(this.body!),
                    );
                },
                postquest: (r) => {
                    const tmp = (r as TspClientResponse<GenericResponse<EntryModel<Entry>>>).getModel()
                        ?.model;
                    if (tmp) xy_cache.entries = tmp.entries.map((e) => e.id);
                    return Promise.resolve();
                },
            },
            "Get XY model": {
                quiet: true,
                request: () => {
                    if (!xy_cache.output) throw new Error(`No xy output selected`);
                    if (!xy_cache.entries) throw new Error(`No xy tree entries cached`);
                    return tsp_client.fetchXY(
                        getVar(EXP_UUID) as string,
                        xy_cache.output,
                        QueryHelper.selectionTimeQuery(
                            // copy-paste from thei-trace-ext
                            QueryHelper.splitRangeIntoEqualParts(
                                BigInt(getVar(EXP_START) as string),
                                BigInt(getVar(EXP_END) as string),
                                Math.floor(1500 * 0.85),
                            ),
                            xy_cache.entries,
                        ),
                    );
                },
            },
        },
    },
});
