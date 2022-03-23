import {CacheType, Collection, Interaction} from "discord.js";
import {readdirSync} from "fs";
import path, {format as formatPath} from "path";
import {ErrorMessage} from "../helpers/responses";
import {logger} from "../logger";
import {ButtonAction, ClientType, EventType} from "../types";

const handlers = new Collection<string, ButtonAction>();

const buttonHandlerModule: EventType = {
    eventName: "interactionCreate",
    once: false,
    execute: async (_: ClientType, intr: Interaction<CacheType>) => {
        if (!intr.isButton()) {
            return;
        }

        const prefix = intr.customId.split(";")[0];

        try {
            const action = await GetHandler(prefix);
            return action!.execute(intr);
        } catch (err) {
            logger.error(`Button Action ${prefix} failed: ${err}`);
            return intr.reply(ErrorMessage({ephemeral: true}));
        }
    },
};

const GetHandler = async (prefix: string): Promise<ButtonAction | null> => {
    const existing = handlers.get(prefix);
    if (existing) {
        return existing;
    }

    const extension = ".ts";

    const actionFiles = readdirSync("./src/events/buttons")
        .filter((file) => file.endsWith(extension))
        .map((file) => file.slice(0, -extension.length));

    if (actionFiles.includes(prefix)) {
        logger.debug(`First-time loading ${prefix} ButtonAction...`);
        const path = formatPath({
            dir: "./buttons",
            name: prefix,
            ext: extension,
        });
        const {action} = (await import(path)) as {action: ButtonAction};

        handlers.set(prefix, action); // cache for future calls
        return action;
    }

    return null;
};

export {buttonHandlerModule as event};
