import {Config} from "../config";
import {CommandIDCache} from "../helpers/commandManager";
import {SelectPlural} from "../helpers/misc";
import {GetVerifiedCount} from "../helpers/userManagement";
import {logger} from "../logger";
import {ClientType, EventType} from "../types";

const readyEventModule: EventType = {
    eventName: "ready",
    once: true,
    execute: async (client: ClientType) => {
        const registeredCount = await GetVerifiedCount();
        const message = SelectPlural(
            registeredCount,
            "nobody 😦",
            "1 verified hacker",
            `${registeredCount} verified hackers`
        );

        client.user?.setPresence({
            status: "online",
            activities: [{type: "WATCHING", name: message}],
        });

        logger.info("Bot is ready.");
    },
};

export {readyEventModule as event};
