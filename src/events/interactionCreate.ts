import {CacheType, Interaction} from "discord.js";
import {GenericError, SafeDeferReply, SafeReply} from "../helpers/responses";
import {logger} from "../logger";
import {ClientType, EventType} from "../types";

const interactionHandlerModule: EventType = {
    eventName: "interactionCreate",
    once: false,
    execute: async (client: ClientType, intr: Interaction<CacheType>) => {
        if (intr.isCommand()) {
            const command = client.commands.get(intr.commandName);
            if (!command) {
                SafeReply(intr, GenericError());
                return;
            }

            try {
                if (command.deferMode !== "NO-DEFER") {
                    await SafeDeferReply(intr, command.deferMode === "EPHEMERAL");
                }

                await command.execute(intr);
            } catch (err) {
                logger.error(err);
                SafeReply(intr, GenericError());
            }
        }
    },
};

export {interactionHandlerModule as event};
