process.on(`unhandledRejection`, (reason, promise) => {
    console.error(`Unhandled Rejection reason:`);
    console.error(reason);
    console.error(`Unhandled Rejection at:`);
    console.error(promise);
    process.exit(1);
});
import "lib/polyfill";
import { postalien, setVar, getVar } from "postalien";
import {
    TspClient,
    Query,
    TspClientResponse,
    Experiment,
    OutputDescriptor,
    QueryHelper,
    GenericResponse,
    EntryModel,
    Entry,
} from "tsp-typescript-client";
import inquirer from "inquirer";
import fetch from "node-fetch";

const EXP_UUID = `exp-uuid`;
const EXP_START = `exp-start`;
const EXP_END = `exp-end`;
const EXP_OUPUTS = `exp-outputs`;

const xy_cache = {} as {
    output: string;
    entries: number[];
};

const trace_server_url = (getVar(`tsp-base-url`) as string) + `/tsp/api`;
const tsp_client = new TspClient(trace_server_url);

const logIfError = (r: TspClientResponse<unknown>) => {
    if (!r.isOk()) console.error(JSON.stringify(r, null, 4));
    return r;
};

postalien({
    TSP: {
        TRACES: {
            "Create experiment": {
                request: function () {
                    return fetch(`${trace_server_url}/dev/createExperimentsFromTraces`, { method: `POST` });
                },
            },
        },
        Experiments: {
            "Get experiments": {
                quiet: true,
                request: async () => {
                    return logIfError(await tsp_client.fetchExperiments());
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
            "Get experiment's outputs": {
                quiet: true,
                request: async () => {
                    return logIfError(
                        await tsp_client.experimentOutputs(getVar(EXP_UUID) as string),
                    );
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
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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
                    return logIfError(
                        await tsp_client.fetchXYTree(
                            getVar(EXP_UUID) as string,
                            xy_cache.output,
                            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                            new Query(this.body!),
                        ),
                    );
                },
                postquest: (r) => {
                    const tmp = (
                        r as TspClientResponse<GenericResponse<EntryModel<Entry>>>
                    ).getModel()?.model;
                    if (tmp) xy_cache.entries = tmp.entries.map((e) => e.id);
                    return Promise.resolve();
                },
            },
            "Get XY model": {
                quiet: true,
                request: async () => {
                    if (!xy_cache.output) throw new Error(`No xy output selected`);
                    if (!xy_cache.entries) throw new Error(`No xy tree entries cached`);
                    return logIfError(
                        await tsp_client.fetchXY(
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
                        ),
                    );
                },
            },
        },
    },
});
