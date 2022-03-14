import {logger} from "../logger";
import {ClientType, EventType} from "../types";

const shutdownModule: EventType = {
    eventName: "shutdown",
    once: false,
    execute: async (client: ClientType) => {
        try {
            client.user?.setPresence({status: "invisible", activities: []});
        } catch (err) {
            logger.warn("Failed to update presence while exiting");
        }
    },
};

export {shutdownModule as event};
